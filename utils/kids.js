// Helpers for the kids UI (pages/kids)

/**
 * Kids UI settings ABS has no fields for are stored as "key: value" lines in the series description
 *
 * @param {string} description
 * @param {string} key
 * @returns {string|null}
 */
function parseDescriptionField(description, key) {
  if (!description) return null
  const text = description.replace(/<[^>]+>/g, '\n')
  const match = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, 'im'))
  return match ? match[1] : null
}

/**
 * Series logo, e.g. "logo: http://nas.local/logos/bibi-tina.png"
 *
 * @param {string} description
 * @returns {string|null}
 */
export function parseSeriesLogo(description) {
  return parseDescriptionField(description, 'logo')?.split(/\s/)[0] || null
}

// Set at build time, e.g. "https://files.example.com/abs-logos" (nuxt.config.js)
const LOGO_BASE_URL = (process.env.KIDS_LOGO_BASE_URL || '').trim().replace(/\/+$/, '')

const TRANSLITERATE = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', ø: 'oe', å: 'aa' }

/**
 * File name for a series logo: lowercase, German umlauts spelled out, everything else that isn't a letter or
 * digit becomes a single dash. "Bibi & Tina" -> "bibi-tina", "Die drei ???" -> "die-drei",
 * "Löwenzahn" -> "loewenzahn", "Pettersson und Findus" -> "pettersson-und-findus"
 *
 * @param {string} name
 * @returns {string}
 */
