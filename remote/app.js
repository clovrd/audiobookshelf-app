/* ABS Remote: shows and controls audiobookshelf-app devices over MQTT (see ../MQTT.md) */
'use strict';

const SETTINGS_KEY = 'absRemote.settings';
const MUTE_KEY = 'absRemote.volumeBeforeMute';
// The device publishes every 10 s while playing; interpolate the position between updates, but not forever
const MAX_INTERPOLATE_MS = 30000;
// After touching the volume slider, ignore incoming volume for a moment so it doesn't jump back
const VOLUME_HOLD_MS = 1500;

const $ = (sel, root = document) => root.querySelector(sel);
const devicesEl = $('#devices');
const emptyEl = $('#empty');
const connBtn = $('#conn');
const connLabel = $('#conn-label');
const settingsDialog = $('#settings');
const settingsForm = $('#settings-form');
const tpl = $('#device-tpl');

/* ---- Settings ---- */

function defaultUrl() {
  // Behind a reverse proxy the broker's WebSocket is expected at /mqtt on the same host
  if (location.protocol === 'https:') return `wss://${location.host}/mqtt`;
  return `ws://${location.hostname || 'localhost'}:9001`;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && saved.url) return saved;
  } catch {}
  return null;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function openSettings() {
  const s = settings || {};
  settingsForm.url.value = s.url || defaultUrl();
  settingsForm.username.value = s.username || '';
  settingsForm.password.value = s.password || '';
  settingsForm.topic.value = s.topic || 'audiobookshelf/+';
  settingsDialog.showModal();
}

$('#settings-btn').addEventListener('click', openSettings);
connBtn.addEventListener('click', openSettings);
$('#settings-cancel').addEventListener('click', () => settingsDialog.close());
settingsForm.addEventListener('submit', () => {
  settings = {
    url: settingsForm.url.value.trim(),
    username: settingsForm.username.value.trim(),
    password: settingsForm.password.value,
    topic: settingsForm.topic.value.trim().replace(/\/+$/, '') || 'audiobookshelf/+',
  };
  saveSettings(settings);
  connect();
});

/* ---- MQTT ---- */

let settings = loadSettings();
let client = null;
// base topic -> { base, status, state, receivedAt, el, volumeHeldUntil }
const devices = new Map();

function setConn(state, label) {
  connBtn.dataset.state = state;
  connLabel.textContent = label;
}

