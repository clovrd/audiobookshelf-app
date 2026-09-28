<template>
  <div ref="area" class="k-slider" :style="{ '--fill': fillColor }" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp">
    <div class="k-slider__track">
      <div class="k-slider__fill" :style="{ width: percent + '%' }" />
      <div v-for="tick in ticks" :key="tick" class="k-slider__tick" :style="{ left: tick * 100 + '%' }" />
    </div>
    <div class="k-slider__thumb" :style="{ left: percent + '%' }" />
  </div>
</template>

<script>
/**
 * Slider with a large touch area. Emits "input" while dragging and "change" when released.
 */
export default {
  props: {
    // 0-1
    value: {
      type: Number,
      default: 0
    },
    min: {
      type: Number,
      default: 0
    },
    // Marks on the track as 0-1, e.g. chapter starts
    ticks: {
      type: Array,
      default: () => []
    },
    fillColor: {
      type: String,
      default: 'var(--color-primary)'
    }
  },
  data() {
    return {
      dragValue: null
    }
  },
  computed: {
    percent() {
      const value = this.dragValue !== null ? this.dragValue : this.value
      return Math.min(1, Math.max(0, value)) * 100
    }
  },
  methods: {
    valueFromEvent(event) {
      const rect = this.$refs.area.getBoundingClientRect()
      const fraction = (event.clientX - rect.left) / rect.width
      return Math.min(1, Math.max(this.min, fraction))
    },
    pointerDown(event) {
      this.$refs.area.setPointerCapture(event.pointerId)
      this.dragValue = this.valueFromEvent(event)
      this.$emit('input', this.dragValue)
    },
    pointerMove(event) {
      if (this.dragValue === null) return
      this.dragValue = this.valueFromEvent(event)
      this.$emit('input', this.dragValue)
    },
    pointerUp() {
      if (this.dragValue === null) return
      this.$emit('change', this.dragValue)
      this.dragValue = null
    }
  }
}
</script>

<style scoped>
.k-slider {
  position: relative;
  height: 56px;
  flex: 1;
  touch-action: none;
}
.k-slider__track {
  position: absolute;
  left: 0;
  right: 0;
  top: 21px;
  height: 14px;
  border-radius: 4px;
  background: var(--color-track);
  overflow: hidden;
}
.k-slider__fill {
  height: 100%;
  background: var(--fill);
}
.k-slider__tick {
  position: absolute;
  top: 0;
  width: 3px;
  height: 100%;
  margin-left: -1.5px;
  background: var(--color-page);
}
.k-slider__thumb {
  position: absolute;
  top: 8px;
  width: 40px;
  height: 40px;
  margin-left: -20px;
  border-radius: 9999px;
  background: var(--fill);
  box-shadow: 0 0 0 4px var(--color-page);
}
</style>
