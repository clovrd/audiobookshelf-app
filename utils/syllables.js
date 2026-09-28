// Splits German text into syllables for "Silbenfarben" (alternating colored syllables for learning to read)
//
// Uses the German TeX hyphenation patterns, which are made for print and never split off a single letter.
// Spoken syllables do ("O|ma", "A|ben|teu|er", "Ra|di|o"), so those cases are split afterwards.

const LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿ'
const WORD_REGEX = new RegExp(`[${LETTERS}]+`, 'g')
const OVERRIDE_WORD_REGEX = new RegExp(`[${LETTERS}|]+`, 'g')
const VOWELS = 'aeiouäöüy'
// Consonant sounds written with several letters, never split
const CONSONANT_CLUSTERS = ['sch', 'ch', 'ck', 'ph', 'qu']
// Word endings with two vowels spoken as separate syllables: "Ra|di|o", "Ma|ri|a", "Ro|de|o"
const HIATUS_ENDING = new RegExp(`([^${VOWELS}q])([ie])([oa])$`, 'i')

let hyphenatorPromise = null

function loadHyphenator() {
  if (!hyphenatorPromise) {
    // Patterns are ~250 KB, only loaded when needed
    hyphenatorPromise = import(/* webpackChunkName: "hyphen-de" */ 'hyphen/de-1996').then((module) => (module.default || module).hyphenateSync)
  }
  return hyphenatorPromise
}

const isVowel = (char) => !!char && VOWELS.includes(char.toLowerCase())

/** "Oma" -> ["O", "ma"], "Abend" -> ["A", "bend"], "Ecke" -> ["E", "cke"] */
function splitLeadingVowel(syllable) {
  if (syllable.length < 3 || !isVowel(syllable[0])) return [syllable]
  const rest = syllable.slice(1).toLowerCase()
  const consonant = CONSONANT_CLUSTERS.find((c) => rest.startsWith(c)) || (isVowel(rest[0]) ? null : rest[0])
  if (!consonant || !isVowel(rest[consonant.length])) return [syllable]
  return [syllable[0], syllable.slice(1)]
}

/** "dio" -> ["di", "o"] */
function splitHiatusEnding(syllable) {
  if (syllable.length < 3 || !HIATUS_ENDING.test(syllable)) return [syllable]
  return [syllable.slice(0, -1), syllable.slice(-1)]
}

function splitWord(word, hyphenate) {
  let syllables = hyphenate(word, { hyphenChar: '|', minWordLength: 3 }).split('|')
  syllables = [...splitLeadingVowel(syllables[0]), ...syllables.slice(1)]
  return [...syllables.slice(0, -1), ...splitHiatusEnding(syllables[syllables.length - 1])]
}

/**
 * @typedef {{ text: string } | { syllables: string[] }} SyllableToken
 * Words have syllables, everything between words (spaces, punctuation, digits) is plain text
 */

function tokenize(text, wordRegex, splitter) {
  const tokens = []
  let lastIndex = 0
  for (const match of text.matchAll(wordRegex)) {
    if (match.index > lastIndex) tokens.push({ text: text.slice(lastIndex, match.index) })
    const syllables = splitter(match[0]).filter(Boolean)
    if (syllables.length) tokens.push({ syllables })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) })
  return tokens
}

/**
 * @param {string} text
 * @param {string} [override] manual syllables with "|", e.g. "Ra|di|o Rät|sel". Words without "|" stay one syllable.
 * @returns {Promise<SyllableToken[]>}
 */
export async function toSyllables(text, override = null) {
  if (override) {
    return tokenize(override, OVERRIDE_WORD_REGEX, (word) => word.split('|'))
  }
  if (!text) return []
  const hyphenate = await loadHyphenator()
  return tokenize(text, WORD_REGEX, (word) => splitWord(word, hyphenate))
}
