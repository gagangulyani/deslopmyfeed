/**
 * Glue: extracted post -> exceptions check -> analyze() -> UI action.
 * Holds the in-memory analysis cache. Nothing is persisted.
 */

/**
 * @param {Element} el
 * @param {Object} settings
 */
export async function processPost(el, settings) {
  throw new Error('not implemented');
}

/** Local whitelist check. User preference always beats the detector (spec §23). */
export function isExempt(post, settings) {
  throw new Error('not implemented');
}
