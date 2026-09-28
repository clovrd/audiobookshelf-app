# MQTT remote control (Android)

Lets a parent remotely see and control what a device is playing. Configure it in the app under
**Settings → Remote Control (MQTT)**: broker host, port (default 1883), optional username/password and a
base topic (default `audiobookshelf/<device model>`, use a distinct one per device, e.g. `audiobookshelf/kids_tablet`).
The settings page shows the connection status and the broker's error message (e.g. "Not authorized to connect").

The connection lives in the native player service, so it keeps working with the screen off while playing.
It is up while the app is open or audio is playing; when Android stops the player service the device goes `offline`.

## Topics

| Topic | Direction | Retained | Payload |
|---|---|---|---|
| `<base>/status` | device → broker | yes | `online` / `offline` (offline is also the last will) |
| `<base>/state` | device → broker | yes | JSON player state, see below |
| `<base>/cmd` | controller → device | no | JSON command, or just the action as plain text |

## Commands

`{"action": "<action>", "val": <number>}` (`value` is accepted as an alias of `val`), or plain text like `pause`.

| Action | `val` | Effect |
|---|---|---|
| `play` / `pause` / `toggle` | – | Resume / pause / toggle the current item |
| `stop` | – | Close the playback session (like closing the player) |
| `volume` | 0.0–1.0 or 0–100 | Set the device media volume |
| `volume_up` / `volume_down` | – | One volume step |
| `jump_forward` / `jump_backward` | seconds, optional | Jump; defaults to the app's jump setting |
| `seek` | seconds | Seek to an absolute position |
| `sleep_timer` | minutes | Start a sleep timer; `0` or no value cancels it |
| `state` | – | Republish the state now |

Commands that need something loaded (`play`, `seek`, ...) are ignored when nothing is loaded. Every command is answered with a fresh `state`.

## State

Published when something changes (play/pause, item, chapter, volume, speed, sleep timer on/off) and every 10 s while playing.

```json
{
  "state": "playing",            // idle | playing | paused | buffering | ended
  "playing": true,
  "volume": 0.47,                // device media volume 0.0–1.0
  "mediaPlayer": "exo-player",   // or "cast-player"
  "sessionId": "…",
  "libraryItemId": "…",
  "episodeId": null,
  "mediaType": "book",
  "title": "…",
  "author": "…",
  "isLocal": false,
  "chapter": "Chapter 3",
  "position": 1234.5,            // seconds
  "duration": 36000.0,           // seconds
  "remaining": 34765.5,          // seconds left in the book/episode, like "Your Progress" in the app
  "progress": 0.034,             // 0.0–1.0
  "speed": 1.0,
  "sleepTimerRemaining": 900,    // seconds, null when no timer
  "timestamp": 1759000000000
}
```

Only `state`, `playing`, `volume`, `mediaPlayer`, `sleepTimerRemaining` and `timestamp` are present when idle.

## Try it

```sh
mosquitto_sub -h <broker> -t 'audiobookshelf/#' -v
mosquitto_pub -h <broker> -t audiobookshelf/kids_tablet/cmd -m '{"action":"volume","val":0.3}'
mosquitto_pub -h <broker> -t audiobookshelf/kids_tablet/cmd -m pause
```
