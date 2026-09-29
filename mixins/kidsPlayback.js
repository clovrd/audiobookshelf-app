import { Capacitor } from '@capacitor/core'
import { AbsAudioPlayer, AbsDownloader } from '@/plugins/capacitor'
import { cleanEpisodeTitle, getItemSeries } from '@/utils/kids'

const PLACEHOLDER = '/book_placeholder.jpg'
// A download counts as starting for this long until the native queue reports it
const DOWNLOAD_START_MS = 20000

/** Downloads go to the app's internal storage unless a parent set up a folder for books in the normal UI */
async function getDownloadFolderId(db) {
  const folders = ((await db.getLocalFolders().catch(() => null)) || []).filter((f) => f.mediaType === 'book')
  if (!folders.length || folders.some((f) => f.id === 'internal-book')) return 'internal-book'
  return folders[0].id
}

export default {
  computed: {
    /** Connected to the server, otherwise only downloaded episodes can play */
    kidsOnline() {
      return this.$store.getters['kids/isOnline']
    },
    kidsCanDownload() {
      return this.kidsOnline && this.$store.getters['user/getUserCanDownload']
    },
    kidsSession() {
      return this.$store.state.currentPlaybackSession
    },
    kidsIsPlaying() {
      return this.$store.state.playerIsPlaying
    },
    kidsCoverSrc() {
      const session = this.kidsSession
      if (!session) return null
      const localCover = session.localLibraryItem?.coverContentUrl
      if (localCover) return Capacitor.convertFileSrc(localCover)
      if (session.libraryItem) return this.$store.getters['globals/getLibraryItemCoverSrc'](session.libraryItem, '/book_placeholder.jpg')
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](session.libraryItemId, '/book_placeholder.jpg')
    },
    /** { id, name, sequence } of the current book */
    kidsSeries() {
      const session = this.kidsSession
      return session ? getItemSeries(session.libraryItem || session) : null
    },
    kidsSeriesName() {
      return this.kidsSeries?.name || this.kidsSession?.displayTitle || ''
    },
    kidsEpisodeTitle() {
      const title = this.kidsSession?.displayTitle || ''
      if (!this.kidsSeries) return title
      return cleanEpisodeTitle(title, this.kidsSeries.name, this.kidsSeries.sequence)
    },
    kidsDuration() {
      return this.kidsSession?.duration || 0
    },
    kidsCurrentTime() {
      return this.$store.state.kids.currentTime
    },
    kidsRemaining() {
      return Math.max(0, this.kidsDuration - this.kidsCurrentTime)
    },
    kidsChapters() {
      return this.kidsSession?.chapters || []
    },
    kidsChapterIndex() {
      const time = this.kidsCurrentTime
      return this.kidsChapters.findIndex((chapter) => time >= chapter.start && time < chapter.end)
    },
    kidsSleepMinutes() {
      const remaining = this.$store.state.kids.sleepRemaining
      return remaining > 0 ? Math.ceil(remaining / 60) : 0
    },
    kidsJumpSeconds() {
      return this.$store.getters['getJumpBackwardsTime']
    }
  },
  methods: {
    /** Downloaded copy of a server item, see localItemToKidsItem */
    kidsLocalItem(libraryItemId) {
      return this.$store.getters['kids/getLocalItem'](libraryItemId)
    },
    /** Online everything plays, offline only downloads */
    kidsIsAvailable(libraryItemId) {
      return this.kidsOnline || !!this.kidsLocalItem(libraryItemId)
    },
    /** The downloaded cover when there is one, it also works offline */
    kidsCoverFor(libraryItem) {
      if (!libraryItem) return PLACEHOLDER
      const localCover = libraryItem.localCoverSrc || this.kidsLocalItem(libraryItem.id)?.localCoverSrc
      if (localCover) return localCover
      return this.$store.getters['globals/getLibraryItemCoverSrc'](libraryItem, PLACEHOLDER)
    },
    /** Replaces a cover that failed to load, e.g. a server cover while offline */
    kidsCoverError(event) {
      if (!event.target.src.endsWith(PLACEHOLDER)) event.target.src = PLACEHOLDER
    },
    /**
     * Progress of a book: the server's, or the one saved on the device for downloads, whichever is newer.
     * Offline only the device's exists.
     */
    kidsProgressOf(libraryItemId) {
      const server = this.$store.getters['user/getUserMediaProgress'](libraryItemId)
      const local = this.$store.getters['globals/getLocalMediaProgressByServerItemId'](libraryItemId)
      if (!server) return local || null
      if (!local) return server
      return (local.lastUpdate || 0) > (server.lastUpdate || 0) ? local : server
    },
    /** null, or { progress: 0-1 } while the episode is downloading */
    kidsDownloadState(libraryItemId) {
      if (this.kidsLocalItem(libraryItemId)) return null
      const download = this.$store.getters['globals/getDownloadItem'](libraryItemId)
      if (download) return { progress: download.itemProgress || 0 }
      const requestedAt = this.$store.state.kids.requestedDownloads[libraryItemId]
      if (requestedAt && Date.now() - requestedAt < DOWNLOAD_START_MS) return { progress: 0 }
      return null
    },
    /** Downloads the episodes that aren't downloaded or downloading yet */
    async kidsDownload(libraryItemIds) {
      if (!this.kidsCanDownload) return
      const ids = libraryItemIds.filter((id) => !this.kidsLocalItem(id) && !this.kidsDownloadState(id))
      if (!ids.length) return
      await this.$hapticsImpact()
      this.$store.commit('kids/requestDownloads', ids)
      const localFolderId = await getDownloadFolderId(this.$db)
      for (const libraryItemId of ids) {
        const result = await AbsDownloader.downloadLibraryItem({ libraryItemId, localFolderId }).catch((error) => ({ error: error.message || String(error) }))
        if (result?.error) {
          console.error('[kids] Download failed', libraryItemId, result.error)
          this.$store.commit('kids/clearRequestedDownloads', ids)
          this.$toast.error(result.error)
          return
        }
      }
    },
    kidsPlayPause() {
      this.$hapticsImpact()
      return AbsAudioPlayer.playPause()
    },
    kidsJumpBackward() {
      this.$hapticsImpact()
      return AbsAudioPlayer.seekBackward({ value: this.$store.getters['getJumpBackwardsTime'] })
    },
    kidsJumpForward() {
      this.$hapticsImpact()
      return AbsAudioPlayer.seekForward({ value: this.$store.getters['getJumpForwardTime'] })
    },
    /** Server library item id of the current playback, also for downloaded items */
    kidsCurrentItemId() {
      const session = this.kidsSession
      return session ? session.libraryItemId || session.localLibraryItem?.libraryItemId || null : null
    },
    kidsIsCurrent(libraryItemId) {
      return !!libraryItemId && this.kidsCurrentItemId() === libraryItemId
    },
    /**
     * Plays a book and opens the player. Prefers the downloaded copy, restarts finished books.
     * The book that is already loaded just continues.
     */
    async kidsPlay(libraryItem, { restart = false } = {}) {
      if (!libraryItem || this.$store.state.playerIsStartingPlayback) return
      if (!this.kidsIsAvailable(libraryItem.id)) return
      await this.$hapticsImpact()
      this.$store.commit('kids/set', { playerOpen: true })

      if (this.kidsIsCurrent(libraryItem.id)) {
        if (!this.kidsIsPlaying) await AbsAudioPlayer.playPlayer()
        return
      }

      const serverLibraryItemId = libraryItem.id
      const localLibraryItem = await this.$db.getLocalLibraryItemByLId(serverLibraryItemId).catch(() => null)
      const libraryItemId = localLibraryItem && !this.$store.state.isCasting ? localLibraryItem.id : serverLibraryItemId

      this.$store.commit('setPlayerIsStartingPlayback', libraryItemId)
      this.$eventBus.$emit('play-item', { libraryItemId, serverLibraryItemId, startTime: restart ? 0 : undefined })
    }
  }
}
