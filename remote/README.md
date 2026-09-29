# ABS Remote

A small PWA for the parents' phones. It shows what each audiobookshelf tablet is playing and controls it over MQTT:
play/pause, jump, seek, volume/mute, sleep timer and stop. It uses the topics from [`../MQTT.md`](../MQTT.md).
Vanilla HTML/CSS/JS with no build step; [MQTT.js](https://github.com/mqttjs/MQTT.js) is vendored in `vendor/`.

Every device that publishes to the devices topic (default `audiobookshelf/+`) gets a card. It is found through
its retained `status`/`state`, so it appears as soon as the app has been connected once, even if it's offline now.

## 1. Broker: enable WebSockets

Browsers can't speak plain MQTT (TCP 1883), only MQTT over WebSockets. For Mosquitto, add a WebSocket listener next to
the existing one in `mosquitto.conf` and restart it:

```conf
listener 1883
listener 9001
protocol websockets
allow_anonymous false
password_file /mosquitto/config/password_file
```

`protocol` applies to the listener right above it. With the default `per_listener_settings false`,
`allow_anonymous` and `password_file` apply to both listeners, so the app uses the same users. In Docker, also
publish port 9001. The **Home Assistant Mosquitto add-on** already has one on
port **1884**.

## 2. Host it

### Docker + Caddy (HTTPS, installable)

Same setup as the scoreboard app. The container serves the static files on port 80 (published on 8081):

```sh
docker compose up -d --build
```

An `https://` page may only open `wss://` connections, so let Caddy also proxy the broker's WebSocket. The app's
default broker URL is `wss://<same host>/mqtt`:

```caddyfile
remote.example.com {
    import lan_only                          # optional, see below
    reverse_proxy /mqtt <broker-host>:9001
    reverse_proxy <app-host>:8081
}
```

Caddy tries the `/mqtt` proxy first (more specific path) and handles the WebSocket upgrade by itself. Mosquitto
accepts WebSocket connections on any path, so `/mqtt` doesn't need to be stripped.

Use two plain `reverse_proxy` lines, not `handle` blocks, if the site also has a `respond @blocked 403` style
IP filter: Caddy runs `handle` before `respond`, so the filter would never apply. Only expose this on the
internet if the broker requires a password (`allow_anonymous false`).

### Local network only

```sh
python3 serve.py          # or: python3 serve.py 8080
```

Open the printed `http://<ip>:8000` URL on the phone. Over plain http the default broker URL is
`ws://<same host>:9001`. The app works, but browsers only allow the service worker on https, so it can't be
installed as a real app or used offline.

## 3. Use

- On first start, enter the WebSocket URL, username/password and the devices topic. They are saved in the
  browser's `localStorage` on the phone, password included, so only save it on your own phone.
- The connection pill at the top shows the state (`Connected`, `Reconnecting…`, `Not authorized`, …); tap it to
  change the settings.
- The position counts up locally between the device's updates (every 10 s while playing).
- A device whose app is closed shows as **Offline** (the MQTT last will) with its last known state, and its
  controls are disabled.
- Coming back to the app asks every device for a fresh state.

## Icons

Pre-generated in `icons/`. To rebuild them (no dependencies):

```sh
python3 make_icons.py
```

## Updates

Same flow as the scoreboard: the service worker is network-first, and a new version shows an
"Update available" pill. Tapping it reloads into the new version. Bump `CACHE` in `sw.js` when the list of
files changes.
