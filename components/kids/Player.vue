<template>
  <div class="k-player kids no-scrollbar">
    <div class="k-player__top">
      <button class="k-btn k-btn--sunken k-player__top-button" @click="close">
        <span class="material-symbols" style="font-size: 48px">keyboard_arrow_down</span>
      </button>
      <div class="k-player__chapter">
        <template v-if="kidsChapters.length > 1 && kidsChapterIndex >= 0">
          <p class="k-player__chapter-count">Kapitel {{ kidsChapterIndex + 1 }} von {{ kidsChapters.length }}</p>
          <p class="k-player__chapter-name">{{ kidsChapters[kidsChapterIndex].title }}</p>
        </template>
      </div>
      <button class="k-btn k-player__sleep" :class="kidsSleepMinutes ? 'k-btn--sunken' : 'k-btn--outline'" @click="openSheet('sleep')">
        <span class="material-symbols" :class="{ fill: kidsSleepMinutes }" style="font-size: 34px">bedtime</span>
        <span v-if="kidsSleepMinutes" class="k-player__sleep-minutes num">{{ kidsSleepMinutes }}</span>
      </button>
    </div>

    <div class="k-player__body">
      <div class="k-player__cover-column">
        <div class="k-player__cover k-cover">
          <img :src="kidsCoverSrc" />
          <span v-if="kidsSeries && kidsSeries.sequence" class="k-stamp num k-player__stamp">{{ kidsSeries.sequence }}</span>
        </div>
      </div>

      <div class="k-player__controls">
        <div>
          <h1 class="k-player__series learner"><kids-syllable-text :text="kidsSeriesName" /></h1>
          <p class="k-player__episode">{{ kidsEpisodeTitle }}</p>
        </div>

        <div>
          <kids-drag-slider :value="seekValue" :ticks="chapterTicks" @input="seekDrag" @change="seekEnd" />
          <div class="k-player__times num">
            <span><span class="k-player__time-current">{{ currentText }}</span> <span class="k-player__time-total">/ {{ durationText }}</span></span>
            <span class="k-player__time-remaining">−{{ remainingText }}</span>
          </div>
        </div>

        <div class="k-player__transport">
          <button class="k-btn k-btn--outline k-player__jump" @click="kidsJumpBackward">
            <span class="material-symbols" style="font-size: 64px">replay</span>
            <span class="k-player__jump-label num">{{ jumpBackwardSeconds }}</span>
          </button>
          <button class="k-btn k-btn--primary k-player__play" @click="kidsPlayPause">
            <span class="material-symbols fill" :style="{ fontSize: '76px', marginLeft: kidsIsPlaying ? 0 : '8px' }">{{ kidsIsPlaying ? 'pause' : 'play_arrow' }}</span>
          </button>
          <button class="k-btn k-btn--outline k-player__jump" @click="kidsJumpForward">
            <span class="material-symbols k-player__forward-icon" style="font-size: 64px">replay</span>
            <span class="k-player__jump-label num">{{ jumpForwardSeconds }}</span>
          </button>
        </div>

        <div class="k-player__sound">
          <kids-volume-row />
          <kids-brightness-row class="k-player__brightness" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { AbsAudioPlayer } from '@/plugins/capacitor'
import kidsPlayback from '@/mixins/kidsPlayback'
import { formatClock } from '@/utils/kids'

export default {
  mixins: [kidsPlayback],
  data() {
    return {
      // Position while dragging the seek bar, in seconds
      seekPreview: null
    }
  },
  computed: {
    displayTime() {
      return this.seekPreview !== null ? this.seekPreview : this.kidsCurrentTime
    },
    seekValue() {
      return this.kidsDuration ? this.displayTime / this.kidsDuration : 0
    },
    chapterTicks() {
      if (!this.kidsDuration || this.kidsChapters.length < 2) return []
      return this.kidsChapters.slice(1).map((chapter) => chapter.start / this.kidsDuration)
    },
    currentText() {
      return formatClock(this.displayTime)
    },
    durationText() {
      return formatClock(this.kidsDuration)
    },
    remainingText() {
      return formatClock(Math.max(0, this.kidsDuration - this.displayTime))
    },
    jumpBackwardSeconds() {
      return this.$store.getters['getJumpBackwardsTime']
    },
    jumpForwardSeconds() {
      return this.$store.getters['getJumpForwardTime']
    }
  },
  methods: {
    close() {
      this.$store.commit('kids/set', { playerOpen: false })
    },
    openSheet(sheet) {
      this.$store.commit('kids/set', { sheet })
    },
    seekDrag(fraction) {
      this.seekPreview = fraction * this.kidsDuration
    },
    async seekEnd(fraction) {
      const time = fraction * this.kidsDuration
      this.$store.commit('kids/set', { currentTime: time })
      this.seekPreview = null
      await AbsAudioPlayer.seek({ value: time })
    }
  }
}
</script>

<style scoped>
.k-player {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow-y: auto;
  padding: env(safe-area-inset-top) 48px calc(32px + env(safe-area-inset-bottom));
}
.k-player__top {
  height: 104px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.k-player__top-button {
  width: 72px;
  height: 72px;
}
.k-player__chapter {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.k-player__chapter-count {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--color-ink-muted);
}
.k-player__chapter-name {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-player__sleep {
  height: 72px;
  min-width: 72px;
  padding: 0 18px;
  gap: 8px;
}
.k-player__sleep-minutes {
  font-size: 22px;
  font-weight: 700;
}
.k-player__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 24px 56px;
  min-height: calc(100% - 104px);
}
.k-player__cover-column {
  flex: 1 1 440px;
  display: flex;
  justify-content: center;
}
.k-player__cover {
  width: min(100%, 500px);
  padding-top: 0;
  aspect-ratio: 1;
}
.k-player__stamp {
  font-size: 48px;
  padding: 10px 22px;
}
.k-player__controls {
  flex: 1 1 480px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.k-player__series {
  font-size: 44px;
  line-height: 1.1;
}
.k-player__episode {
  margin-top: 8px;
  font-size: 20px;
  color: var(--color-ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-player__times {
  display: flex;
  justify-content: space-between;
  font-size: 22px;
  font-weight: 700;
}
.k-player__time-total {
  font-weight: 500;
  color: var(--color-ink-muted);
}
.k-player__time-remaining {
  color: var(--color-ink-muted);
}
.k-player__transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
}
.k-player__jump {
  position: relative;
  width: 104px;
  height: 104px;
}
.k-player__forward-icon {
  transform: scaleX(-1);
}
.k-player__jump-label {
  position: absolute;
  font-size: 18px;
  font-weight: 800;
  padding-top: 4px;
}
.k-player__play {
  width: 152px;
  height: 152px;
}
.k-player__sound {
  border-top: 2px solid var(--color-rule);
}
.k-player__brightness {
  border-top: 1px solid var(--color-line);
}
</style>
