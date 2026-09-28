<template>
  <div class="k-sheet" @click.self="$emit('close')">
    <div class="k-sheet__panel">
      <div class="k-sheet__header">
        <span class="material-symbols" :class="{ fill: iconFilled }" style="font-size: 30px">{{ icon }}</span>
        <h2 class="k-sheet__title">{{ title }}</h2>
        <button class="k-btn k-btn--sunken k-sheet__close" @click="$emit('close')">
          <span class="material-symbols" style="font-size: 32px">close</span>
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    icon: String,
    iconFilled: Boolean,
    title: String
  }
}
</script>

<style scoped>
.k-sheet {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--color-scrim);
}
.k-sheet__panel {
  width: 100%;
  max-width: 760px;
  padding: 20px 32px calc(36px + env(safe-area-inset-bottom));
  background: var(--color-page);
  border-top: 3px solid var(--color-rule);
  border-radius: 10px 10px 0 0;
}
.k-sheet__header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.k-sheet__title {
  flex: 1;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.025em;
}
.k-sheet__close {
  width: 64px;
  height: 64px;
}
</style>
