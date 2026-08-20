import { extractFeatures } from './features.js';
import { mergeSettings } from '../storage/settings.js';
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

/** Short user-facing names. No percentages, no invented precision (spec §7). */
export const RULE_LABELS = {
  templateStacking: 'template structure',
  genericity: 'low specificity',
  formatting: 'synthetic formatting',
  templates: 'stock phrasing',
  vocabulary: 'vocabulary clusters',
  engagement: 'engagement bait',
  hashtags: 'hashtag stacking'
};

export const MIN_WORDS_TO_ANALYZE = 50;
export const CONSERVATIVE_WORD_CEILING = 100;

/** Applied to posts between the floor and the ceiling. Short posts have less
 * evidence in them, so the same pattern density means less. */
export const CONSERVATIVE_MULTIPLIER = 0.7;

/** Sensitivity shifts both thresholds; it never changes weights. */
export const SENSITIVITY_OFFSETS = { low: 2, medium: 0, high: -2 };

/** Hiding requires this many distinct triggered rules, one of them structural. */
export const MIN_CATEGORIES_TO_HIDE = 2;

/**
 * @typedef {Object} Analysis
 * @property {'show'|'warn'|'hide'} verdict
 * @property {number} score
 * @property {import('./rule.js').RuleResult[]} results  Triggered rules only.
 * @property {string} reason  Short, user-facing.
 */

/** @returns {Analysis} */
function verdictShow(reason, results = [], score = 0) {
  return { verdict: 'show', score, results, reason };
}

function describe(results) {
  const names = results.map((r) => RULE_LABELS[r.rule] ?? r.rule);
  if (names.length === 0) return 'no patterns matched';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Run every enabled rule and combine into a verdict.
 *
 * Guard rails from the spec, enforced here and not inside individual rules:
 *  - <50 words: never filtered.
 *  - 50-100 words: conservative multiplier applied.
 *  - Hiding requires >=2 distinct triggered categories, one of them structural.
 *
 * @param {string} text
 * @param {Object} [settings]
 * @param {Record<string, import('./rule.js').Rule>} [rules]  Injectable for tests.
 * @returns {Analysis}
 */
export function analyze(text, settings, rules = RULES) {
  const config = mergeSettings(settings);

  if (!config.enabled || config.mode === 'off') {
    return verdictShow('filtering is off');
  }

  const features = extractFeatures(text);

  if (features.wordCount < MIN_WORDS_TO_ANALYZE) {
    return verdictShow('too short to judge');
  }

  const results = [];
  let total = 0;

  for (const [id, rule] of Object.entries(rules)) {
    if (config.rules[id] === false) continue;

    const result = rule(features, config);
    if (!result?.triggered || result.score <= 0) continue;

    results.push(result);
    total += Math.min(1, Math.max(0, result.score)) * (config.weights[id] ?? 0);
  }

  if (features.wordCount <= CONSERVATIVE_WORD_CEILING) {
    total *= CONSERVATIVE_MULTIPLIER;
  }

  const score = Math.round(total * 10) / 10;
  const offset = SENSITIVITY_OFFSETS[config.sensitivity] ?? 0;
  const warnAt = config.thresholds.warn + offset;
  const hideAt = config.thresholds.hide + offset;

  if (score < warnAt) {
    return verdictShow(describe(results), results, score);
  }

  const hasStrong = results.some((r) => STRONG_RULES.includes(r.rule));
  const canHide =
    results.length >= MIN_CATEGORIES_TO_HIDE && hasStrong && config.mode === 'hide';

  return {
    verdict: score >= hideAt && canHide ? 'hide' : 'warn',
    score,
    results,
    reason: describe(results)
  };
}
