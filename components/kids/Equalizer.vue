<template>
  <span class="k-eq" :class="{ 'k-eq--paused': !playing }" aria-hidden="true">
    <span /><span /><span />
  </span>
</template>

<script>
export default {
  props: {
    playing: Boolean
  }
}
</script>

<style scoped>
.k-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 22px;
}
.k-eq span {
  width: 5px;
  height: 22px;
  border-radius: 1px;
  background: var(--color-cream-100);
  transform-origin: bottom;
  animation: k-eq-bar 900ms ease-in-out infinite;
}
.k-eq span:nth-child(2) {
  animation-delay: -300ms;
}
.k-eq span:nth-child(3) {
  animation-delay: -600ms;
}
.k-eq--paused span {
  animation-play-state: paused;
}
@keyframes k-eq-bar {
  0%,
  100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}
</style>
