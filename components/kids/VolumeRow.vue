<template>
  <div class="k-row" :style="{ height: rowHeight + 'px' }">
    <button class="k-btn k-row__icon" :class="{ 'k-btn--sunken': volumeStep === 0 }" @click="mute">
      <span class="material-symbols fill" style="font-size: 34px">{{ volumeIcon }}</span>
    </button>
    <div class="k-steps">
      <button v-for="step in volumeMaxStep" :key="step" class="k-steps__bar" :class="{ 'k-steps__bar--on': step <= volumeStep }" :style="{ height: barHeight(step) + '%' }" @click="setStep(step)" />
    </div>
    <span class="k-row__value num">{{ volumeStep }}</span>
  </div>
</template>

<script>
import { setVolumeStep, toggleMute } from '@/utils/kidsDevice'

export default {
  props: {
    rowHeight: {
      type: Number,
      default: 76
    }
  },
  computed: {
    volumeStep() {
      return this.$store.state.kids.volumeStep
    },
    volumeMaxStep() {
      return this.$store.state.kids.volumeMaxStep
    },
    volumeIcon() {
      if (this.volumeStep === 0) return 'volume_off'
      return this.volumeStep <= this.volumeMaxStep / 3 ? 'volume_down' : 'volume_up'
    }
  },
  methods: {
    // Bars rise from 22% to 99% of the row
    barHeight(step) {
      if (this.volumeMaxStep <= 1) return 99
      return 22 + ((step - 1) / (this.volumeMaxStep - 1)) * 77
    },
    setStep(step) {
      setVolumeStep(this.$store, step)
    },
    mute() {
      toggleMute(this.$store)
    }
  }
}
</script>

<style scoped>
.k-row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.k-row__icon {
  width: 64px;
  height: 64px;
}
.k-row__value {
  width: 32px;
  text-align: right;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-ink-muted);
}
.k-steps {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 56px;
}
.k-steps__bar {
  flex: 1;
  border-radius: 2px;
  background: var(--color-track);
  transition: background-color 140ms var(--ease);
}
.k-steps__bar--on {
  background: var(--color-primary);
}
</style>
