package com.audiobookshelf.app.player

import android.annotation.SuppressLint
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import com.audiobookshelf.app.device.DeviceManager
import com.audiobookshelf.app.device.MediaVolume
import com.audiobookshelf.app.plugins.AbsLogger
import com.google.android.exoplayer2.Player
import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.IMqttToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * MQTT remote control for the player.
 *
 * Topics (base topic is configurable in settings):
 *   <base>/status  retained "online" / "offline" (offline is also the last will)
 *   <base>/state   retained JSON snapshot of the player
 *   <base>/cmd     commands, JSON {"action": "...", "val": ...} or a plain action string
 *
 * Lives as long as PlayerNotificationService. All player access happens on the main thread.
 */
class MqttRemote(private val service: PlayerNotificationService) {
  private val tag = "MqttRemote"

  companion object {
    private const val STATE_TICK_MS = 1000L
    private const val PLAYING_STATE_INTERVAL_MS = 10000L
    private const val CONNECT_RETRY_MS = 30000L

    fun defaultBaseTopic(): String {
      val model = Build.MODEL.lowercase().replace(Regex("[^a-z0-9_-]+"), "_").trim('_')
      return "audiobookshelf/${model.ifEmpty { "device" }}"
    }
  }

  private data class Config(
          val serverUri: String,
          val username: String?,
          val password: String?,
          val baseTopic: String,
          val clientId: String
  ) {
    val statusTopic get() = "$baseTopic/status"
    val stateTopic get() = "$baseTopic/state"
    val commandTopic get() = "$baseTopic/cmd"
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile private var client: MqttAsyncClient? = null
  private var config: Config? = null

  /** Connection status shown in the settings: disabled, connecting, connected, disconnected or error */
  @Volatile var status = "disabled"
    private set
  @Volatile var statusMessage: String? = null
    private set
  val baseTopic get() = config?.baseTopic
  private var lastStateKey: String? = null
  private var lastStatePublishedAt = 0L
  private var hasLoggedConnectFailure = false

  private val stateTicker =
          object : Runnable {
            override fun run() {
              publishStateIfChanged(false)
              mainHandler.postDelayed(this, STATE_TICK_MS)
            }
          }

  /** (Re)applies the MQTT settings. Safe to call repeatedly, e.g. after settings changes. */
  fun reconfigure() {
    val newConfig = buildConfig()
    if (newConfig == config && client != null) return

    stop()
    if (newConfig == null) {
      setStatus("disabled", null)
      return
    }

    config = newConfig
    connect(newConfig)
    mainHandler.post(stateTicker)
  }

  fun stop() {
    mainHandler.removeCallbacksAndMessages(null)
    val oldClient = client ?: return
    val oldConfig = config
    client = null
    config = null
    lastStateKey = null

    // A clean disconnect suppresses the last will, so publish "offline" ourselves.
    // Done off the main thread because we wait for the broker.
    Thread {
      try {
        if (oldClient.isConnected && oldConfig != null) {
          oldClient.publish(oldConfig.statusTopic, "offline".toByteArray(), 1, true).waitForCompletion(1000)
          oldClient.disconnect(500).waitForCompletion(2000)
        }
      } catch (e: Exception) {
        Log.w(tag, "Error during disconnect: $e")
      }
      try {
        oldClient.close(true)
      } catch (e: Exception) {
        Log.w(tag, "Error closing client: $e")
      }
    }.start()
  }

  @SuppressLint("HardwareIds")
  private fun buildConfig(): Config? {
    val settings = DeviceManager.deviceData.deviceSettings ?: return null
    if (settings.mqttEnabled != true) return null
    val host = settings.mqttHost?.trim().orEmpty()
    if (host.isEmpty()) return null

    val port = settings.mqttPort ?: 1883
    val baseTopic = settings.mqttBaseTopic?.trim()?.trimEnd('/')?.ifEmpty { null } ?: defaultBaseTopic()
    val androidId = Settings.Secure.getString(service.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"

    return Config(
            serverUri = "tcp://$host:$port",
            username = settings.mqttUsername?.ifEmpty { null },
            password = settings.mqttPassword?.ifEmpty { null },
            baseTopic = baseTopic,
            clientId = "abs-$androidId"
    )
  }

  private fun connect(cfg: Config) {
    val newClient =
            try {
              MqttAsyncClient(cfg.serverUri, cfg.clientId, MemoryPersistence())
            } catch (e: Exception) {
              AbsLogger.error(tag, "Invalid MQTT server ${cfg.serverUri}: $e")
              setStatus("error", "Invalid server ${cfg.serverUri}")
              return
            }
    client = newClient
    setStatus("connecting", cfg.serverUri)

    newClient.setCallback(
            object : MqttCallbackExtended {
              override fun connectComplete(reconnect: Boolean, serverURI: String?) {
                AbsLogger.info(tag, "Connected to $serverURI (reconnect=$reconnect), base topic ${cfg.baseTopic}")
                mainHandler.post { hasLoggedConnectFailure = false }
                setStatus("connected", serverURI, newClient)
                onConnected(newClient, cfg)
              }

              override fun connectionLost(cause: Throwable?) {
                Log.w(tag, "Connection lost: $cause")
                setStatus("disconnected", describe(cause), newClient)
              }

              override fun messageArrived(topic: String?, message: MqttMessage?) {
                val payload = message?.payload?.let { String(it) } ?: return
                mainHandler.post { if (client === newClient) handleCommand(payload) }
              }

              override fun deliveryComplete(token: IMqttDeliveryToken?) {}
            }
    )

    val options =
            MqttConnectOptions().apply {
              isAutomaticReconnect = true
              isCleanSession = true
              keepAliveInterval = 60
              connectionTimeout = 10
              maxReconnectDelay = 60000
              setWill(cfg.statusTopic, "offline".toByteArray(), 1, true)
              cfg.username?.let { userName = it }
              cfg.password?.let { password = it.toCharArray() }
            }

    tryConnect(newClient, options)
  }

  /** Automatic reconnect only kicks in after a first successful connect, so retry that ourselves. */
  private fun tryConnect(target: MqttAsyncClient, options: MqttConnectOptions) {
    if (client !== target) return
    try {
      target.connect(
              options,
              null,
              object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {}

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                  setStatus("error", describe(exception), target)
                  val message = "Connecting to ${target.serverURI} failed: $exception. Retrying every ${CONNECT_RETRY_MS / 1000}s"
                  mainHandler.post {
                    // Only the first failure goes to the in-app log to avoid flooding it while the broker is down
                    if (!hasLoggedConnectFailure) AbsLogger.error(tag, message) else Log.w(tag, message)
                    hasLoggedConnectFailure = true
                    mainHandler.postDelayed({ tryConnect(target, options) }, CONNECT_RETRY_MS)
                  }
                }
              }
      )
    } catch (e: Exception) {
      AbsLogger.error(tag, "Connect error: $e")
    }
  }

