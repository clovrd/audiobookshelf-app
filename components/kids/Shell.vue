<template>
  <div class="kids k-shell">
    <kids-mini-player v-if="hasSession && !playerOpen" />
    <transition name="k-player">
      <kids-player v-if="hasSession && playerOpen" />
    </transition>

    <kids-sleep-sheet v-if="sheet === 'sleep'" @close="closeSheet" />
    <kids-sheet v-else-if="sheet === 'light'" icon="brightness_6" title="Licht und Ton" @close="closeSheet">
      <kids-volume-row :row-height="88" />
      <kids-brightness-row :row-height="88" class="k-shell__brightness" />
    </kids-sheet>
    <kids-parent-sheet v-else-if="sheet === 'parent'" @close="closeSheet" @exit="exitKidsMode" />

    <transition name="k-hud">
      <div v-if="volumeHudVisible" class="k-hud">
        <span class="material-symbols fill" style="font-size: 32px">{{ volumeStep ? 'volume_up' : 'volume_off' }}</span>
        <div class="k-hud__bars">
          <span v-for="step in volumeMaxStep" :key="step" :class="{ on: step <= volumeStep }" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { AbsAudioPlayer, AbsDeviceControls } from '@/plugins/capacitor'
import { KIDS_MODE_KEY, isOwnVolumeChange, resetBrightness, restoreBrightness } from '@/utils/kidsDevice'

/**
 * Always mounted on kids pages (layouts/default.vue): mini player, player, sheets, volume HUD
 * and the listeners that keep store/kids.js up to date.
 */
export default {
  data() {
    return {
      listeners: [],
      timeInterval: null,
      volumeHudVisible: false,
      volumeHudTimeout: null
    }
  },
  computed: {
    hasSession() {
      return !!this.$store.state.currentPlaybackSession
    },
    playerOpen() {
      return this.$store.state.kids.playerOpen
    },
    sheet() {
      return this.$store.state.kids.sheet
    },
    volumeStep() {
      return this.$store.state.kids.volumeStep
    },
    volumeMaxStep() {
      return this.$store.state.kids.volumeMaxStep
    }
  },
  watch: {
    hasSession(hasSession) {
      if (!hasSession) this.$store.commit('kids/set', { playerOpen: false, currentTime: 0, sleepRemaining: 0 })
      this.updateTime()
    }
  },
  methods: {
    closeSheet() {
      this.$store.commit('kids/set', { sheet: null })
    },
    async updateTime() {
      if (!this.hasSession) return
      const data = await AbsAudioPlayer.getCurrentTime().catch(() => null)
      if (data && typeof data.value === 'number') this.$store.commit('kids/set', { currentTime: data.value })
    },
    onVolumeChanged({ step, maxStep }) {
      this.$store.commit('kids/set', { volumeStep: step, volumeMaxStep: maxStep })
      if (isOwnVolumeChange()) return
      this.volumeHudVisible = true
      clearTimeout(this.volumeHudTimeout)
      this.volumeHudTimeout = setTimeout(() => (this.volumeHudVisible = false), 1600)
    },
    onSleepTimerSet({ value }) {
      this.$store.commit('kids/set', { sleepRemaining: value || 0 })
    },
    onSleepTimerEnded() {
      this.$store.commit('kids/set', { sleepRemaining: 0 })
    },
    /** Android back button: close sheet, then player, then go home. Never leaves the kids mode. */
    onBack() {
      if (this.sheet) return this.closeSheet()
      if (this.playerOpen) return this.$store.commit('kids/set', { playerOpen: false })
      if (this.$route.path !== '/kids') this.$router.push('/kids')
    },
    async exitKidsMode() {
      await this.$localStore.setPreferenceByKey(KIDS_MODE_KEY, '0')
      this.$store.commit('kids/set', { sheet: null, playerOpen: false })
      this.$router.replace('/bookshelf')
    },
    async init() {
      await this.$localStore.setPreferenceByKey(KIDS_MODE_KEY, '1')
      restoreBrightness(this.$store, this.$localStore)

      const volume = await AbsDeviceControls.getVolume().catch(() => null)
      if (volume) this.$store.commit('kids/set', { volumeStep: volume.step, volumeMaxStep: volume.maxStep })

      this.listeners = await Promise.all([
        AbsDeviceControls.addListener('onVolumeChanged', this.onVolumeChanged),
        AbsAudioPlayer.addListener('onSleepTimerSet', this.onSleepTimerSet),
        AbsAudioPlayer.addListener('onSleepTimerEnded', this.onSleepTimerEnded)
      ])
      this.updateTime()
      this.timeInterval = setInterval(() => {
        if (this.$store.state.playerIsPlaying) this.updateTime()
      }, 1000)
    }
  },
  mounted() {
    this.$eventBus.$on('kids-back', this.onBack)
    this.init()
  },
  beforeDestroy() {
    this.$eventBus.$off('kids-back', this.onBack)
    clearInterval(this.timeInterval)
    clearTimeout(this.volumeHudTimeout)
    this.listeners.forEach((listener) => listener.remove())
    resetBrightness()
  }
}
</script>

<style src="~/assets/kids.css"></style>

<style scoped>
.k-shell {
  background: transparent;
}
.k-shell__brightness {
  border-top: 1px solid var(--color-line);
}
.k-hud {
  position: fixed;
  top: calc(24px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-radius: 10px;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
}
.k-hud__bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 32px;
}
.k-hud__bars span {
  width: 10px;
  height: 32px;
  border-radius: 2px;
  background: rgb(13 26 22 / 0.18);
}
.k-hud__bars span.on {
  background: var(--color-on-inverse);
}
.k-hud-enter-active,
.k-hud-leave-active {
  transition: opacity 140ms var(--ease);
}
.k-hud-enter,
.k-hud-leave-to {
  opacity: 0;
}
.k-player-enter-active,
.k-player-leave-active {
  transition: transform 220ms var(--ease), opacity 220ms var(--ease);
}
.k-player-enter,
.k-player-leave-to {
  transform: translateY(40px);
  opacity: 0;
}
</style>
