// State of the kids mode (pages/kids, components/kids), kept by components/kids/Shell.vue
import { encode } from '@/plugins/init.client'
import { localItemToKidsItem, slimLibraryItem, slimSeries } from '@/utils/kids'

// Last library from the server, saved on the device so the kids UI shows it right away and works offline
const LIBRARY_CACHE_KEY = 'kidsLibraryCache'
// The home refreshes in the background when it is opened, at most this often
const REFRESH_INTERVAL_MS = 30 * 1000

export const state = () => ({
  playerOpen: false,
  // null | 'sleep' | 'light' | 'parent'
  sheet: null,
  // Seconds in the whole book, polled from the native player
  currentTime: 0,
  // Seconds remaining, 0 when no sleep timer is running
  sleepRemaining: 0,
  volumeStep: 0,
  volumeMaxStep: 15,
  // 0.05-1, applied natively to the app window
  brightness: 1,
  favoriteSeriesIds: [],
  // A parent left the kids mode, "/" goes to the normal UI until the app restarts
  parentExited: false,

  // Library cache (slim items, see utils/kids.js)
  libraryId: null,
  series: [],
  continueListening: [],
  // seriesId -> books of that series
  seriesBooks: {},
  cacheLoaded: false,
  lastRefresh: 0,
  refreshing: false,
  // Downloaded books (local library items) in the shape of server items, see localItemToKidsItem
  localItems: [],
  // libraryItemId -> time a download was started, until the native download queue reports it
  requestedDownloads: {}
})

export const getters = {
  /** Connected to the server right now, otherwise only downloads can play */
  isOnline(state, getters, rootState) {
    return !!rootState.user.serverConnectionConfig && rootState.networkConnected
  },
  /** Downloaded copy of a server library item */
  getLocalItem: (state) => (libraryItemId) => {
    return state.localItems.find((item) => item.id === libraryItemId) || null
  },
  /** Server series plus series that only exist as downloads (offline without a cache) */
  allSeries(state) {
    const series = [...state.series]
    const known = new Set(series.map((s) => s.id))
    state.localItems.forEach((item) => {
      ;(item.media.metadata.series || []).forEach((s) => {
        if (!s.id || known.has(s.id)) return
        known.add(s.id)
        series.push({ id: s.id, name: s.name, books: [] })
      })
    })
    // Downloaded books without a cover in the list help the tile find one
    return series
      .map((s) => {
        const local = state.localItems.filter((item) => (item.media.metadata.series || []).some((ls) => ls.id === s.id))
        if (!local.length) return s
        const bookIds = new Set((s.books || []).map((b) => b.id))
        return { ...s, books: [...(s.books || []), ...local.filter((item) => !bookIds.has(item.id))] }
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  },
  /** Books of a series: the cached server list plus downloaded books that aren't in it */
  seriesBooks: (state) => (seriesId) => {
    const books = state.seriesBooks[seriesId] || []
    const ids = new Set(books.map((b) => b.id))
    const local = state.localItems.filter((item) => !ids.has(item.id) && (item.media.metadata.series || []).some((s) => s.id === seriesId))
    return [...books, ...local]
  }
}

export const mutations = {
  set(state, values) {
    Object.assign(state, values)
  },
  setSeriesBooks(state, { seriesId, books }) {
    state.seriesBooks = { ...state.seriesBooks, [seriesId]: books }
  },
  addLocalItem(state, item) {
    state.localItems = [...state.localItems.filter((i) => i.id !== item.id), item]
    const { [item.id]: _, ...requested } = state.requestedDownloads
    state.requestedDownloads = requested
  },
  requestDownloads(state, ids) {
    const requested = { ...state.requestedDownloads }
    ids.forEach((id) => (requested[id] = Date.now()))
    state.requestedDownloads = requested
  },
  clearRequestedDownloads(state, ids) {
    const requested = { ...state.requestedDownloads }
    ids.forEach((id) => delete requested[id])
    state.requestedDownloads = requested
  }
}

export const actions = {
  /** Once per app start, before the first server request */
  async loadCache({ state, commit }) {
    if (state.cacheLoaded) return
    try {
      const cache = JSON.parse((await this.$localStore.getPreferenceByKey(LIBRARY_CACHE_KEY)) || 'null')
      // A refresh may have finished while reading
      if (cache && !state.lastRefresh) {
        commit('set', {
          libraryId: cache.libraryId || null,
          series: cache.series || [],
          continueListening: cache.continueListening || [],
          seriesBooks: cache.seriesBooks || {}
        })
      }
    } catch (error) {
      console.error('[kids] Failed to read the library cache', error)
    }
    commit('set', { cacheLoaded: true })
  },
  async saveCache({ state }) {
    const cache = {
      libraryId: state.libraryId,
      series: state.series,
      continueListening: state.continueListening,
      seriesBooks: state.seriesBooks
    }
    await this.$localStore.setPreferenceByKey(LIBRARY_CACHE_KEY, JSON.stringify(cache))
  },
  async loadLocalItems({ commit }) {
    const items = (await this.$db.getLocalLibraryItems('book').catch(() => null)) || []
    commit('set', { localItems: items.map(localItemToKidsItem).filter(Boolean) })
  },
  /** Series and "Weiterhören" from the server. Keeps the cache when the server can't be reached. */
  async refreshLibrary({ state, getters, commit, dispatch, rootState }, { force = false } = {}) {
    const libraryId = rootState.libraries.currentLibraryId
    if (!getters.isOnline || !libraryId || state.refreshing) return
    if (!force && libraryId === state.libraryId && Date.now() - state.lastRefresh < REFRESH_INTERVAL_MS) return

    commit('set', { refreshing: true })
    try {
      const [seriesPayload, shelves] = await Promise.all([
        this.$nativeHttp.get(`/api/libraries/${libraryId}/series?sort=name&desc=0&limit=1000&page=0&minified=1`),
        this.$nativeHttp.get(`/api/libraries/${libraryId}/personalized?minified=1`, { connectTimeout: 10000 })
      ])
      const continueListening = (Array.isArray(shelves) && shelves.find((s) => s.id === 'continue-listening')?.entities) || []
      commit('set', {
        // Another library's episodes don't belong in this cache
        seriesBooks: libraryId === state.libraryId ? state.seriesBooks : {},
        libraryId,
        series: (seriesPayload?.results || []).map(slimSeries),
        continueListening: continueListening.map(slimLibraryItem),
        lastRefresh: Date.now()
      })
      await dispatch('saveCache')
    } catch (error) {
      console.error('[kids] Failed to refresh the library', error)
    } finally {
      commit('set', { refreshing: false })
    }
  },
  /** Books of one series, not minified so they include the sequence and duration */
  async refreshSeriesBooks({ getters, commit, dispatch }, seriesId) {
    if (!getters.isOnline) return
    try {
      const series = await this.$nativeHttp.get(`/api/series/${seriesId}`)
      if (!series?.libraryId) return
      const filter = `series.${encode(seriesId)}`
      const payload = await this.$nativeHttp.get(`/api/libraries/${series.libraryId}/items?filter=${encodeURIComponent(filter)}&limit=1000&page=0`)
      commit('setSeriesBooks', { seriesId, books: (payload?.results || []).map(slimLibraryItem) })
      await dispatch('saveCache')
      return series
    } catch (error) {
      console.error('[kids] Failed to refresh series', seriesId, error)
    }
  }
}
