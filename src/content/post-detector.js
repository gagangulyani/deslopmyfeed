/**
 * DOM layer. The only file that knows LinkedIn's markup.
 *
 * Contract: when the DOM does not match confidently, return null. Callers
 * treat null as "leave this element alone" (spec §22).
 */

/** @returns {Element[]} candidate post containers inside `root`. */
export function findPosts(root) {
  throw new Error('not implemented');
}

/**
 * @param {Element} post
 * @returns {{ text: string, author: string|null } | null}
 */
export function extractPost(post) {
  throw new Error('not implemented');
}

/** True if this element has already been processed in this page session. */
export function isProcessed(post) {
  throw new Error('not implemented');
}

export function markProcessed(post) {
  throw new Error('not implemented');
}
