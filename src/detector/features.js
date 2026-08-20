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
 * @property {string|null} headline  Actor headline, when the DOM carried one.
 * @property {number|null} reactions Reaction count; null is "unknown", not zero.
 * @property {number|null} comments  Comment count; null is "unknown", not zero.
 * @property {boolean} hinglish      True when the text is not English, so the
 *                                   English-only rules must not score it.
 * @property {boolean} concreteContext True for a first-person account carrying
 *                                    multiple specific real-world anchors.
 */

const WORD = /[a-z0-9']+/gi;
const HASHTAG = /#([a-z0-9_]+)/gi;
const NUMBER = /(?:^|[^\w.])(\d[\d,]*(?:\.\d+)?)(?![\w.])/g;

/**
 * Romanized Hindi function words that never appear as standalone English
 * tokens. One stray marker means nothing (a quoted word); three distinct ones
 * mean the post is not English, and scoring it with English-only rules would
 * produce a confident-looking zero.
 */
const HINGLISH = new Set([
  'hai', 'hain', 'nahi', 'nahin', 'kya', 'kyun', 'bhai', 'yaar', 'bahut',
  'bohot', 'accha', 'acha', 'matlab', 'meri', 'mera', 'apna', 'apni',
  'humara', 'sabse', 'zyada', 'bilkul', 'ki', 'ka', 'ko', 'ke', 'se',
  'mein', 'aur', 'karo', 'karna'
]);
const HINGLISH_MINIMUM = 3;
const MONTH_OR_WEEKDAY = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|weekend)\b/i;
const FIRST_PERSON = /\b(?:i|i'm|i've|i'll|i'd|me|my|mine|we|we're|we've|our|ours)\b/gi;
const PROPER_NAME = /\b[A-Z][a-z]{2,}\b/g;
const COMMON_CAPITALIZED = new Set(['The', 'This', 'That', 'And', 'But', 'For', 'With', 'When', 'After', 'Then', 'What', 'How', 'If', 'So', 'You', 'Your', 'We', 'Our', 'I']);

/** Count of distinct Hinglish markers among the post's word tokens. */
function hinglishMarkers(words) {
  const found = new Set();
  for (const word of words) if (HINGLISH.has(word)) found.add(word);
  return found.size;
}

function hasConcreteContext(text) {
  const firstPerson = (text.match(FIRST_PERSON) ?? []).length >= 2;
  if (!firstPerson) return false;

  const names = new Set(
    (text.match(PROPER_NAME) ?? []).filter((word) => !COMMON_CAPITALIZED.has(word))
  );
  const hasNamedEntity = names.size >= 2;
  const hasTimeAnchor = MONTH_OR_WEEKDAY.test(text) || /\b\d{1,2}(?:st|nd|rd|th)\b/.test(text);
  const hasLink = /https?:\/\//i.test(text);

  return [hasNamedEntity, hasTimeAnchor, hasLink].filter(Boolean).length >= 2;
}

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
 * @param {string | {text?: string, headline?: string|null, reactions?: number|null, comments?: number|null}} post
 *   A bare string, as the corpus harness passes, or the object readPost returns.
 * @returns {PostFeatures}
 */
export function extractFeatures(post) {
  const input = typeof post === 'string' ? { text: post } : post ?? {};
  const raw = typeof input.text === 'string' ? input.text : '';
  // LinkedIn presentation glyphs such as mathematical bold letters otherwise
  // evade ASCII word matching and can turn a normal hook into a "0-word" one.
  const trimmed = raw.normalize('NFKC').trim();

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

  // Treat typographic dashes and double hyphens as the same separator signal.
  let emDashCount = 0;
  for (const ch of trimmed) if (ch === '—' || ch === '–') emDashCount += 1;
  for (const _ of trimmed.matchAll(/--/g)) emDashCount += 1;

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
    digitGroups,
    headline: typeof input.headline === 'string' ? input.headline.trim() || null : null,
    reactions: Number.isInteger(input.reactions) ? input.reactions : null,
    comments: Number.isInteger(input.comments) ? input.comments : null,
    hinglish: hinglishMarkers(words) >= HINGLISH_MINIMUM,
    concreteContext: hasConcreteContext(trimmed)
  };
}
