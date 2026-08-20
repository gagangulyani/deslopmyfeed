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

/** Below this there is not enough text to say anything. */
export const SHORT_POST_FLOOR = 10;

/** Below this a post can be flagged but never hidden — little text, little evidence. */
export const MIN_WORDS_TO_ANALYZE = 50;
export const CONSERVATIVE_WORD_CEILING = 100;

/** Applied to posts between the floor and the ceiling. Short posts have less
 * evidence in them, so the same pattern density means less. */
export const CONSERVATIVE_MULTIPLIER = 0.7;

/**
 * Sensitivity shifts the flagging threshold; it never changes weights. At high
 * sensitivity it sits at 1.5, which is still above every human fixture's score.
 */
export const SENSITIVITY_OFFSETS = { low: 1.5, medium: 0, high: -1 };

/** Retained for rule taxonomy and diagnostics; user-selected score hiding does not require corroboration. */
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
 *  - <10 words: never judged at all.
 *  - 10-49 words: judged, but the verdict is capped at warn.
 *  - 50-100 words: conservative multiplier applied.
 *  - Non-English text: not scored — every rule is English-only.
 *  - Hiding requires >=2 distinct triggered categories, one of them structural.
 *
 * @param {string | Object} post  Bare text, or the object readPost returns.
 * @param {Object} [settings]
 * @param {Record<string, import('./rule.js').Rule>} [rules]  Injectable for tests.
 * @returns {Analysis}
 */
export function analyze(post, settings, rules = RULES) {
  const config = mergeSettings(settings);

  if (!config.enabled || config.mode === 'off') {
    return verdictShow('filtering is off');
  }

  const features = extractFeatures(post);

  // Every rule is English-only. Scoring other languages produces a
  // confident-looking zero, which is worse than saying nothing.
  if (features.hinglish) {
    return verdictShow('non-English text');
  }

  if (features.wordCount < SHORT_POST_FLOOR) {
    return verdictShow('too short to judge');
  }

  const results = [];
  let total = 0;

  for (const [id, rule] of Object.entries(rules)) {
    if (config.rules[id] === false) continue;

    const result = rule(features, config);
    if (!result?.triggered || result.score <= 0) continue;

    results.push(result);
    const adjustment = config.personalization.enabled ? (config.personalization.adjustments[id] ?? 0) : 0;
    const weight = Math.min(10, Math.max(0, (config.weights[id] ?? 0) + adjustment));
    total += Math.min(1, Math.max(0, result.score)) * weight;
  }

  if (features.wordCount <= CONSERVATIVE_WORD_CEILING) {
    total *= CONSERVATIVE_MULTIPLIER;
  }

  const score = Math.round(total * 10) / 10;
  const offset = SENSITIVITY_OFFSETS[config.sensitivity] ?? 0;
  const warnAt = config.thresholds.warn + offset;
  const hideAt = config.thresholds.hide;

  const anyMatch = config.hidePolicy === 'any-match' && results.length > 0;
  const onlyShortDash =
    features.wordCount < MIN_WORDS_TO_ANALYZE &&
    results.length === 1 &&
    results[0].rule === 'formatting' &&
    results[0].evidence.includes('short post uses a dash separator');

  if ((!anyMatch && score < warnAt) || onlyShortDash) {
    return verdictShow(describe(results), results, score);
  }

  // Little text is little evidence: a short post can be flagged, never hidden.
  if (features.wordCount < MIN_WORDS_TO_ANALYZE) {
    return { verdict: 'warn', score, results, reason: describe(results) };
  }

  const canHide =
    (anyMatch || score >= hideAt) &&
    !features.concreteContext &&
    config.mode === 'hide';

  return {
    // Hide mode collapses the same sufficiently corroborated patterns that
    // warn mode labels. A separate higher score made Hide feel non-functional.
    verdict: canHide ? 'hide' : 'warn',
    score,
    results,
    reason: describe(results)
  };
}
