import { registerPlugin, WebPlugin } from '@capacitor/core'

// Browser preview only: volume is just remembered, brightness is imitated with a CSS filter
class AbsDeviceControlsWeb extends WebPlugin {
  constructor() {
    super()
    this.volume = 0.5
    this.brightness = null
  }

  // PluginMethod
  async getVolume() {
    return { volume: this.volume }
  }

  // PluginMethod
  async setVolume({ volume }) {
    this.volume = Math.min(1, Math.max(0, volume))
    this.notifyListeners('onVolumeChanged', { volume: this.volume })
    return { volume: this.volume }
  }

  // PluginMethod
  async getBrightness() {
    return { brightness: this.brightness }
  }

  // PluginMethod
  async setBrightness({ brightness }) {
    this.brightness = brightness ?? null
    document.documentElement.style.filter = this.brightness === null ? '' : `brightness(${0.2 + 0.8 * this.brightness})`
  }
}

const AbsDeviceControls = registerPlugin('AbsDeviceControls', {
  web: () => new AbsDeviceControlsWeb()
})

export { AbsDeviceControls }
