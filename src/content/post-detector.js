/**
 * DOM layer. The only file that knows LinkedIn's markup.
 *
 * Contract: when the DOM does not match confidently, return null. Callers
 * treat null as "leave this element alone" (spec §22). LinkedIn's class names
 * are partly generated and will change; when they do, this file fails closed
 * and the extension does nothing rather than guessing at the markup.
 */

/** Ordered most-stable-first. The urn attributes outlived several redesigns. */
export const POST_SELECTORS = [
  'div[data-id^="urn:li:activity"]',
  'div[data-urn^="urn:li:activity"]',
  'div.feed-shared-update-v2'
];

const TEXT_SELECTORS = [
  '.update-components-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-inline-show-more-text'
];

const AUTHOR_SELECTORS = [
  '.update-components-actor__title',
  '.feed-shared-actor__title'
];

/** Controls belonging to LinkedIn. Their text is chrome, not post content. */
const TOGGLE_SELECTORS = [
  '.feed-shared-inline-show-more-text__see-more-less-toggle',
  '.see-more',
  'button'
];

/** A post still ending in an ellipsis after the toggle is removed is truncated. */
const TRUNCATED = /(?:…|\.\.\.)\s*$/;

const processed = new WeakSet();

function firstMatch(el, selectors) {
  for (const selector of selectors) {
    const found = el.querySelector(selector);
    if (found) return found;
  }
  return null;
}

/** @returns {Element[]} candidate post containers inside `root`. */
export function findPosts(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];

  const found = new Set();
  const selector = POST_SELECTORS.join(',');

  if (typeof root.matches === 'function' && root.matches(selector)) found.add(root);
  for (const el of root.querySelectorAll(selector)) found.add(el);

  // A reshare is a post inside a post. Keep the outermost only, so the quoted
  // post is judged as part of the thing the user is actually looking at.
  // Quadratic, over the handful of posts in one mutation batch.
  const all = [...found];
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

/**
 * @param {Element} post
 * @returns {{ text: string, author: string|null } | null}
 */
export function extractPost(post) {
  if (!post || typeof post.querySelector !== 'function') return null;

  const container = firstMatch(post, TEXT_SELECTORS);
  if (!container) return null;

  // Read a copy so removing LinkedIn's own controls never mutates the page.
  const copy = container.cloneNode(true);
  for (const selector of TOGGLE_SELECTORS) {
    for (const toggle of copy.querySelectorAll(selector)) toggle.remove();
  }

  const text = (copy.textContent ?? '').replace(/ /g, ' ').trim();
  if (!text) return null;

  // "…see more" collapses long posts. Clicking it is a LinkedIn control and
  // therefore forbidden (spec §19), and judging the visible fragment would mean
  // judging an arbitrary prefix. Unanalyzable is the honest answer.
  if (TRUNCATED.test(text)) return null;

  const authorEl = firstMatch(post, AUTHOR_SELECTORS);
  const author = authorEl ? (authorEl.textContent ?? '').trim() || null : null;

  return { text, author };
}

/** True if this element has already been processed in this page session. */
export function isProcessed(post) {
  return processed.has(post);
}

export function markProcessed(post) {
  processed.add(post);
}