export function seriesSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[äöüßæøå]/g, (c) => TRANSLITERATE[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Logo of a series: "logo:" in the description wins, otherwise <KIDS_LOGO_BASE_URL>/<slug>.png when a base URL
 * was set at build time. Callers fall back to the first cover when the image doesn't load.
 *
 * @param {Object} series
 * @param {string} [description]
 * @returns {string|null}
 */
export function getSeriesLogoUrl(series, description) {
  const fromDescription = parseSeriesLogo(description)
  if (fromDescription) return fromDescription
  const slug = seriesSlug(series?.name)
  return LOGO_BASE_URL && slug ? `${LOGO_BASE_URL}/${slug}.png` : null
}

// Logo URLs that failed to load (usually 404: no logo for that series), skipped for the rest of the app session
const missingLogoUrls = new Set()

export function isLogoMissing(url) {
  return missingLogoUrls.has(url)
}

export function markLogoMissing(url) {
  missingLogoUrls.add(url)
}

/**
 * Manual syllables for the series name when the automatic ones are wrong, e.g. "silben: Schleich - Horse Club"
 *
 * @param {string} description
 * @returns {string|null}
 */
export function parseSeriesSyllables(description) {
  return parseDescriptionField(description, 'silben')
}

/**
 * Sequence of a book in a series, from whichever shape the API returned
 *
 * @param {Object} libraryItem
 * @param {string} seriesId
 * @returns {number|null}
 */
export function getSeriesSequence(libraryItem, seriesId) {
  const metadata = libraryItem?.media?.metadata || {}
  let sequence = null
  if (Array.isArray(metadata.series)) {
    sequence = (metadata.series.find((s) => s.id === seriesId) || metadata.series[0])?.sequence
  } else if (metadata.series) {
    sequence = metadata.series.sequence
  }
  if (sequence == null && libraryItem?.seriesSequence != null) {
    sequence = libraryItem.seriesSequence
  }
  if (sequence == null && metadata.seriesName) {
    // Minified items only have "Series Name #12"
    const match = metadata.seriesName.match(/#\s*([\d.]+)/)
    if (match) sequence = match[1]
  }
  const number = parseFloat(sequence)
  return isNaN(number) ? null : number
}

/**
 * Sorts by series sequence, books without a sequence go last sorted by title
 */
export function sortSeriesBooks(libraryItems, seriesId) {
  const title = (li) => li.media?.metadata?.title || ''
  return [...libraryItems].sort((a, b) => {
    const seqA = getSeriesSequence(a, seriesId)
    const seqB = getSeriesSequence(b, seriesId)
    if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB
    if (seqA !== null && seqB === null) return -1
    if (seqA === null && seqB !== null) return 1
    return title(a).localeCompare(title(b), undefined, { numeric: true, sensitivity: 'base' })
  })
}

// Series descriptions fetched for the logo and syllables, cached for the app session
const seriesDescriptionCache = new Map()

/**
 * The series list may not include descriptions, then the series is fetched once
 *
 * @param {Object} nativeHttp
 * @param {Object} series
 * @returns {Promise<string|null>}
 */
export async function loadSeriesDescription(nativeHttp, series) {
  if (!series) return null
  if (series.description !== undefined) return series.description

  if (!seriesDescriptionCache.has(series.id)) {
    const request = nativeHttp
      .get(`/api/series/${series.id}`)
      .then((fullSeries) => fullSeries?.description || null)
      .catch((error) => {
        console.error('[kids] Failed to load series', series.id, error)
        seriesDescriptionCache.delete(series.id)
        return null
      })
    seriesDescriptionCache.set(series.id, request)
  }
  return seriesDescriptionCache.get(series.id)
}

/**
 * The series of a book with its sequence. Full items have metadata.series, minified items only
 * seriesName like "Bibi und Tina #7, Other #2".
 *
 * @param {Object} libraryItem
 * @param {string} [seriesId] preferred series when the book is in several
 * @returns {{ id: string|null, name: string, sequence: string|null }|null}
 */
export function getItemSeries(libraryItem, seriesId = null) {
  const metadata = libraryItem?.media?.metadata || libraryItem?.mediaMetadata || {}
  if (Array.isArray(metadata.series) && metadata.series.length) {
    const series = metadata.series.find((s) => s.id === seriesId) || metadata.series[0]
    return { id: series.id, name: series.name, sequence: series.sequence ?? null }
  }
  if (metadata.series?.name) {
    return { id: metadata.series.id || null, name: metadata.series.name, sequence: metadata.series.sequence ?? null }
  }
  if (metadata.seriesName) {
    const match = metadata.seriesName.split(', ')[0].match(/^(.*?)(?:\s+#\s*(\S+))?$/)
    return { id: null, name: match[1], sequence: match[2] ?? null }
  }
  return null
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SEPARATORS = '\\s\\-–—:|,.·/'

/**
 * Removes the series name and episode number titles often start with, e.g.
 * "Bibi Blocksberg - Folge 12 - Hexen gibt es doch" or "012: Hexen gibt es doch (Bibi Blocksberg)"
 * both become "Hexen gibt es doch"
 *
 * @param {string} title
 * @param {string} [seriesName]
 * @param {number|string} [sequence]
 * @returns {string} empty when nothing but series name and number is left
 */
function stripSeriesFromTitle(title, seriesName, sequence) {
  let text = (title || '').trim()
  if (seriesName) {
    const name = escapeRegExp(seriesName.trim()).replace(/\s+/g, '\\s+')
    // Only when a separator or number follows, "Die drei ??? und der Karpatenhund" stays
    text = text.replace(new RegExp(`^${name}(?:\\s*(?=[#\\d])|\\s*[\\-–—:|,.·/][${SEPARATORS}]*|\\s*$)`, 'i'), '')
    text = text.replace(new RegExp(`[\\s\\-–—:|,]*[(\\[]\\s*${name}[^)\\]]*[)\\]]\\s*$`, 'i'), '')
  }
  // "Folge 12 -", "Episode 3:", "Teil 1.", "#12", "012 -"
  text = text.replace(new RegExp(`^(?:(?:folge|episode|teil|band|fall|nr\\.?|no\\.?)\\s*)?#?\\s*\\d+[a-z]?(?:[${SEPARATORS}]+|$)`, 'i'), (match) => {
    // A plain number only counts when it is the sequence ("1001 Nacht" stays)
    if (/^\s*#?\s*\d/.test(match) && sequence != null && parseFloat(match.replace('#', '')) !== parseFloat(sequence)) return match
    return ''
  })
  return text.replace(new RegExp(`^[${SEPARATORS}]+|[\\s\\-–—:|,]+$`, 'g'), '').trim()
}

/**
 * Episode title for the kids UI, without the series name and number that are shown anyway.
 * Falls back to the subtitle when the title is only the series name (album tag = series).
 *
 * @param {Object} libraryItem
 * @param {string} [seriesName]
 * @param {number|string} [sequence]
 * @returns {string}
 */
export function getEpisodeTitle(libraryItem, seriesName, sequence) {
  const metadata = libraryItem?.media?.metadata || {}
  return stripSeriesFromTitle(metadata.title, seriesName, sequence) || stripSeriesFromTitle(metadata.subtitle, seriesName, sequence)
}

/** Same for a title string, e.g. the playback session's displayTitle */
export function cleanEpisodeTitle(title, seriesName, sequence) {
  return stripSeriesFromTitle(title, seriesName, sequence)
}

/** 1234 -> "20:34", 4000 -> "1:06:40" */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Whole minutes, at least 1 */
export function toMinutes(seconds) {
  return Math.max(1, Math.round((seconds || 0) / 60))
}
