/**
 * Presentation only. Collapses and restores posts, renders the warn badge and
 * the explanation panel. Never touches LinkedIn's own controls.
 */

/** @param {Element} el @param {import('../detector/scoring.js').Analysis} analysis */
export function applyWarn(el, analysis) {
  throw new Error('not implemented');
}

/** @param {Element} el @param {import('../detector/scoring.js').Analysis} analysis */
export function applyHide(el, analysis) {
  throw new Error('not implemented');
}

/** Restore a collapsed post. Always available to the user (spec §10). */
export function restore(el) {
  throw new Error('not implemented');
}

/** Remove every DeSlopMyFeed artifact from the page. */
export function clearAll() {
  throw new Error('not implemented');
}