function connect() {
  if (client) {
    client.end(true);
    client = null;
  }
  devices.forEach((d) => d.el.remove());
  devices.clear();
  renderEmpty();
  if (!settings) {
    setConn('idle', 'Not set up');
    return;
  }

  setConn('connecting', 'Connecting…');
  const { url, username, password, topic } = settings;
  client = mqtt.connect(url, {
    username: username || undefined,
    password: password || undefined,
    clientId: `abs-remote-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
    clean: true,
  });

  client.on('connect', () => {
    setConn('connected', 'Connected');
    client.subscribe([`${topic}/status`, `${topic}/state`], { qos: 1 }, (err) => {
      if (err) setConn('error', `Subscribe failed: ${err.message}`);
    });
    renderEmpty();
  });
  client.on('reconnect', () => setConn('connecting', 'Reconnecting…'));
  client.on('offline', () => setConn('connecting', 'Offline, retrying…'));
  client.on('error', (err) => setConn('error', shortError(err)));
  client.on('message', onMessage);
}

function shortError(err) {
  const msg = (err && err.message) || String(err);
  if (/not authori[sz]ed|bad user/i.test(msg)) return 'Not authorized';
  return msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
}

function onMessage(topic, payload) {
  const slash = topic.lastIndexOf('/');
  const base = topic.slice(0, slash);
  const kind = topic.slice(slash + 1);
  const text = payload.toString();

  let device = devices.get(base);
  if (!text) {
    // A cleared retained message: forget that part, and the device when nothing is left
    if (!device) return;
    device[kind] = null;
    if (!device.status && !device.state) {
      device.el.remove();
      devices.delete(base);
      renderEmpty();
    } else render(device);
    return;
  }

  if (!device) device = addDevice(base);
  if (kind === 'status') {
    device.status = text.trim();
  } else if (kind === 'state') {
    try {
      device.state = JSON.parse(text);
      device.receivedAt = Date.now();
    } catch {
      return;
    }
  }
  render(device);
}

function send(device, action, val) {
  if (!client || !client.connected) return;
  const payload = val === undefined ? { action } : { action, val };
  client.publish(`${device.base}/cmd`, JSON.stringify(payload), { qos: 1 });
  if (navigator.vibrate) navigator.vibrate(10);
}

/* ---- Devices ---- */

function addDevice(base) {
  const el = tpl.content.firstElementChild.cloneNode(true);
  const device = { base, status: null, state: null, receivedAt: 0, el, volumeHeldUntil: 0, dragging: false };
  $('.device__name', el).textContent = base.split('/').pop().replace(/_/g, ' ');

  el.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'mute') return toggleMute(device);
      if (cmd === 'forget') return forgetDevice(device);
      if (cmd === 'stop' && !confirm('Stop playback on this device?')) return;
      send(device, cmd);
    });
  });
  el.querySelectorAll('[data-sleep]').forEach((btn) => {
    btn.addEventListener('click', () => send(device, 'sleep_timer', Number(btn.dataset.sleep)));
  });
  bindVolume(device);
  bindSeek(device);

  devices.set(base, device);
  // Keep the cards sorted by name
  const after = [...devices.values()].filter((d) => d !== device && d.base.localeCompare(base) > 0).sort((a, b) => a.base.localeCompare(b.base))[0];
  devicesEl.insertBefore(el, after ? after.el : null);
  renderEmpty();
  return device;
}

function bindVolume(device) {
  const slider = $('.volume__slider', device.el);
  let lastSent = 0;
  let timer = null;
  const sendNow = () => {
    clearTimeout(timer);
    timer = null;
    lastSent = Date.now();
    send(device, 'volume', Number(slider.value) / 100);
  };
  slider.addEventListener('input', () => {
    device.volumeHeldUntil = Date.now() + VOLUME_HOLD_MS;
    showVolume(device, Number(slider.value) / 100);
    // Throttled while dragging, the device answers every command with a state
    if (Date.now() - lastSent > 250) sendNow();
    else if (!timer) timer = setTimeout(sendNow, 250);
  });
  slider.addEventListener('change', () => {
    device.volumeHeldUntil = Date.now() + VOLUME_HOLD_MS;
    sendNow();
  });
}

function toggleMute(device) {
  const volume = device.state ? device.state.volume : null;
  if (volume == null) return;
  // The device's answer is the truth again, not the slider
  device.volumeHeldUntil = 0;
  if (volume > 0) {
    try {
      localStorage.setItem(`${MUTE_KEY}.${device.base}`, String(volume));
    } catch {}
    send(device, 'volume', 0);
  } else {
    let before = 0.3;
    try {
      before = Number(localStorage.getItem(`${MUTE_KEY}.${device.base}`)) || 0.3;
    } catch {}
    send(device, 'volume', before);
  }
}

/**
 * Clears the device's retained status and state on the broker. The broker passes the empty messages on to
 * us too, which removes the card (onMessage). If it doesn't, the user may not write to these topics.
 */
function forgetDevice(device) {
  if (!client || !client.connected) return;
  if (!confirm(`Forget ${device.base}?\n\nIt shows up again when that device connects to the broker.`)) return;
  client.publish(`${device.base}/status`, '', { qos: 1, retain: true });
  client.publish(`${device.base}/state`, '', { qos: 1, retain: true });
  setTimeout(() => {
    if (devices.get(device.base) === device) {
      alert(`The broker didn't clear ${device.base}. Does this MQTT user have write access to ${device.base}/#?`);
    }
  }, 3000);
}

function bindSeek(device) {
  const seek = $('.seek', device.el);
  const fraction = (e) => {
    const rect = seek.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };
  const duration = () => (device.state && device.state.duration) || 0;

  seek.addEventListener('pointerdown', (e) => {
    if (!duration() || seek.hasAttribute('aria-disabled')) return;
    seek.setPointerCapture(e.pointerId);
    device.dragging = fraction(e);
    seek.dataset.dragging = '';
    render(device);
  });
  seek.addEventListener('pointermove', (e) => {
    if (device.dragging === false) return;
    device.dragging = fraction(e);
    render(device);
  });
  const end = (e, commit) => {
    if (device.dragging === false) return;
    const f = e.type === 'pointerup' ? fraction(e) : device.dragging;
    device.dragging = false;
    delete seek.dataset.dragging;
    if (commit) {
      const target = f * duration();
      // Show the new position right away, the device confirms with a state
      if (device.state) {
        device.state.position = target;
        device.state.remaining = duration() - target;
        device.receivedAt = Date.now();
      }
      send(device, 'seek', Math.round(target));
    }
    render(device);
  };
  seek.addEventListener('pointerup', (e) => end(e, true));
  seek.addEventListener('pointercancel', (e) => end(e, false));
  seek.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    send(device, e.key === 'ArrowLeft' ? 'jump_backward' : 'jump_forward');
  });
}

/* ---- Rendering ---- */

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function formatAgo(ms) {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'Updated just now';
  if (s < 60) return `Updated ${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `Updated ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `Updated ${h} h ago`;
  return `Updated ${Math.round(h / 24)} days ago`;
}

/** Position and timers moved on since the last state while playing */
function live(device) {
  const st = device.state || {};
  const playing = st.state === 'playing';
  const elapsedMs = playing ? Math.min(Date.now() - device.receivedAt, MAX_INTERPOLATE_MS) : 0;
  const played = (elapsedMs / 1000) * (st.speed || 1);
  const duration = st.duration || 0;
  return {
    position: Math.min(duration || Infinity, (st.position || 0) + played),
    remaining: Math.max(0, (st.remaining != null ? st.remaining : duration - (st.position || 0)) - played),
    sleep: st.sleepTimerRemaining != null ? Math.max(0, st.sleepTimerRemaining - elapsedMs / 1000) : null,
  };
}

