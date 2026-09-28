import { registerPlugin, WebPlugin } from '@capacitor/core'

// Browser preview only: volume is just remembered, brightness is imitated with a CSS filter
class AbsDeviceControlsWeb extends WebPlugin {
  constructor() {
    super()
    this.maxStep = 15
    this.step = 8
    this.brightness = null
  }

  volumeResult() {
    return { volume: Math.round((this.step / this.maxStep) * 100) / 100, step: this.step, maxStep: this.maxStep }
  }

  // PluginMethod
  async getVolume() {
    return this.volumeResult()
  }

  // PluginMethod
  async setVolume({ volume }) {
    const fraction = Math.min(1, Math.max(0, volume))
    this.step = fraction > 0 ? Math.max(1, Math.round(fraction * this.maxStep)) : 0
    return this.volumeResult()
  }

  // PluginMethod
  async setVolumeStep({ step }) {
    this.step = Math.min(this.maxStep, Math.max(0, step))
    return this.volumeResult()
  }

  // Preview helper to imitate the hardware volume buttons: window.AbsDeviceControlsWeb.pressVolume(+1)
  pressVolume(delta) {
    this.step = Math.min(this.maxStep, Math.max(0, this.step + delta))
    this.notifyListeners('onVolumeChanged', this.volumeResult())
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
  web: () => (window.AbsDeviceControlsWeb = new AbsDeviceControlsWeb())
})

export { AbsDeviceControls }
