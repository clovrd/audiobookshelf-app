<template>
  <div class="k-continue k-press" @click="kidsPlay(libraryItem)">
    <div class="k-cover" :class="{ 'k-continue__cover--current': isCurrent }">
      <img :src="coverSrc" loading="lazy" />
      <span v-if="series && series.sequence" class="k-stamp num k-continue__stamp">{{ series.sequence }}</span>
      <div v-if="isCurrent" class="k-continue__badge"><kids-equalizer :playing="kidsIsPlaying" /></div>
    </div>
    <div class="k-progress k-continue__progress"><div :style="{ width: progressPercent + '%' }" /></div>
    <p class="k-continue__name learner"><kids-syllable-text :text="series ? series.name : title" :override="syllablesOverride" /></p>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { getItemSeries } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  props: {
    libraryItem: {
      type: Object,
      required: true
    },
    syllablesOverride: String
  },
  computed: {
    series() {
      return getItemSeries(this.libraryItem)
    },
    title() {
      return this.libraryItem.media?.metadata?.title || ''
    },
    coverSrc() {
      return this.$store.getters['globals/getLibraryItemCoverSrc'](this.libraryItem, '/book_placeholder.jpg')
    },
    isCurrent() {
      return this.kidsIsCurrent(this.libraryItem.id)
    },
    progressPercent() {
      if (this.isCurrent && this.kidsDuration) return Math.min(100, (this.kidsCurrentTime / this.kidsDuration) * 100)
      const progress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id)
      return Math.min(1, Math.max(0, progress?.progress || 0)) * 100
    }
  }
}
</script>

<style scoped>
.k-continue {
  width: 264px;
  flex-shrink: 0;
}
.k-continue__cover--current {
  overflow: visible;
  outline: 4px solid var(--color-primary);
  outline-offset: 4px;
}
.k-continue__cover--current > img {
  border-radius: 10px;
}
.k-continue__stamp {
  font-size: 30px;
  padding: 6px 14px;
}
.k-continue__badge {
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
.k-continue__progress {
  margin-top: 12px;
}
.k-continue__name {
  margin-top: 12px;
  font-size: 24px;
  line-height: 1.15;
}
</style>
