/**
 * Shared, single-pass feature extraction.
 *
 * Every rule receives the same `PostFeatures` object so the post text is
 * tokenized once per post instead of once per rule. This is what keeps the
 * whole pipeline inside the <50ms/post budget.
 *
 * @typedef {Object} PostFeatures
 * @property {string} raw            Original visible text.
 * @property {string} lower          Lowercased text.
 * @property {string[]} lines        Non-empty lines, trimmed.
 * @property {string[]} paragraphs   Blocks separated by blank lines.
 * @property {string[]} sentences    Rough sentence split.
 * @property {string[]} words        Lowercased word tokens.
 * @property {number} wordCount
 * @property {string[]} hashtags     Hashtags, lowercased, without '#'.
 * @property {number} emDashCount
 * @property {number} digitGroups    Count of standalone number tokens.
 */

/**
 * @param {string} text
 * @returns {PostFeatures}
 */
export function extractFeatures(text) {
  throw new Error('not implemented');
}
