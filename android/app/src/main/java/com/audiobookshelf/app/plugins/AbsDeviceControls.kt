package com.audiobookshelf.app.plugins

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.audiobookshelf.app.device.MediaVolume
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.pow
import org.json.JSONObject

/**
 * Volume and screen brightness for the kids UI.
 *
 * Volume is the device media volume (0.0-1.0), changes from hardware buttons or MQTT are sent as "onVolumeChanged".
 * Brightness only applies to this app's window while it is in the foreground, no permission needed.
 */
@CapacitorPlugin(name = "AbsDeviceControls")
class AbsDeviceControls : Plugin() {
  private val tag = "AbsDeviceControls"

  companion object {
    // Not public API but sent by the system on every volume change
    private const val VOLUME_CHANGED_ACTION = "android.media.VOLUME_CHANGED_ACTION"
    // Window brightness is linear, the slider value is perceptual like the system brightness slider
    private const val BRIGHTNESS_GAMMA = 2.2
    // Brightness 0 turns some screens almost off
    private const val MIN_LINEAR_BRIGHTNESS = 1f / 255f
  }

  private var lastVolumeStep: Int? = null

  private val volumeReceiver =
          object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
              val step = MediaVolume.getStep(context)
              if (step == lastVolumeStep) return
              lastVolumeStep = step
              notifyListeners("onVolumeChanged", volumeResult())
            }
          }

  override fun load() {
    lastVolumeStep = MediaVolume.getStep(context)
    ContextCompat.registerReceiver(context, volumeReceiver, IntentFilter(VOLUME_CHANGED_ACTION), ContextCompat.RECEIVER_EXPORTED)
  }

  override fun handleOnDestroy() {
    try {
      context.unregisterReceiver(volumeReceiver)
    } catch (e: Exception) {
      Log.w(tag, "Failed to unregister volume receiver: $e")
    }
  }

  /** { volume: 0.0-1.0, step: current step (0 = mute), maxStep: number of steps } */
  private fun volumeResult(): JSObject {
    val ret = JSObject()
    ret.put("volume", MediaVolume.get(context))
    ret.put("step", MediaVolume.getStep(context))
    ret.put("maxStep", MediaVolume.getMaxStep(context))
    return ret
  }

  @PluginMethod
  fun getVolume(call: PluginCall) {
    call.resolve(volumeResult())
  }

  @PluginMethod
  fun setVolume(call: PluginCall) {
    val volume = call.getDouble("volume") ?: return call.reject("volume is required")
    MediaVolume.set(context, volume)
    lastVolumeStep = MediaVolume.getStep(context)
    call.resolve(volumeResult())
  }

  /** Sets a volume step directly, 0 mutes */
  @PluginMethod
  fun setVolumeStep(call: PluginCall) {
    val step = call.getInt("step") ?: return call.reject("step is required")
    MediaVolume.setStep(context, step)
    lastVolumeStep = MediaVolume.getStep(context)
    call.resolve(volumeResult())
  }

  /** Returns { brightness: 0.0-1.0 } or { brightness: null } when following the system brightness */
  @PluginMethod
  fun getBrightness(call: PluginCall) {
    activity.runOnUiThread {
      val linear = activity.window.attributes.screenBrightness
      val ret = JSObject()
      if (linear < 0) {
        ret.put("brightness", JSONObject.NULL)
      } else {
        ret.put("brightness", linear.toDouble().pow(1 / BRIGHTNESS_GAMMA))
      }
      call.resolve(ret)
    }
  }

  /** { brightness: 0.0-1.0 } sets it for this app, { brightness: null } goes back to the system brightness */
  @PluginMethod
  fun setBrightness(call: PluginCall) {
    val brightness = if (call.data.isNull("brightness")) null else call.getDouble("brightness")
    activity.runOnUiThread {
      val attributes = activity.window.attributes
      attributes.screenBrightness =
              if (brightness == null) {
                WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
              } else {
                brightness.coerceIn(0.0, 1.0).pow(BRIGHTNESS_GAMMA).toFloat().coerceAtLeast(MIN_LINEAR_BRIGHTNESS)
              }
      activity.window.attributes = attributes
      call.resolve()
    }
  }
}
