<template>
  <div class="shrink-0" :style="width ? { width: width + 'px' } : null" @click="$emit('click', libraryItem)">
    <div class="relative w-full rounded-2xl overflow-hidden shadow-lg bg-bg-hover" :class="{ 'ring-4 ring-accent': isCurrent }" style="padding-top: 100%">
      <img :src="coverSrc" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />

      <div v-if="badge !== null && badge !== undefined" class="absolute top-1.5 left-1.5 min-w-[1.75rem] h-7 px-1.5 rounded-full bg-black/60 text-white text-sm font-semibold flex items-center justify-center">{{ badge }}</div>
      <span v-if="isFinished" class="material-symbols fill absolute top-1.5 right-1.5 text-2xl text-success bg-white rounded-full">check_circle</span>

      <div v-if="isCurrent" class="absolute inset-0 flex items-center justify-center">
        <span class="material-symbols fill text-5xl text-white bg-black/50 rounded-full p-2">{{ isStartingPlayback ? 'hourglass_empty' : isPlaying ? 'pause' : 'play_arrow' }}</span>
      </div>

      <div v-if="progressPercent > 0 && !isFinished" class="absolute bottom-0 left-0 w-full h-1.5 bg-black/40">
        <div class="h-full bg-accent" :style="{ width: progressPercent * 100 + '%' }" />
      </div>
    </div>
    <p v-if="showTitle" class="mt-1.5 text-xs text-center line-clamp-2">{{ title }}</p>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      required: true
    },
    // Fixed width in px, otherwise fills the grid cell
    width: Number,
    // Shown top left, e.g. the series sequence
    badge: [Number, String],
    showTitle: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    title() {
      return this.libraryItem.media?.metadata?.title || ''
    },
    coverSrc() {
      const placeholder = '/book_placeholder.jpg'
      return this.$store.getters['globals/getLibraryItemCoverSrc'](this.libraryItem, placeholder)
    },
    userProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id)
    },
    isFinished() {
      return !!this.userProgress?.isFinished
    },
    progressPercent() {
      return Math.max(Math.min(1, this.userProgress?.progress || 0), 0)
    },
    isCurrent() {
      const session = this.$store.state.currentPlaybackSession
      if (!session) return false
      return session.libraryItemId === this.libraryItem.id || session.localLibraryItem?.libraryItemId === this.libraryItem.id
    },
    isPlaying() {
      return this.$store.state.playerIsPlaying
    },
    isStartingPlayback() {
      return !!this.$store.state.playerIsStartingPlayback
    }
  }
}
</script>
