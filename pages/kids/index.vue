<template>
  <div class="kids k-page no-scrollbar">
    <div class="k-home__top">
      <div class="k-home__clock num" @pointerdown="startParentHold" @pointerup="cancelParentHold" @pointerleave="cancelParentHold" @pointercancel="cancelParentHold" @contextmenu.prevent>
        {{ clock }}
        <div class="k-home__hold"><div :style="{ width: parentHold * 100 + '%' }" /></div>
      </div>
      <button class="k-btn k-btn--outline k-home__light" @click="openSheet('light')">
        <span class="material-symbols" style="font-size: 34px">brightness_6</span>
      </button>
    </div>

    <div v-if="loading" class="k-home__loading"><ui-loading-indicator /></div>
    <template v-else>
      <section v-if="continueListening.length" class="k-section">
        <h2 class="k-section__head"><span class="material-symbols" style="font-size: 30px">play_arrow</span>Weiterhören</h2>
        <div class="k-section__row no-scrollbar">
          <kids-continue-card v-for="item in continueListening" :key="item.id" :library-item="item" :syllables-override="syllablesOverrideFor(item)" />
        </div>
      </section>

      <section v-if="favoriteSeries.length" class="k-section">
        <h2 class="k-section__head"><span class="material-symbols fill" style="font-size: 28px">favorite</span>Lieblinge</h2>
        <div class="k-section__row no-scrollbar">
          <kids-series-tile v-for="s in favoriteSeries" :key="s.id" :series="s" :width="220" @click="openSeries" />
        </div>
      </section>

      <section class="k-section">
        <h2 class="k-section__head"><span class="material-symbols" style="font-size: 28px">grid_view</span>Alle Serien</h2>
        <div class="k-home__grid">
          <kids-series-tile v-for="s in series" :key="s.id" :series="s" @click="openSeries" />
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { getItemSeries, parseSeriesSyllables } from '@/utils/kids'

const PARENT_HOLD_MS = 3000

export default {
  data() {
    return {
      loading: false,
      series: [],
      continueListening: [],
      clock: '',
      clockInterval: null,
      parentHold: 0,
      parentHoldStart: null
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    loadKey() {
      return `${this.currentLibraryId}|${this.$store.state.user.serverConnectionConfig?.id || ''}`
    },
    favoriteSeries() {
      // In the order they were added
      return this.$store.state.kids.favoriteSeriesIds.map((id) => this.series.find((s) => s.id === id)).filter(Boolean)
    }
  },
  watch: {
    // On app start this page mounts before the server connection is made, and the library id is set before the
    // connection config, so both are watched
    loadKey() {
      this.load()
    }
  },
  methods: {
    openSeries(series) {
      this.$router.push(`/kids/series/${series.id}`)
    },
    openSheet(sheet) {
      this.$store.commit('kids/set', { sheet })
    },
    syllablesOverrideFor(libraryItem) {
      const name = getItemSeries(libraryItem)?.name
      return parseSeriesSyllables(this.series.find((s) => s.name === name)?.description)
    },
    updateClock() {
      const now = new Date()
      this.clock = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
    },
    /** Hidden parent exit: hold the clock for 3 seconds */
    startParentHold() {
      this.parentHoldStart = Date.now()
      const step = () => {
        if (this.parentHoldStart === null) return
        this.parentHold = Math.min(1, (Date.now() - this.parentHoldStart) / PARENT_HOLD_MS)
        if (this.parentHold >= 1) {
          this.cancelParentHold()
          this.openSheet('parent')
          return
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    },
    cancelParentHold() {
      this.parentHoldStart = null
      this.parentHold = 0
    },
    async fetchSeries() {
      const payload = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/series?sort=name&desc=0&limit=1000&page=0&minified=1`).catch((error) => {
        console.error('[kids] Failed to fetch series', error)
        return null
      })
      return payload?.results || []
    },
    async fetchContinueListening() {
      const shelves = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/personalized?minified=1`, { connectTimeout: 10000 }).catch((error) => {
        console.error('[kids] Failed to fetch personalized shelves', error)
        return null
      })
      return (Array.isArray(shelves) && shelves.find((s) => s.id === 'continue-listening')?.entities) || []
    },
    async load() {
      if (!this.currentLibraryId || !this.$store.state.user.serverConnectionConfig) return
      this.loading = !this.series.length
      const [series, continueListening, favoriteSeriesIds] = await Promise.all([this.fetchSeries(), this.fetchContinueListening(), this.$localStore.getKidsFavoriteSeries()])
      this.series = series
      this.continueListening = continueListening
      this.$store.commit('kids/set', { favoriteSeriesIds })
      this.loading = false
    }
  },
  mounted() {
    this.updateClock()
    this.clockInterval = setInterval(this.updateClock, 10000)
    this.load()
  },
  beforeDestroy() {
    clearInterval(this.clockInterval)
    this.cancelParentHold()
  }
}
</script>

<style scoped>
.k-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 0 40px 160px;
}
.k-home__top {
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.k-home__clock {
  position: relative;
  padding: 12px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-ink-muted);
  touch-action: none;
}
.k-home__hold {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  height: 3px;
}
.k-home__hold > div {
  height: 100%;
  background: var(--color-ink);
}
.k-home__light {
  width: 72px;
  height: 72px;
}
.k-home__loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.k-section {
  margin-bottom: 36px;
  padding-top: 14px;
  border-top: 2px solid var(--color-rule);
}
.k-section__head {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.k-section__row {
  display: flex;
  gap: 28px;
  padding-top: 22px;
  margin: 0 -40px;
  padding-left: 40px;
  padding-right: 40px;
  overflow-x: auto;
}
.k-home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 36px 28px;
  padding-top: 22px;
}
</style>
