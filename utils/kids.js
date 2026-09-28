// Helpers for the kids UI (pages/kids)

/**
 * Series logos are not stored by ABS, so they are referenced from the series description
 * with a line like "logo: http://nas.local/logos/bibi-tina.png"
 *
 * @param {string} description
 * @returns {string|null}
 */
export function parseSeriesLogo(description) {
  if (!description) return null
  const text = description.replace(/<[^>]+>/g, '\n')
  const match = text.match(/^\s*logo\s*:\s*(\S+)\s*$/im)
  return match ? match[1] : null
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

// Series descriptions fetched for the logo, cached for the app session
const seriesDescriptionCache = new Map()

/**
 * The series list may not include descriptions, then the series is fetched once
 *
 * @param {Object} nativeHttp
 * @param {Object} series
 * @returns {Promise<string|null>}
 */
export async function loadSeriesLogo(nativeHttp, series) {
  if (!series) return null
  if (series.description !== undefined) return parseSeriesLogo(series.description)

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
  return parseSeriesLogo(await seriesDescriptionCache.get(series.id))
}
