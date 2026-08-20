/**
 * Shared, single-pass feature extraction.
 *
 * Every rule receives the same `PostFeatures` object so the post text is
 * tokenized once per post instead of once per rule. This is what keeps the
 * whole pipeline inside the <50ms/post budget.
 *
 * @typedef {Object} PostFeatures
 * @property {string} raw            Original visible text.
 * @property {string} lower          Lowercased text.
 * @property {string[]} lines        Non-empty lines, trimmed.
 * @property {string[]} paragraphs   Blocks separated by blank lines.
 * @property {string[]} sentences    Rough sentence split.
 * @property {string[]} words        Lowercased word tokens.
 * @property {number} wordCount
 * @property {string[]} hashtags     Hashtags, lowercased, without '#'.
 * @property {number} emDashCount
 * @property {number} digitGroups    Count of standalone number tokens.
 */

const WORD = /[a-z0-9']+/gi;
const HASHTAG = /#([a-z0-9_]+)/gi;
const NUMBER = /(?:^|[^\w.])(\d[\d,]*(?:\.\d+)?)(?![\w.])/g;

/**
 * Rough sentence split: a terminator followed by whitespace or end of text.
 * Abbreviations ("e.g.", "Dr.") will over-split. Every consumer of `sentences`
 * uses it for length distribution rather than exact boundaries, so the error
 * is noise in a ratio rather than a wrong answer.
 */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {PostFeatures}
 */
export function extractFeatures(text) {
  const raw = typeof text === 'string' ? text : '';
  const trimmed = raw.trim();

  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const words = trimmed.toLowerCase().match(WORD) ?? [];

  const hashtags = [];
  for (const match of trimmed.matchAll(HASHTAG)) {
    hashtags.push(match[1].toLowerCase());
  }

  let digitGroups = 0;
  for (const _ of trimmed.matchAll(NUMBER)) digitGroups += 1;

  let emDashCount = 0;
  for (const ch of trimmed) if (ch === '—') emDashCount += 1;

  return {
    raw: trimmed,
    lower: trimmed.toLowerCase(),
    lines,
    paragraphs,
    sentences: splitSentences(trimmed),
    words,
    wordCount: words.length,
    hashtags,
    emDashCount,
    digitGroups
  };
}
