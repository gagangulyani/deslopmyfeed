import { noSignal } from './rule.js';

/**
 * 6.6 Engagement formula. Deliberately weak — normal LinkedIn behavior.
 * Must never independently hide a post.
 * @type {import('./rule.js').Rule}
 */
export function engagement(features, config) {
  return noSignal('engagement');
}

export const CTA_PATTERNS = [
  /\bthoughts\?/i,
  /\bagree\?/i,
  /what would you add\?/i,
  /let me know/i,
  /comment below/i,
  /👇/
];
