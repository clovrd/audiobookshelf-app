<template>
  <div class="k-series-tile k-press" :style="width ? { width: width + 'px' } : null" @click="$emit('click', series)">
    <div class="k-cover" :class="{ 'k-series-tile__logo': showLogo }">
      <img v-if="imageSrc" :key="imageSrc" :src="imageSrc" loading="lazy" @error="onImageError" />
      <div v-if="isPlayingSeries" class="k-series-tile__badge"><kids-equalizer :playing="kidsIsPlaying" /></div>
    </div>
    <p v-if="showName" class="k-series-tile__name learner" :style="{ fontSize: nameSize + 'px' }"><kids-syllable-text :text="series.name" :override="syllablesOverride" /></p>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { getSeriesLogoUrl, isLogoMissing, loadSeriesDescription, markLogoMissing, parseSeriesSyllables, sortSeriesBooks } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  props: {
    series: {
      type: Object,
      required: true
    },
    // Fixed width in px, otherwise fills the grid cell
    width: Number,
    showName: {
      type: Boolean,
      default: true
    },
    nameSize: {
      type: Number,
      default: 22
    }
  },
  data() {
    return {
      description: null,
      logoFailed: false,
      syllablesOverride: null
    }
  },
  computed: {
    logoUrl() {
      return getSeriesLogoUrl(this.series, this.description)
    },
    showLogo() {
      return !!this.logoUrl && !this.logoFailed && !isLogoMissing(this.logoUrl)
    },
    firstBook() {
      // First book in series order that has a cover
      const books = sortSeriesBooks(this.series.books || [], this.series.id)
      return books.find((b) => b.media?.coverPath) || books[0] || null
    },
    fallbackCover() {
      return this.$store.getters['globals/getLibraryItemCoverSrc'](this.firstBook, '/book_placeholder.jpg')
    },
    imageSrc() {
      return this.showLogo ? this.logoUrl : this.fallbackCover
    },
    isPlayingSeries() {
      return !!this.kidsSeries && this.kidsSeries.id === this.series.id
    }
  },
  watch: {
    'series.id'() {
      this.loadDescription()
    }
  },
  methods: {
    onImageError() {
      // The logo doesn't exist (or can't be loaded): show the first cover instead
      if (!this.showLogo) return
      markLogoMissing(this.logoUrl)
      this.logoFailed = true
    },
    async loadDescription() {
      this.logoFailed = false
      this.description = null
      const seriesId = this.series.id
      const description = await loadSeriesDescription(this.$nativeHttp, this.series)
      if (seriesId !== this.series.id) return
      this.description = description
      this.logoFailed = false
      this.syllablesOverride = parseSeriesSyllables(description)
    }
  },
  mounted() {
    this.loadDescription()
  }
}
</script>

<style scoped>
.k-series-tile {
  flex-shrink: 0;
}
.k-series-tile__logo {
  background: var(--color-cream-100);
}
/* Logos fill the whole tile, the cream background only shows through transparent parts */
.k-series-tile__logo > img {
  object-fit: cover;
}
.k-series-tile__badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 52px;
  height: 52px;
  border-radius: 9999px;
  background: var(--color-pine-900);
  display: flex;
  align-items: center;
  justify-content: center;
}
.k-series-tile__name {
  margin-top: 12px;
  line-height: 1.15;
}
</style>