function showVolume(device, volume) {
  const el = device.el;
  const slider = $('.volume__slider', el);
  const percent = Math.round((volume || 0) * 100);
  if (document.activeElement !== slider || Date.now() > device.volumeHeldUntil) slider.value = percent;
  slider.style.setProperty('--fill', `${slider.value}%`);
  $('.volume__value', el).textContent = `${slider.value}%`;
  el.toggleAttribute('data-muted', Number(slider.value) === 0);
}

function render(device) {
  const { el } = device;
  const st = device.state || {};
  const offline = device.status === 'offline';
  const hasItem = !!st.libraryItemId || !!st.title;
  const playerState = offline ? 'offline' : st.state || (device.status === 'online' ? 'idle' : 'unknown');

  el.toggleAttribute('data-offline', offline);
  el.toggleAttribute('data-has-item', hasItem);
  el.toggleAttribute('data-playing', !!st.playing);

  const badge = $('.badge', el);
  badge.dataset.state = playerState;
  badge.textContent = {
    offline: 'Offline',
    playing: 'Playing',
    paused: 'Paused',
    buffering: 'Loading',
    ended: 'Finished',
    idle: 'Idle',
    unknown: '…',
  }[playerState] || playerState;

  // Offline devices can't receive commands, the retained state is only the last known one
  el.querySelectorAll('button:not(.link--forget), input').forEach((c) => (c.disabled = offline));
  el.querySelectorAll('.transport button, .chip, [data-cmd="stop"]').forEach((c) => (c.disabled = offline || !hasItem));
  $('.seek', el).toggleAttribute('aria-disabled', offline || !hasItem || !st.duration);

  if (hasItem) {
    $('.device__title', el).textContent = st.title || '';
    $('.device__author', el).textContent = st.author || '';
    $('.device__chapter', el).textContent = st.chapter || '';
  }

  if (!device.volumeHeldUntil || Date.now() > device.volumeHeldUntil) showVolume(device, st.volume);
  else showVolume(device, Number($('.volume__slider', el).value) / 100);

  tick(device);
}

/** The parts that move every second */
function tick(device) {
  const { el } = device;
  const st = device.state || {};
  const now = live(device);
  const duration = st.duration || 0;

  const position = device.dragging !== false ? device.dragging * duration : now.position;
  const remaining = device.dragging !== false ? duration - position : now.remaining;
  const percent = duration ? (position / duration) * 100 : 0;
  $('.seek__fill', el).style.width = `${percent}%`;
  $('.seek__thumb', el).style.left = `${percent}%`;
  $('.seek', el).setAttribute('aria-valuenow', Math.round(position));
  $('.times__pos', el).innerHTML = `<b>${formatTime(position)}</b> / ${formatTime(duration)}`;
  $('.times__rem', el).textContent = `−${formatTime(remaining)}`;

  el.toggleAttribute('data-sleep', now.sleep != null);
  $('.sleep__text', el).textContent = now.sleep != null ? `${Math.ceil(now.sleep / 60)} min` : 'Sleep';

  let updated = device.receivedAt ? formatAgo(Date.now() - device.receivedAt) : '';
  if (device.status === 'offline') updated = device.receivedAt ? updated.replace('Updated', 'Last seen') : 'Offline';
  $('.device__updated', el).textContent = updated;
}

function renderEmpty() {
  if (devices.size) {
    emptyEl.hidden = true;
    return;
  }
  emptyEl.hidden = false;
  if (!settings) {
    emptyEl.innerHTML = 'Connect to the MQTT broker the tablets report to.<br /><button class="btn btn--primary">Set up</button>';
    $('button', emptyEl).onclick = openSettings;
  } else {
    emptyEl.textContent = '';
    emptyEl.append(`No devices on ${settings.topic} yet. They show up once the app has connected to the broker.`);
  }
}

setInterval(() => devices.forEach(tick), 1000);

// Coming back to the app: ask every device for a fresh state
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') devices.forEach((d) => d.status !== 'offline' && send(d, 'state'));
});

/* ---- Init ---- */
connect();
if (!settings) openSettings();

if ('serviceWorker' in navigator) {
  const updateBtn = document.getElementById('update');
  const updateLabel = document.getElementById('update-label');

  // Tapping the pill activates the waiting worker, controllerchange then reloads into the new version
  const showUpdate = (worker) => {
    if (!updateBtn || !worker) return;
    updateBtn.hidden = false;
    updateBtn.onclick = () => {
      if (updateLabel) updateLabel.textContent = 'Updating…';
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  };

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register('./sw.js');
    } catch {
      return; // insecure context (plain http over LAN), the app still works
    }
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  });
}
