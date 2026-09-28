<template>
  <span v-if="tokens" class="kids-syllable-text">
    <template v-for="(token, index) in tokens">
      <span v-if="token.syllables" :key="index" class="whitespace-nowrap">
        <span v-for="(syllable, syllableIndex) in token.syllables" :key="syllableIndex" :class="syllableIndex % 2 ? 'kids-syllable-b' : 'kids-syllable-a'">{{ syllable }}</span>
      </span>
      <template v-else>{{ token.text }}</template>
    </template>
  </span>
  <span v-else>{{ text }}</span>
</template>

<script>
import { toSyllables } from '@/utils/syllables'

/**
 * Text with alternating colored syllables ("Silbenfarben"), each word starts with the first color.
 * Colors come from the CSS variables --kids-syllable-a / --kids-syllable-b.
 */
export default {
  props: {
    text: String,
    // Manual syllables with "|", e.g. "Ra|di|o Rät|sel"
    override: String
  },
  data() {
    return {
      tokens: null
    }
  },
  watch: {
    text() {
      this.update()
    },
    override() {
      this.update()
    }
  },
  methods: {
    async update() {
      const text = this.text
      const override = this.override
      const tokens = await toSyllables(text, override).catch((error) => {
        console.error('[SyllableText] Failed to split syllables', error)
        return null
      })
      // Ignore results that finished after the text changed
      if (text === this.text && override === this.override) this.tokens = tokens
    }
  },
  mounted() {
    this.update()
  }
}
</script>

<style>
.kids-syllable-a {
  color: var(--kids-syllable-a, #4d8dff);
}
.kids-syllable-b {
  color: var(--kids-syllable-b, #ff5a5a);
}
</style>
