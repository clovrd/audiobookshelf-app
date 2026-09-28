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
