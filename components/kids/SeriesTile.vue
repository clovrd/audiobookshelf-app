<template>
  <div class="shrink-0" :style="width ? { width: width + 'px' } : null" @click="$emit('click', series)">
    <div class="relative w-full rounded-2xl overflow-hidden shadow-lg" :class="showLogo ? 'bg-white' : 'bg-bg-hover'" style="padding-top: 100%">
      <img v-if="imageSrc" :src="imageSrc" class="absolute inset-0 w-full h-full" :class="showLogo ? 'object-contain p-2' : 'object-cover'" loading="lazy" @error="logoFailed = true" />
      <span v-if="favorite" class="material-symbols fill absolute top-1.5 right-1.5 text-2xl text-error drop-shadow">favorite</span>
    </div>
    <p class="mt-1.5 text-sm text-center truncate">{{ series.name }}</p>
  </div>
</template>

<script>
import { loadSeriesLogo, sortSeriesBooks } from '@/utils/kids'

export default {
  props: {
    series: {
      type: Object,
      required: true
    },
    // Fixed width in px, otherwise fills the grid cell
    width: Number,
    favorite: Boolean
  },
  data() {
    return {
      logoUrl: null,
      logoFailed: false
    }
  },
  computed: {
    showLogo() {
      return !!this.logoUrl && !this.logoFailed
    },
    firstBook() {
      return sortSeriesBooks(this.series.books || [], this.series.id)[0] || null
    },
    fallbackCover() {
      const placeholder = `${this.$store.state.routerBasePath}/book_placeholder.jpg`
      return this.$store.getters['globals/getLibraryItemCoverSrc'](this.firstBook, placeholder)
    },
    imageSrc() {
      return this.showLogo ? this.logoUrl : this.fallbackCover
    }
  },
  watch: {
    'series.id'() {
      this.loadLogo()
    }
  },
  methods: {
    async loadLogo() {
      this.logoFailed = false
      this.logoUrl = await loadSeriesLogo(this.$nativeHttp, this.series)
    }
  },
  mounted() {
    this.loadLogo()
  }
}
</script>
