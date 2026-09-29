<template>
  <div class="kids k-page no-scrollbar">
    <div class="k-series__top">
      <button class="k-btn k-btn--sunken k-series__back" @click="$router.push('/kids')">
        <span class="material-symbols" style="font-size: 36px">arrow_back_ios_new</span>
      </button>
    </div>

    <div class="k-series__body">
      <div class="k-series__side">
        <template v-if="series">
          <kids-series-tile :series="seriesWithBooks" :show-name="false" class="k-series__cover" />
          <h1 class="k-series__name learner"><kids-syllable-text :text="series.name" :override="syllablesOverride" /></h1>
          <div class="k-series__actions">
            <button class="k-btn k-series__favorite" :class="isFavorite ? 'k-series__favorite--on' : 'k-btn--outline'" @click="toggleFavorite">
              <span class="material-symbols" :class="{ fill: isFavorite }" style="font-size: 44px">favorite</span>
            </button>
            <span v-if="!loading" class="k-series__count num">{{ books.length }} Folgen</span>
          </div>
        </template>
      </div>

      <div class="k-series__episodes">
        <div v-if="loading" class="k-series__loading"><ui-loading-indicator /></div>
        <div v-else class="k-series__grid">
          <kids-episode-tile v-for="item in books" :key="item.id" :library-item="item" :sequence="sequenceOf(item)" :series-name="series ? series.name : null" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getSeriesSequence, parseSeriesSyllables, sortSeriesBooks } from '@/utils/kids'

export default {
  data() {
    return {
      loading: false,
      series: null,
      books: []
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
    favoriteIds() {
      return this.$store.state.kids.favoriteSeriesIds
    },
    isFavorite() {
      return this.favoriteIds.includes(this.seriesId)
    }
  },
  methods: {
    sequenceOf(item) {
      return getSeriesSequence(item, this.seriesId)
    },
    async toggleFavorite() {
      await this.$hapticsImpact()
      const ids = await this.$localStore.getKidsFavoriteSeries()
      const favoriteSeriesIds = ids.includes(this.seriesId) ? ids.filter((id) => id !== this.seriesId) : [...ids, this.seriesId]
      this.$store.commit('kids/set', { favoriteSeriesIds })
      await this.$localStore.setKidsFavoriteSeries(favoriteSeriesIds)
    },
    async load() {
      this.loading = true
      this.$store.commit('kids/set', { favoriteSeriesIds: await this.$localStore.getKidsFavoriteSeries() })

      this.series = await this.$nativeHttp.get(`/api/series/${this.seriesId}`).catch((error) => {
        console.error('[kids] Failed to fetch series', error)
        return null
      })
      if (!this.series) {
        this.loading = false
        return
      }

      // Not minified so the items include their series sequence and duration
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

<style scoped>
.k-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 0 40px 160px;
}
.k-series__top {
  height: 104px;
  display: flex;
  align-items: center;
}
.k-series__back {
  width: 72px;
  height: 72px;
}
.k-series__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 40px;
}
.k-series__side {
  flex: 0 1 340px;
  position: sticky;
  top: 0;
}
.k-series__cover {
  width: 100%;
}
.k-series__cover >>> .k-press:active,
.k-series__cover.k-press:active {
  transform: none;
}
.k-series__name {
  margin-top: 20px;
  font-size: 40px;
  line-height: 1.1;
}
.k-series__actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}
.k-series__favorite {
  width: 88px;
  height: 88px;
}
.k-series__favorite--on {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
.k-series__count {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-ink-muted);
}
.k-series__episodes {
  flex: 1 1 480px;
  min-width: 0;
  border-top: 2px solid var(--color-rule);
}
.k-series__loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.k-series__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  column-gap: 28px;
}
</style>
