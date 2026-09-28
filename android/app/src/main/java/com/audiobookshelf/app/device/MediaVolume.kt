package com.audiobookshelf.app.device

import android.content.Context
import android.media.AudioManager
import kotlin.math.roundToInt

/** Device media volume as 0.0-1.0, used by the kids UI and the MQTT remote */
object MediaVolume {
  private fun audioManager(context: Context) = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  /** Rounded to 2 decimals */
  fun get(context: Context): Double {
    val audioManager = audioManager(context)
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    if (max <= 0) return 0.0
    val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
    return (current.toDouble() / max * 100).roundToInt() / 100.0
  }

  /**
   * Sets the nearest volume step. The media stream only has a few steps, so only 0 mutes:
   * any value above 0 is at least the lowest audible step instead of rounding down to mute.
   */
  fun set(context: Context, volume: Double) {
    val audioManager = audioManager(context)
    val fraction = volume.coerceIn(0.0, 1.0)
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    val index = if (fraction > 0) (fraction * max).roundToInt().coerceAtLeast(1) else 0
    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
  }

  fun adjust(context: Context, raise: Boolean) {
    val direction = if (raise) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
    audioManager(context).adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, 0)
  }
}
