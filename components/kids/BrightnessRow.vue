<template>
  <div class="k-row" :style="{ height: rowHeight + 'px' }">
    <button class="k-btn k-row__icon" @click="set(minBrightness)">
      <span class="material-symbols" style="font-size: 30px">brightness_low</span>
    </button>
    <kids-drag-slider :value="brightness" :min="minBrightness" fill-color="var(--color-amber-400)" @input="set" />
    <button class="k-btn k-row__icon" @click="set(1)">
      <span class="material-symbols" style="font-size: 36px">brightness_high</span>
    </button>
  </div>
</template>

<script>
import { MIN_BRIGHTNESS, setBrightness } from '@/utils/kidsDevice'

export default {
  props: {
    rowHeight: {
      type: Number,
      default: 76
    }
  },
  data() {
    return {
      minBrightness: MIN_BRIGHTNESS
    }
  },
  computed: {
    brightness() {
      return this.$store.state.kids.brightness
    }
  },
  methods: {
    set(value) {
      setBrightness(this.$store, this.$localStore, value)
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
</style>
