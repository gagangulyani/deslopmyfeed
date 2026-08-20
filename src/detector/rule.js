/**
 * The contract every rule module implements.
 *
 * `score` is a normalized strength in [0, 1] — how confident this rule is that
 * its pattern is present — NOT a point contribution. `scoring.js` multiplies it
 * by the user-configurable weight for the rule. Keeping the two separate is
 * what lets a user re-weight a rule without every rule needing to know about
 * thresholds.
 *
 * @typedef {Object} RuleResult
 * @property {string} rule       Rule id, e.g. "templateStacking".
 * @property {boolean} triggered
 * @property {number} score      Signal strength in [0, 1]. 0 when not triggered.
 * @property {string[]} evidence Human-readable fragments taken from the post.
 *
 * @typedef {(features: import('./features.js').PostFeatures, settings: Object) => RuleResult} Rule
 */

/**
 * @param {string} rule
 * @returns {RuleResult}
 */
export function noSignal(rule) {
  return { rule, triggered: false, score: 0, evidence: [] };
}

/**
 * Build a triggered result, clamping the score into the documented range so a
 * miscalibrated rule cannot blow past its weight.
 *
 * @param {string} rule
 * @param {number} score
 * @param {string[]} [evidence]
 * @returns {RuleResult}
 */
export function signal(rule, score, evidence = []) {
  const clamped = Math.min(1, Math.max(0, score));
  if (clamped === 0) return noSignal(rule);
  return { rule, triggered: true, score: clamped, evidence };
}