  /** Updates the status, ignoring callbacks from a client that was already replaced */
  private fun setStatus(newStatus: String, message: String?, from: MqttAsyncClient? = null) {
    if (from != null && from !== client) return
    status = newStatus
    statusMessage = message
  }

  /** e.g. "Unable to connect to server: Connection refused" or "Not authorized to connect" */
  private fun describe(error: Throwable?): String? {
    if (error == null) return null
    return listOfNotNull(error.message, error.cause?.message).distinct().joinToString(": ").ifEmpty { error.toString() }
  }

  private fun onConnected(connectedClient: MqttAsyncClient, cfg: Config) {
    try {
      connectedClient.subscribe(cfg.commandTopic, 1)
      connectedClient.publish(cfg.statusTopic, "online".toByteArray(), 1, true)
    } catch (e: Exception) {
      Log.e(tag, "Error subscribing/publishing after connect: $e")
    }
    mainHandler.post { if (client === connectedClient) publishStateIfChanged(true) }
  }

  /** Returns the normalized action and optional numeric value, or null if the payload is invalid. */
  private fun parseCommand(payload: String): Pair<String, Double?>? {
    val trimmed = payload.trim()
    if (!trimmed.startsWith("{")) return normalizeAction(trimmed) to null

    return try {
      val json = JSONObject(trimmed)
      val key = if (json.has("val")) "val" else "value"
      val value = if (json.has(key) && !json.isNull(key)) json.optDouble(key).takeUnless { it.isNaN() } else null
      normalizeAction(json.optString("action")) to value
    } catch (e: Exception) {
      Log.e(tag, "Invalid command payload '$trimmed': $e")
      null
    }
  }

  private fun normalizeAction(action: String) = action.trim().lowercase().replace('-', '_')

