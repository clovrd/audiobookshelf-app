# Kids UI (Android)

Side menu → **Kids**: series as square tiles, favorites (stored on the device), continue listening and a series page
with the books in series order.

## Series settings in the ABS description

ABS has no fields for these, so they are lines in the series description (ABS web UI → series → edit):

```
logo: http://server.local/logos/bibi-und-tina.png
silben: Schleich - Horse Club
```

| Line | Effect |
|---|---|
| `logo: <url>` | Square logo instead of the cover of the first book. Loaded with a plain HTTP GET by the tablet, so any web server in the network works. Transparent PNGs around 512×512 look best. |
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
