<template>
  <kids-sheet icon="bedtime" :icon-filled="isRunning" title="Schlaf-Timer" @close="$emit('close')">
    <div v-if="!isRunning" class="k-sleep-options">
      <button v-for="minutes in options" :key="minutes" class="k-sleep-option k-press" @click="start(minutes)">
        <span class="k-sleep-option__value num">{{ minutes }}</span>
        <span class="k-sleep-option__unit">Min.</span>
      </button>
    </div>
    <div v-else class="k-sleep-active">
      <p class="k-sleep-active__time num">{{ remainingText }}</p>
      <div class="k-sleep-active__buttons">
        <button class="k-btn k-btn--outline k-sleep-active__button" @click="decrease">
          <span class="num">−5</span>
        </button>
        <button class="k-btn k-btn--outline k-sleep-active__button" @click="increase">
          <span class="num">+5</span>
        </button>
        <button class="k-btn k-btn--sunken k-sleep-active__button" @click="cancel">
          <span class="material-symbols" style="font-size: 44px">timer_off</span>
        </button>
      </div>
    </div>
  </kids-sheet>
</template>

<script>
import { AbsAudioPlayer } from '@/plugins/capacitor'
import { formatClock } from '@/utils/kids'

const FIVE_MINUTES_MS = 5 * 60 * 1000
const MAX_SECONDS = 180 * 60

export default {
  data() {
    return {
      options: [5, 15, 30, 60]
    }
  },
  computed: {
    remaining() {
      return this.$store.state.kids.sleepRemaining
    },
    isRunning() {
      return this.remaining > 0
    },
    remainingText() {
      return formatClock(this.remaining)
    }
  },
  methods: {
    async start(minutes) {
      await this.$hapticsImpact()
      await AbsAudioPlayer.setSleepTimer({ time: String(minutes * 60 * 1000), isChapterTime: false })
      this.$emit('close')
    },
    increase() {
      if (this.remaining + 5 * 60 > MAX_SECONDS) return
      AbsAudioPlayer.increaseSleepTime({ time: String(FIVE_MINUTES_MS) })
    },
    decrease() {
      // Going below zero turns the timer off
      if (this.remaining <= 5 * 60) return this.cancel()
      AbsAudioPlayer.decreaseSleepTime({ time: String(FIVE_MINUTES_MS) })
    },
    cancel() {
      AbsAudioPlayer.cancelSleepTimer()
    }
  }
}
</script>

<style scoped>
.k-sleep-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.k-sleep-option {
  height: 144px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-line-strong);
  border-radius: 10px;
}
.k-sleep-option:active {
  background: var(--color-sunken);
}
.k-sleep-option__value {
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
}
.k-sleep-option__unit {
  margin-top: 6px;
  font-size: 17px;
  color: var(--color-ink-muted);
}
.k-sleep-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.k-sleep-active__time {
  font-size: 88px;
  font-weight: 800;
  line-height: 1;
}
.k-sleep-active__buttons {
  display: flex;
  gap: 24px;
}
.k-sleep-active__button {
  width: 104px;
  height: 104px;
  font-size: 30px;
  font-weight: 800;
}
</style>