  private fun handleCommand(payload: String) {
    val (action, value) = parseCommand(payload) ?: return
    Log.d(tag, "Command '$action' value=$value")
    val session = service.currentPlaybackSession

    when (action) {
      "play" -> if (session != null) service.play()
      "pause" -> if (session != null) service.pause()
      "toggle", "play_pause" -> if (session != null) service.playPause()
      "stop" -> if (session != null) service.closePlayback()
      // Accepts 0.0-1.0, or 0-100 as a percentage
      "volume" -> value?.let { MediaVolume.set(service, if (it > 1.0) it / 100.0 else it) }
      "volume_up" -> MediaVolume.adjust(service, true)
      "volume_down" -> MediaVolume.adjust(service, false)
      "jump_forward" ->
              if (session != null) {
                if (value != null) service.seekForward((value * 1000).toLong()) else service.jumpForward()
              }
      "jump_backward" ->
              if (session != null) {
                if (value != null) service.seekBackward((value * 1000).toLong()) else service.jumpBackward()
              }
      "seek" -> if (session != null && value != null) service.seekPlayer((value * 1000).toLong())
      "sleep_timer" ->
              if (session != null) {
                val minutes = value ?: 0.0
                if (minutes > 0) {
                  service.sleepTimerManager.setManualSleepTimer(session.id, (minutes * 60000).toLong(), false)
                } else {
                  service.sleepTimerManager.cancelSleepTimer()
                }
              }
      "state", "refresh" -> {}
      else -> Log.w(tag, "Unknown command '$action'")
    }

    // Always answer with a fresh state so the controller sees the effect (or lack of one)
    mainHandler.postDelayed({ publishStateIfChanged(true) }, 300)
  }

  private fun buildState(): JSONObject {
    val state = JSONObject()
    val session = service.currentPlaybackSession
    val player = service.currentPlayer

    val status =
            when {
              session == null -> "idle"
              player.playbackState == Player.STATE_ENDED -> "ended"
              player.playbackState == Player.STATE_BUFFERING && player.playWhenReady -> "buffering"
              player.isPlaying -> "playing"
              else -> "paused"
            }
    state.put("state", status)
    state.put("playing", player.isPlaying)
    state.put("volume", MediaVolume.get(service))
    state.put("mediaPlayer", service.getMediaPlayer())

    if (session != null) {
      state.put("sessionId", session.id)
      state.put("libraryItemId", session.libraryItemId ?: JSONObject.NULL)
      state.put("episodeId", session.episodeId ?: JSONObject.NULL)
      state.put("mediaType", session.mediaType)
      state.put("title", session.displayTitle ?: JSONObject.NULL)
      state.put("author", session.displayAuthor ?: JSONObject.NULL)
      state.put("isLocal", session.isLocal)
      state.put("chapter", service.getCurrentBookChapter()?.title ?: JSONObject.NULL)
      // Remaining and progress are computed like the item page's "Your Progress" (not speed adjusted)
      val position = service.getCurrentTimeSeconds()
      val duration = session.getTotalDuration()
      state.put("position", (position * 10).roundToInt() / 10.0)
      state.put("duration", duration)
      state.put("remaining", (maxOf(duration - position, 0.0) * 10).roundToInt() / 10.0)
      state.put("progress", if (duration > 0) ((position / duration).coerceIn(0.0, 1.0) * 1000).roundToInt() / 1000.0 else 0.0)
      state.put("speed", player.playbackParameters.speed.toDouble())
    }

    val sleepRemaining = service.sleepTimerManager.getSleepTimerRemainingSeconds()
    state.put("sleepTimerRemaining", if (sleepRemaining > 0) sleepRemaining else JSONObject.NULL)
    state.put("timestamp", System.currentTimeMillis())
    return state
  }

  /**
   * Publishes the retained state when something meaningful changed, or periodically while playing
   * so the position stays fresh. Position and sleep countdown alone don't count as a change.
   */
  private fun publishStateIfChanged(force: Boolean) {
    val activeClient = client ?: return
    val cfg = config ?: return
    if (!activeClient.isConnected) return

    val state =
            try {
              buildState()
            } catch (e: Exception) {
              Log.e(tag, "Failed to build state: $e")
              return
            }

    val key =
            listOf("state", "sessionId", "chapter", "volume", "speed", "mediaPlayer")
                    .joinToString("|") { state.opt(it)?.toString() ?: "" } +
                    "|" + state.isNull("sleepTimerRemaining")
    val now = System.currentTimeMillis()
    val periodicDue = state.optBoolean("playing") && now - lastStatePublishedAt >= PLAYING_STATE_INTERVAL_MS
    if (!force && key == lastStateKey && !periodicDue) return

    try {
      activeClient.publish(cfg.stateTopic, state.toString().toByteArray(), 0, true)
      lastStateKey = key
      lastStatePublishedAt = now
    } catch (e: Exception) {
      Log.w(tag, "Failed to publish state: $e")
    }
  }
}
