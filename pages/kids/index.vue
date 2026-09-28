<template>
  <div class="w-full h-full overflow-y-auto px-4 pt-4 pb-8">
    <div v-if="loading" class="flex justify-center py-20">
      <ui-loading-indicator />
    </div>
    <template v-else>
      <section v-if="continueListening.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-3">{{ $strings.LabelContinueListening }}</h2>
        <div class="flex overflow-x-auto gap-4 -mx-4 px-4 pb-1">
          <kids-book-tile v-for="item in continueListening" :key="item.id" :library-item="item" :width="rowTileWidth" @click="kidsPlay" />
        </div>
      </section>

      <section v-if="continueSeries.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-3">{{ $strings.LabelContinueSeries }}</h2>
        <div class="flex overflow-x-auto gap-4 -mx-4 px-4 pb-1">
          <kids-book-tile v-for="item in continueSeries" :key="item.id" :library-item="item" :width="rowTileWidth" @click="kidsPlay" />
        </div>
      </section>

      <section v-if="favoriteSeries.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-3">{{ $strings.LabelKidsFavorites }}</h2>
        <div class="flex overflow-x-auto gap-4 -mx-4 px-4 pb-1">
          <kids-series-tile v-for="series in favoriteSeries" :key="series.id" :series="series" :width="rowTileWidth" favorite @click="openSeries" />
        </div>
      </section>

      <section>
        <h2 class="text-xl font-semibold mb-3">{{ $strings.LabelKidsAllSeries }}</h2>
        <p v-if="!series.length" class="text-fg-muted py-8 text-center">{{ $strings.MessageKidsNoSeries }}</p>
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
          <kids-series-tile v-for="s in series" :key="s.id" :series="s" :favorite="favoriteIds.includes(s.id)" @click="openSeries" />
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'

export default {
  mixins: [kidsPlayback],
  data() {
    return {
      loading: false,
      series: [],
      continueListening: [],
      continueSeries: [],
      favoriteIds: [],
      rowTileWidth: 150
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    favoriteSeries() {
      // In the order they were added
      return this.favoriteIds.map((id) => this.series.find((s) => s.id === id)).filter(Boolean)
    }
  },
  watch: {
    currentLibraryId() {
      this.load()
    }
  },
  methods: {
    openSeries(series) {
      this.$router.push(`/kids/series/${series.id}`)
    },
    async fetchSeries() {
      const payload = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/series?sort=name&desc=0&limit=1000&page=0&minified=1`).catch((error) => {
        console.error('[kids] Failed to fetch series', error)
        return null
      })
      return payload?.results || []
    },
    async fetchShelves() {
      const shelves = await this.$nativeHttp.get(`/api/libraries/${this.currentLibraryId}/personalized?minified=1`, { connectTimeout: 10000 }).catch((error) => {
        console.error('[kids] Failed to fetch personalized shelves', error)
        return null
      })
      return Array.isArray(shelves) ? shelves : []
    },
    async load() {
      if (!this.currentLibraryId || !this.$store.state.user.serverConnectionConfig) return
      this.loading = true
      const [series, shelves, favoriteIds] = await Promise.all([this.fetchSeries(), this.fetchShelves(), this.$localStore.getKidsFavoriteSeries()])
      this.series = series
      this.continueListening = shelves.find((s) => s.id === 'continue-listening')?.entities || []
      this.continueSeries = shelves.find((s) => s.id === 'continue-series')?.entities || []
      this.favoriteIds = favoriteIds
      this.loading = false
    }
  },
  mounted() {
    this.load()
  }
}
</script>
