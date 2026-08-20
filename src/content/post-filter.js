/**
 * Glue: extracted post -> exceptions check -> analyze() -> UI action.
 * Nothing is persisted: no post text is written to storage at any point
 * (spec §15).
 */
import { analyze } from '../detector/scoring.js';
import { readPost, isProcessed, markProcessed } from './post-detector.js';
import { applyWarn, applyHide } from './ui.js';
import { stamp } from './debug.js';

/**
 * Posts the user has explicitly asked to see. Survives a rescan, unlike the
 * processed set: turning off the rule that drove a verdict does not guarantee
 * the remaining rules stay under the threshold, and a post the user just
 * un-hid must never collapse again underneath them.
 */
const alwaysShown = new WeakSet();

/** @param {Element} el */
export function markAlwaysShow(el) {
  if (el) alwaysShown.add(el);
}

/**
 * Process one candidate post element. Returns the analysis, or null when the
 * element was skipped for any reason.
 *
 * @param {Element} el
 * @param {Object} settings
 * @returns {import('../detector/scoring.js').Analysis | null}
 */
export function processPost(el, settings) {
  if (isProcessed(el) || alwaysShown.has(el)) return null;
  markProcessed(el);

  const debug = settings?.debug === true;

  const post = readPost(el);
  if (post.skip) {
    if (debug) stamp(el, post.skip);
    return null;
  }

  if (isExempt(post, settings)) {
    if (debug) stamp(el, 'exempt', post.author ?? '');
    return null;
  }

  const analysis = analyze(post.text, settings);
  if (analysis.verdict === 'warn') applyWarn(el, analysis);
  else if (analysis.verdict === 'hide') applyHide(el, analysis);

  // After the verdict, so the debug tag never blocks the real badge.
  if (debug) stamp(el, analysis.verdict, describeScore(analysis, post.text));

  return analysis;
}

/** Debug-only. Counts words the way features.js does, without re-tokenizing
 * the whole post, because the word count is what explains "too short to judge". */
function describeScore(analysis, text) {
  const words = text.match(/[a-z0-9']+/gi)?.length ?? 0;
  return `${words}w · score ${analysis.score} · ${analysis.reason}`;
}

/** Local whitelist check. User preference always beats the detector (spec §23). */
export function isExempt(post, settings) {
  const { authors = [], keywords = [] } = settings?.exceptions ?? {};

  if (post.author) {
    const author = post.author.toLowerCase();
    if (authors.some((name) => name && author.includes(name.toLowerCase()))) return true;
  }

  const text = post.text.toLowerCase();
  return keywords.some((word) => word && text.includes(word.toLowerCase()));
}
