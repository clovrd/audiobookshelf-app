<template>
  <div class="w-full h-full overflow-y-auto px-4 pt-4 pb-8">
    <div class="flex items-center mb-6">
      <kids-series-tile v-if="series" :series="seriesWithBooks" :width="88" :show-name="false" class="pointer-events-none" />
      <h1 class="flex-grow text-2xl font-semibold px-4 line-clamp-2"><kids-syllable-text v-if="series" :text="series.name" :override="syllablesOverride" /></h1>
      <div class="w-14 h-14 shrink-0 flex items-center justify-center rounded-full bg-bg-hover" @click="toggleFavorite">
        <span class="material-symbols text-4xl text-error" :class="{ fill: isFavorite }">favorite</span>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <ui-loading-indicator />
    </div>
    <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
      <kids-book-tile v-for="item in books" :key="item.id" :library-item="item" :badge="sequenceLabel(item)" @click="kidsPlay" />
    </div>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { getSeriesSequence, parseSeriesSyllables, sortSeriesBooks } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  data() {
    return {
      loading: false,
      series: null,
      books: [],
      favoriteIds: []
    }
  },
  computed: {
    seriesId() {
      return this.$route.params.id
    },
    seriesWithBooks() {
      return { ...this.series, books: this.books }
    },
    syllablesOverride() {
      return parseSeriesSyllables(this.series?.description)
    },
    isFavorite() {
      return this.favoriteIds.includes(this.seriesId)
    }
  },
  methods: {
    sequenceLabel(item) {
      return getSeriesSequence(item, this.seriesId)
    },
    async toggleFavorite() {
      await this.$hapticsImpact()
      const ids = await this.$localStore.getKidsFavoriteSeries()
      this.favoriteIds = ids.includes(this.seriesId) ? ids.filter((id) => id !== this.seriesId) : [...ids, this.seriesId]
      await this.$localStore.setKidsFavoriteSeries(this.favoriteIds)
    },
    async load() {
      this.loading = true
      this.favoriteIds = await this.$localStore.getKidsFavoriteSeries()

      this.series = await this.$nativeHttp.get(`/api/series/${this.seriesId}`).catch((error) => {
        console.error('[kids] Failed to fetch series', error)
        return null
      })
      if (!this.series) {
        this.loading = false
        return
      }

      // Not minified so the items include their series sequence
      const filter = `series.${this.$encode(this.seriesId)}`
      const payload = await this.$nativeHttp.get(`/api/libraries/${this.series.libraryId}/items?filter=${encodeURIComponent(filter)}&limit=1000&page=0`).catch((error) => {
        console.error('[kids] Failed to fetch series books', error)
        return null
      })
      this.books = sortSeriesBooks(payload?.results || [], this.seriesId)
      this.loading = false
    }
  },
  mounted() {
    this.load()
  }
}
</script>
