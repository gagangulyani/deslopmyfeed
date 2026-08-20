import { signal, noSignal } from './rule.js';

/**
 * 6.6 Engagement formula. Deliberately weak — normal LinkedIn behavior.
 * Must never independently hide a post.
 *
 * Asking a question at the end of a post is what the platform is for. The score
 * here is capped low and the rule is not in STRONG_RULES, so scoring.js will not
 * let it contribute to a hide verdict no matter how the user weights it.
 */
const CAP = 0.6;

/** @type {import('./rule.js').Rule} */
export function engagement(features) {
  const text = features.raw ?? '';
  if (!text) return noSignal('engagement');

  const evidence = [];
  for (const pattern of CTA_PATTERNS) {
    const match = text.match(pattern);
    if (match) evidence.push(match[0].trim());
  }

  if (evidence.length === 0) return noSignal('engagement');

  return signal('engagement', evidence.length >= 2 ? CAP : CAP / 2, evidence);
}

export const CTA_PATTERNS = [
  /\bthoughts\?/i,
  /\bagree\?/i,
  /agree or disagree\?/i,
  /what would you add\?/i,
  /let me know( in the comments)?/i,
  /comment below/i,
  /(?:drop|share) (?:it |your |a )?(?:below|in the comments)/i,
  /what'?s your [^.?\n]{1,30}\?/i,
  /which one (?:are you|will you)/i,
  /👇/
];
