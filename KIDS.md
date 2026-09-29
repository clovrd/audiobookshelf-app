# Kids UI (Android)

Side menu → **Kids**: series as square tiles, favorites (stored on the device), continue listening and a series page
with the books in series order.

The app starts in the kids mode once a server is set up. Holding the clock for 3 seconds opens the parent sheet, which
leaves to the normal UI until the app is restarted (or the side menu → Kids is opened again).

Episode titles on the series page and in the player drop the series name and episode number they often start with
(`Bibi Blocksberg - Folge 12 - Hexen gibt es doch` → `Hexen gibt es doch`), since both are shown anyway. When nothing
else is left the subtitle is used.

## Series logos

Tiles show a square logo from `<KIDS_LOGO_BASE_URL>/<slug>.png`, falling back to the cover of the first book (in
series order) that has one when there is no logo. The tablet loads it with a plain HTTP GET, so any web server
works. Square PNGs around 512×512 look best: they fill the whole tile (other shapes are cropped to a square) and
transparent parts show a cream background.

The **slug** is the series name in lowercase, German umlauts spelled out (`ä` → `ae`, `ß` → `ss`), accents removed,
and everything that isn't a letter or digit replaced by a single `-`:

| Series name | File |
|---|---|
| Bibi Blocksberg | `bibi-blocksberg.png` |
| Bibi & Tina | `bibi-tina.png` |
| Die drei ??? Kids | `die-drei-kids.png` |
| Benjamin Blümchen | `benjamin-bluemchen.png` |
| Schleich - Horse Club | `schleich-horse-club.png` |

`scripts/kids-logos.sh <folder>` renames logos named after their series (`Bibi & Tina.jpg`) to these file names and
converts other formats to PNG (`-n` dry run, `-s 512` shrinks larger images, `-k` keeps the originals).

`KIDS_LOGO_BASE_URL` is set when the app is built, e.g. `https://files.example.com/abs-logos`:

- GitHub Actions: repository variable `KIDS_LOGO_BASE_URL` (Settings → Secrets and variables → Actions →
  Variables), used by `build-apk.yml` and `deploy-apk.yml`
- Local builds: `KIDS_LOGO_BASE_URL=https://files.example.com/abs-logos ./scripts/build-apk.sh`

Without it, the tiles always show the first cover. A logo that fails to load (404) isn't requested again until the
app restarts, so a newly uploaded logo shows up after restarting the app.

## Series settings in the ABS description

ABS has no field for these and its web UI can't edit series descriptions, so they can only be set through the API
(`PATCH /api/series/<id>` with `{"description": "…"}`). One `key: value` per line:

```
logo: http://server.local/logos/bibi-und-tina.png
silben: Schleich - Horse Club
```

| Line | Effect |
|---|---|
| `logo: <url>` | Logo for this series instead of `<KIDS_LOGO_BASE_URL>/<slug>.png`. |
| `silben: <text>` | Manual syllables for the colored series name when the automatic ones are wrong. Mark syllables with `\|` (`Ra\|di\|o Rät\|sel`), words without `\|` stay one syllable. |

## Colored syllables (Silbenfarben)

Series names are split into syllables with the German hyphenation patterns (`utils/syllables.js`) plus rules for
single-letter syllables (`O|ma`, `A|ben|teu|er`, `Ra|di|o`), then colored alternately starting with the first color
in every word. Colors are the CSS variables `--kids-syllable-a` / `--kids-syllable-b` (`components/kids/SyllableText.vue`).
English names are often wrong, use `silben:` for those.

## Volume and brightness

`AbsDeviceControls` (`plugins/capacitor/AbsDeviceControls.js`):

- `getVolume()` / `setVolume({ volume })`: device media volume 0.0–1.0 (same as the MQTT `volume` command, only 0 mutes).
  `addListener('onVolumeChanged', ({ volume }) => …)` fires on hardware buttons and MQTT changes too.
- `getBrightness()` / `setBrightness({ brightness })`: screen brightness 0.0–1.0 for this app only, while it is in the
  foreground; `null` goes back to the system brightness. No permission needed.

## Updating the app

Android only installs an update over an app signed with the same key, otherwise it has to be uninstalled first
(which deletes the server login, favorites and MQTT settings). Debug builds are signed with
`~/.android/debug.keystore` of the machine that builds them, so all builds have to use the same file:

- Local builds (`scripts/build-apk.sh`) use the build machine's `~/.android/debug.keystore`.
- GitHub Actions restores it from the repository secret `DEBUG_KEYSTORE_BASE64` (Settings → Secrets and variables →
  Actions → Secrets), the output of `base64 -w0 ~/.android/debug.keystore`, and signs with it through
  `ABS_DEBUG_KEYSTORE` (`android/app/build.gradle`; also usable for local builds with another file). The run log
  shows the APK's key in the "rename apk" step. Without the secret each run signs with a new random key and the
  build logs a warning.

Keep a backup of the keystore: GitHub secrets can't be read back, and without the file the next build can't update
the installed app anymore.
