<template>
  <div class="k-series-tile k-press" :style="width ? { width: width + 'px' } : null" @click="$emit('click', series)">
    <div class="k-cover" :class="{ 'k-series-tile__logo': showLogo }">
      <img v-if="imageSrc" :src="imageSrc" loading="lazy" @error="logoFailed = true" />
      <div v-if="isPlayingSeries" class="k-series-tile__badge"><kids-equalizer :playing="kidsIsPlaying" /></div>
    </div>
    <p v-if="showName" class="k-series-tile__name learner" :style="{ fontSize: nameSize + 'px' }"><kids-syllable-text :text="series.name" :override="syllablesOverride" /></p>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { loadSeriesDescription, parseSeriesLogo, parseSeriesSyllables, sortSeriesBooks } from '@/utils/kids'

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
      logoUrl: null,
      logoFailed: false,
      syllablesOverride: null
    }
  },
  computed: {
    showLogo() {
      return !!this.logoUrl && !this.logoFailed
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
    async loadDescription() {
      this.logoFailed = false
      const description = await loadSeriesDescription(this.$nativeHttp, this.series)
      this.logoUrl = parseSeriesLogo(description)
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
.k-series-tile__logo > img {
  object-fit: contain;
  padding: 8%;
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
