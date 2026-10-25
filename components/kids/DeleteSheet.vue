<template>
  <kids-sheet icon="delete" title="Löschen?" @close="$emit('close')">
    <p class="k-delete__text">
      <template v-if="title">„{{ title }}“ vom Tablet löschen?</template>
      <template v-else-if="count === 1">Diese Folge vom Tablet löschen?</template>
      <template v-else><span class="num">{{ count }}</span> Folgen vom Tablet löschen?</template>
    </p>
    <p v-if="!kidsOnline" class="k-delete__hint">
      <span class="material-symbols" style="font-size: 22px">cloud_off</span>
      Ohne Internet kannst du sie erst wieder hören, wenn das Tablet Internet hat.
    </p>
    <div class="k-delete__buttons">
      <button class="k-delete__button k-delete__button--yes k-press" :disabled="deleting" @click="confirm">
        <span class="material-symbols" style="font-size: 32px">delete</span>
        Ja, löschen
      </button>
      <button class="k-delete__button k-delete__button--no k-press" :disabled="deleting" @click="$emit('close')">Nein</button>
    </div>
  </kids-sheet>
</template>

<script>
import kidsPlayback from '@/mixins/kidsPlayback'

export default {
  mixins: [kidsPlayback],
  data() {
    return {
      deleting: false
    }
  },
  computed: {
    request() {
      return this.$store.state.kids.deleteRequest || { ids: [], title: null }
    },
    title() {
      return this.request.title
    },
    count() {
      return this.request.ids.length
    }
  },
  methods: {
    async confirm() {
      if (this.deleting) return
      this.deleting = true
      await this.$hapticsImpact()
      await this.kidsDeleteDownloads(this.request.ids)
      this.deleting = false
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.k-delete__text {
  font-size: 24px;
  line-height: 1.35;
  font-weight: 600;
  color: var(--color-ink);
  overflow-wrap: anywhere;
}
.k-delete__hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 18px;
  color: var(--color-ink-muted);
}
.k-delete__buttons {
  display: flex;
  gap: 20px;
  margin-top: 32px;
}
.k-delete__button {
  flex: 1;
  height: 88px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 800;
}
.k-delete__button--yes {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
.k-delete__button--no {
  background: var(--color-cool);
  color: var(--color-ink);
}
.k-delete__button:disabled {
  opacity: 0.5;
}
</style>
