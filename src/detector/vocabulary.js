import { noSignal } from './rule.js';

/**
 * 6.5 Vocabulary clusters.
 * Scores co-occurrence across groups, never a single word.
 * @type {import('./rule.js').Rule}
 */
export function vocabulary(features, config) {
  return noSignal('vocabulary');
}

/** Seed dictionaries. Merged with user additions from chrome.storage.local. */
export const VOCABULARY_GROUPS = {
  corporateAbstraction: [
    'leverage', 'navigate', 'landscape', 'ecosystem', 'unlock', 'elevate', 'dynamic'
  ],
  inspiration: [
    'journey', 'mindset', 'growth', 'impact', 'meaningful', 'purpose', 'possibility'
  ],
  discourse: [
    'ultimately', 'more importantly', 'at its core', "it's worth noting", 'in today'
  ]
};
