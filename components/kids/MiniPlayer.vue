<template>
  <div class="k-mini">
    <div class="k-mini__progress"><div :style="{ width: progressPercent + '%' }" /></div>
    <div class="k-mini__open" @click="open">
      <div class="k-mini__cover">
        <img :src="kidsCoverSrc" />
        <div v-if="kidsIsPlaying" class="k-mini__eq"><kids-equalizer playing /></div>
      </div>
      <div class="k-mini__text">
        <p class="k-mini__name learner"><kids-syllable-text :text="kidsSeriesName" /></p>
        <p class="k-mini__meta">
          <span v-if="kidsSeries && kidsSeries.sequence" class="k-mini__number num">{{ kidsSeries.sequence }}</span>
          <span class="k-mini__time num">−{{ remainingText }}</span>
          <span v-if="kidsSleepMinutes" class="k-mini__sleep num"><span class="material-symbols fill" style="font-size: 20px">bedtime</span>{{ kidsSleepMinutes }}</span>
        </p>
      </div>
    </div>
    <button class="k-btn k-btn--outline k-mini__jump" @click="kidsJumpBackward">
      <span class="material-symbols" style="font-size: 44px">replay</span>
      <span class="k-mini__jump-label num">{{ kidsJumpSeconds }}</span>
    </button>
    <button class="k-btn k-btn--primary k-mini__play" @click="kidsPlayPause">
      <span class="material-symbols fill" :style="{ fontSize: '48px', marginLeft: kidsIsPlaying ? 0 : '4px' }">{{ kidsIsPlaying ? 'pause' : 'play_arrow' }}</span>
    </button>
  </div>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'
import { formatClock } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  computed: {
    progressPercent() {
      return this.kidsDuration ? Math.min(100, (this.kidsCurrentTime / this.kidsDuration) * 100) : 0
    },
    remainingText() {
      return formatClock(this.kidsRemaining)
    }
  },
  methods: {
    open() {
      this.$store.commit('kids/set', { playerOpen: true })
    }
  }
}
</script>

<style scoped>
.k-mini {
  position: fixed;
  left: 24px;
  right: 24px;
  bottom: calc(20px + env(safe-area-inset-bottom));
  z-index: 20;
  height: 112px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--color-cool);
  overflow: hidden;
}
.k-mini__progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: var(--color-track);
}
.k-mini__progress > div {
  height: 100%;
  background: var(--color-primary);
  transition: width 300ms linear;
}
.k-mini__open {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 20px;
}
.k-mini__cover {
  position: relative;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-sunken);
}
.k-mini__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.k-mini__eq {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(13 26 22 / 0.5);
}
.k-mini__text {
  min-width: 0;
}
.k-mini__name {
  font-size: 24px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-mini__meta {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-top: 4px;
}
.k-mini__number {
  font-size: 22px;
  font-weight: 800;
}
.k-mini__time,
.k-mini__sleep {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-ink-muted);
}
.k-mini__sleep {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.k-mini__jump {
  position: relative;
  width: 72px;
  height: 72px;
}
.k-mini__jump-label {
  position: absolute;
  font-size: 12px;
  font-weight: 800;
  padding-top: 3px;
}
.k-mini__play {
  width: 88px;
  height: 88px;
}
</style>
