/**
 * The contract every rule module implements.
 *
 * @typedef {Object} RuleResult
 * @property {string} rule       Rule id, e.g. "templateStacking".
 * @property {boolean} triggered
 * @property {number} score      Contribution to the total. 0 when not triggered.
 * @property {string[]} evidence Human-readable fragments taken from the post.
 *
 * @typedef {(features: import('./features.js').PostFeatures, config: Object) => RuleResult} Rule
 */

/**
 * @param {string} rule
 * @returns {RuleResult}
 */
export function noSignal(rule) {
  return { rule, triggered: false, score: 0, evidence: [] };
}
