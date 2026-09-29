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
            <span v-if="books.length" class="k-series__count num">{{ books.length }} Folgen</span>
          </div>
          <button v-if="showDownloadAll" class="k-series__download" :class="{ 'k-series__download--done': allDownloaded }" :disabled="allDownloaded || downloadingCount > 0" @click="downloadAll">
            <span class="material-symbols" :class="{ 'k-pulse': downloadingCount > 0 }" style="font-size: 30px">{{ allDownloaded ? 'download_done' : downloadingCount ? 'downloading' : 'download' }}</span>
            <span>{{ allDownloaded ? 'Alle geladen' : downloadingCount ? `Lädt … noch ${downloadingCount}` : 'Alle laden' }}</span>
          </button>
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
import kidsPlayback from '@/mixins/kidsPlayback'
import { getSeriesSequence, parseSeriesSyllables, sortSeriesBooks } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  data() {
    return {
      refreshing: false,
      // Description from the server, for the syllables
      description: undefined
    }
  },
  computed: {
    seriesId() {
      return this.$route.params.id
    },
    /** From the cached series list, or from the downloads when offline */
    series() {
      return this.$store.getters['kids/allSeries'].find((s) => s.id === this.seriesId) || null
    },
    /** Cached episodes plus downloaded ones, refreshed in the background (store/kids.js) */
    books() {
      return sortSeriesBooks(this.$store.getters['kids/seriesBooks'](this.seriesId), this.seriesId)
    },
    loading() {
      return !this.books.length && this.refreshing
    },
    seriesWithBooks() {
      return { ...this.series, books: this.books.length ? this.books : this.series?.books || [] }
    },
    syllablesOverride() {
      return parseSeriesSyllables(this.description !== undefined ? this.description : this.series?.description)
    },
    favoriteIds() {
      return this.$store.state.kids.favoriteSeriesIds
    },
    isFavorite() {
      return this.favoriteIds.includes(this.seriesId)
    },
    notDownloaded() {
      return this.books.filter((b) => !this.kidsLocalItem(b.id))
    },
    allDownloaded() {
      return this.books.length > 0 && !this.notDownloaded.length
    },
    downloadingCount() {
      return this.notDownloaded.filter((b) => this.kidsDownloadState(b.id)).length
    },
    /** Also shown offline once everything is downloaded, as a hint that the series works without the server */
    showDownloadAll() {
      return this.books.length > 0 && (this.kidsCanDownload || this.allDownloaded)
    }
  },
  methods: {
    sequenceOf(item) {
      return getSeriesSequence(item, this.seriesId)
    },
    downloadAll() {
      this.kidsDownload(this.notDownloaded.map((b) => b.id))
    },
    async toggleFavorite() {
      await this.$hapticsImpact()
      const ids = await this.$localStore.getKidsFavoriteSeries()
      const favoriteSeriesIds = ids.includes(this.seriesId) ? ids.filter((id) => id !== this.seriesId) : [...ids, this.seriesId]
      this.$store.commit('kids/set', { favoriteSeriesIds })
      await this.$localStore.setKidsFavoriteSeries(favoriteSeriesIds)
    },
    async load() {
      this.$store.commit('kids/set', { favoriteSeriesIds: await this.$localStore.getKidsFavoriteSeries() })
      await this.$store.dispatch('kids/loadCache')
      this.refreshing = true
      const series = await this.$store.dispatch('kids/refreshSeriesBooks', this.seriesId)
      if (series) this.description = series.description || null
      this.refreshing = false
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
/* Stays on top while scrolling through long series */
.k-series__top {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 104px;
  display: flex;
  align-items: center;
  background: var(--color-page);
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
  top: 104px;
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
.k-series__download {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  margin-top: 16px;
  padding: 0 24px 0 18px;
  border-radius: 9999px;
  background: var(--color-cool);
  color: var(--color-ink);
  font-size: 20px;
  font-weight: 700;
  transition: transform 140ms var(--ease);
}
.k-series__download:active:not(:disabled) {
  transform: scale(0.97);
}
.k-series__download--done {
  background: var(--color-positive-bg);
  color: var(--color-positive);
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
