/**
 * Glue: extracted post -> exceptions check -> analyze() -> UI action.
 * Nothing is persisted: no post text is written to storage at any point
 * (spec §15).
 */
import { analyze } from '../detector/scoring.js';
import { extractPost, isProcessed, markProcessed } from './post-detector.js';
import { applyWarn, applyHide } from './ui.js';

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

  const post = extractPost(el);
  if (!post) return null;

  if (isExempt(post, settings)) return null;

  const analysis = analyze(post.text, settings);
  if (analysis.verdict === 'warn') applyWarn(el, analysis);
  else if (analysis.verdict === 'hide') applyHide(el, analysis);

  return analysis;
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
