import { signal, noSignal } from './rule.js';

/**
 * 6.4 Synthetic formatting.
 * Clusters only: one-line paragraph ratio, numbered advice blocks,
 * colon-led statements, em-dash density, repeated sentence shapes.
 *
 * Everything here is a ratio, never a count. A long post has more em dashes and
 * more short paragraphs than a short one without being any more synthetic, so
 * counting would make length itself the signal.
 */

/** Below this many paragraphs there is no ratio worth computing. */
const MIN_PARAGRAPHS = 5;
const MIN_SENTENCES = 6;

const FRAGMENT_MAX_WORDS = 14;
const FRAGMENT_RATIO = 0.5;
/** Above this, the whole post is one-line paragraphs: a layout, not a choice. */
const FRAGMENT_RATIO_STRONG = 0.7;
const COLON_RATIO = 0.25;
const EM_DASHES_PER_100_WORDS = 1.5;
const MIN_EM_DASHES = 2;
/** Uniform sentence lengths. Human prose varies far more than this. */
const MAX_LENGTH_VARIATION = 0.45;
const DECORATION = /[→👇✅🔥💡🚀]|^\s*(?:\d️⃣)/mu;

const wordsIn = (text) => (text.match(/[a-z0-9']+/gi) ?? []).length;

/** @type {import('./rule.js').Rule} */
export function formatting(features) {
  const { paragraphs = [], lines = [], sentences = [], wordCount = 0, emDashCount = 0 } = features;
  if (paragraphs.length < MIN_PARAGRAPHS) return noSignal('formatting');

  const evidence = [];
  // Weighted rather than counted: most sub-signals are worth one point, but a
  // post that is almost entirely one-line paragraphs has already made the
  // clustering argument by itself.
  let points = 0;

  const fragments = paragraphs.filter(
    (p) => !p.includes('\n') && wordsIn(p) <= FRAGMENT_MAX_WORDS
  );
  const fragmentRatio = fragments.length / paragraphs.length;
  if (fragmentRatio >= FRAGMENT_RATIO) {
    points += fragmentRatio >= FRAGMENT_RATIO_STRONG ? 2 : 1;
    evidence.push(`${fragments.length} of ${paragraphs.length} paragraphs are a single short line`);
  }

  const colonLed = lines.filter((l) => l.endsWith(':') || /^[^:\n]{2,30}:\s\S/.test(l));
  const colonRatio = lines.length ? colonLed.length / lines.length : 0;
  if (colonRatio >= COLON_RATIO) {
    points += 1;
    evidence.push(`${colonLed.length} of ${lines.length} lines are colon-led`);
  }

  const emDashDensity = wordCount ? (emDashCount / wordCount) * 100 : 0;
  if (emDashCount >= MIN_EM_DASHES && emDashDensity >= EM_DASHES_PER_100_WORDS) {
    points += 1;
    evidence.push(`${emDashCount} em dashes in ${wordCount} words`);
  }

  if (sentences.length >= MIN_SENTENCES) {
    const lengths = sentences.map(wordsIn);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length;
    const variation = mean ? Math.sqrt(variance) / mean : 0;
    if (variation <= MAX_LENGTH_VARIATION) {
      points += 1;
      evidence.push('sentence lengths barely vary');
    }
  }

  if (DECORATION.test(features.raw ?? '')) {
    points += 1;
    evidence.push('decorative arrows or emoji used as bullets');
  }

  // Cluster requirement: one weak sub-signal alone is a style, not a tell.
  if (points < 2) return noSignal('formatting');

  const score = { 2: 0.4, 3: 0.7 }[points] ?? 1;
  return signal('formatting', score, evidence);
}
