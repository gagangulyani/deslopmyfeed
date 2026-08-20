import { extractFeatures } from './features.js';
import { templates } from './templates.js';
import { stacking } from './stacking.js';
import { genericity } from './genericity.js';
import { formatting } from './formatting.js';
import { vocabulary } from './vocabulary.js';
import { engagement } from './engagement.js';
import { hashtags } from './hashtags.js';

/** Rule id -> rule fn. Order is display order in the explanation panel. */
export const RULES = {
  templateStacking: stacking,
  genericity: genericity,
  formatting: formatting,
  templates: templates,
  vocabulary: vocabulary,
  engagement: engagement,
  hashtags: hashtags
};

/** Rules that are structural. Weak-only rules can never reach a hide verdict. */
export const STRONG_RULES = ['templateStacking', 'genericity', 'formatting', 'templates'];

export const MIN_WORDS_TO_ANALYZE = 50;
export const CONSERVATIVE_WORD_CEILING = 100;

/**
 * @typedef {Object} Analysis
 * @property {'show'|'warn'|'hide'} verdict
 * @property {number} score
 * @property {import('./rule.js').RuleResult[]} results  Triggered rules only.
 * @property {string} reason  Short, user-facing.
 */

/**
 * Run every enabled rule and combine into a verdict.
 *
 * Guard rails from the spec, enforced here and not inside individual rules:
 *  - <50 words: never filtered.
 *  - 50-100 words: conservative multiplier applied.
 *  - Hiding requires >=2 distinct triggered categories, one of them structural.
 *
 * @param {string} text
 * @param {Object} settings
 * @returns {Analysis}
 */
export function analyze(text, settings) {
  throw new Error('not implemented');
}
