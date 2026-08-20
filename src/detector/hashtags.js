import { noSignal } from './rule.js';

/**
 * 6.7 Hashtag behavior. Weak signal — many legitimate users post hashtags.
 * @type {import('./rule.js').Rule}
 */
export function hashtags(features, config) {
  return noSignal('hashtags');
}
