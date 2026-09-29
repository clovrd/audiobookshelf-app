// Volume and brightness for the kids mode, shared by the player and the "Licht und Ton" sheet
import { AbsDeviceControls } from '@/plugins/capacitor'

export const MIN_BRIGHTNESS = 0.05
const BRIGHTNESS_KEY = 'kidsBrightness'

// Changes made on screen don't show the volume HUD
let ownVolumeChangeAt = 0

export function isOwnVolumeChange() {
  return Date.now() - ownVolumeChangeAt < 1000
}

export async function setVolumeStep(store, step) {
  ownVolumeChangeAt = Date.now()
  const result = await AbsDeviceControls.setVolumeStep({ step })
  store.commit('kids/set', { volumeStep: result.step, volumeMaxStep: result.maxStep })
}

// Unmuting goes back to the level before muting
let volumeStepBeforeMute = null

export async function toggleMute(store) {
  const { volumeStep } = store.state.kids
  if (volumeStep > 0) {
    volumeStepBeforeMute = volumeStep
    return setVolumeStep(store, 0)
  }
  return setVolumeStep(store, volumeStepBeforeMute || 5)
}

export async function setBrightness(store, localStore, brightness) {
  const value = Math.min(1, Math.max(MIN_BRIGHTNESS, brightness))
  store.commit('kids/set', { brightness: value })
  await AbsDeviceControls.setBrightness({ brightness: value })
  await localStore.setPreferenceByKey(BRIGHTNESS_KEY, String(value))
}

export async function restoreBrightness(store, localStore) {
  const saved = parseFloat(await localStore.getPreferenceByKey(BRIGHTNESS_KEY))
  const value = isNaN(saved) ? 1 : saved
  store.commit('kids/set', { brightness: value })
  await AbsDeviceControls.setBrightness({ brightness: value })
}

/** Back to the system brightness when leaving the kids mode */
export function resetBrightness() {
  return AbsDeviceControls.setBrightness({ brightness: null })
}
