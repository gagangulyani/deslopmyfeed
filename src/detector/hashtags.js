import { signal, noSignal } from './rule.js';

/**
 * 6.7 Hashtag behavior. Weak signal — many legitimate users post hashtags.
 *
 * What separates a slop block from ordinary tagging is volume and genericity:
 * two topical tags is how people file a post, seven broad ones is packaging.
 */
const MIN_HASHTAGS = 3;
const STRONG_HASHTAGS = 5;
const CAP = 0.8;

/** Broad, audience-seeking tags rather than topical ones. */
const GENERIC_TAGS = new Set([
  'leadership', 'growthmindset', 'motivation', 'success', 'inspiration',
  'entrepreneurship', 'mindset', 'career', 'careergrowth', 'hiring',
  'futureofwork', 'productivity', 'innovation', 'culture', 'personalbranding',
  'business', 'management', 'networking', 'ai', 'startups'
]);

/** @type {import('./rule.js').Rule} */
export function hashtags(features) {
  const tags = features.hashtags ?? [];
  if (tags.length < MIN_HASHTAGS) return noSignal('hashtags');

  const generic = tags.filter((t) => GENERIC_TAGS.has(t));
  // Volume alone is not enough: a conference post can carry five topical tags.
  if (generic.length < 2) return noSignal('hashtags');

  const score = tags.length >= STRONG_HASHTAGS ? CAP : CAP / 2;
  return signal('hashtags', score, [`${tags.length} hashtags: ${tags.map((t) => `#${t}`).join(' ')}`]);
}
