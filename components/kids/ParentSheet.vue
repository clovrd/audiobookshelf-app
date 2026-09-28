<template>
  <kids-sheet icon="lock_open" title="Für Eltern" @close="$emit('close')">
    <p class="k-parent__text">Kindermodus beenden und zur normalen Audiobookshelf-Ansicht wechseln.</p>
    <div class="k-parent__gate">
      <span class="num">{{ a }} × {{ b }} =</span>
      <input v-model="answer" class="k-parent__input num" type="text" inputmode="numeric" maxlength="3" autocomplete="off" />
    </div>
    <div class="k-parent__buttons">
      <button class="k-parent__button k-parent__button--primary" :disabled="!isCorrect" @click="$emit('exit')">Kindermodus beenden</button>
      <button class="k-parent__button" @click="$emit('close')">Abbrechen</button>
    </div>
  </kids-sheet>
</template>

<script>
const randomFactor = () => 6 + Math.floor(Math.random() * 4)

export default {
  data() {
    return {
      // Small adult gate so kids don't leave the kids mode by accident
      a: randomFactor(),
      b: randomFactor(),
      answer: ''
    }
  },
  computed: {
    isCorrect() {
      return Number(this.answer) === this.a * this.b
    }
  }
}
</script>

<style scoped>
.k-parent__text {
  font-size: 20px;
  line-height: 1.4;
  color: var(--color-ink-body);
}
.k-parent__gate {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  font-size: 32px;
  font-weight: 700;
}
.k-parent__input {
  width: 120px;
  height: 64px;
  padding: 0 16px;
  border: 2px solid var(--color-line-strong);
  border-radius: 6px;
  background: var(--color-sunken);
  color: var(--color-ink);
  font-size: 32px;
  font-weight: 700;
  outline: none;
  user-select: text;
}
.k-parent__buttons {
  display: flex;
  gap: 16px;
  margin-top: 32px;
}
.k-parent__button {
  height: 56px;
  padding: 0 28px;
  border: 1px solid var(--color-line-strong);
  border-radius: 6px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--color-ink);
}
.k-parent__button:active {
  background: var(--color-sunken);
}
.k-parent__button--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.k-parent__button--primary:active {
  background: var(--color-primary-press);
}
.k-parent__button:disabled {
  opacity: 0.4;
}
</style>
