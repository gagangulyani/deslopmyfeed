/**
 * DOM layer. The only file that knows LinkedIn's markup.
 *
 * Contract: when the DOM does not match confidently, return null. Callers
 * treat null as "leave this element alone" (spec §22). LinkedIn's class names
 * are now build hashes (`_1d9c1239`), so they are not merely unstable, they
 * are unusable: they change on every deploy. Nothing here selects on a class.
 *
 * What it selects on instead, in order of how much LinkedIn would have to give
 * up to change it:
 *   1. `role="listitem"` inside `data-testid="mainFeed"` — the feed's
 *      accessibility structure, which a build-hash pipeline leaves alone.
 *   2. `componentkey*="FeedType_MAIN_FEED"` — LinkedIn's own feed-type token,
 *      opaque per post but with a stable suffix.
 *   3. The pre-2026 urn and class selectors, kept as a fallback.
 */

/** Ordered most-stable-first. */
export const POST_SELECTORS = [
  '[data-testid="mainFeed"] [role="listitem"]',
  '[componentkey*="FeedType_MAIN_FEED"]',
  'div[data-id^="urn:li:activity"]',
  'div[data-urn^="urn:li:activity"]',
  'div.feed-shared-update-v2'
];

const TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-inline-show-more-text'
];

/**
 * A post's own comment thread reuses the post's text container, so the first
 * match inside a post is not always the post. Anything under one of these is
 * somebody else's writing and must not be judged as the author's.
 */
const COMMENT_SELECTORS = [
  '[componentkey^="replaceableComment"]',
  '[data-testid*="commentList"]',
  '.comments-comment-item'
];

/** Controls belonging to LinkedIn. Their text is chrome, not post content. */
const TOGGLE_SELECTORS = [
  '[data-testid="expandable-text-button"]',
  '.feed-shared-inline-show-more-text__see-more-less-toggle',
  '.see-more',
  'button'
];

/** `aria-label` is where the author's plain name still appears. */
const AUTHOR_LABEL = /^View (.+?)[\u2019']s profile/;

const AUTHOR_SELECTORS = [
  '.update-components-actor__title',
  '.feed-shared-actor__title'
];

/** A post still ending in an ellipsis after the toggle is removed is truncated. */
const TRUNCATED = /(?:\u2026|\.\.\.)\s*$/;

let processed = new WeakSet();

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

  // A reshare is a post inside a post, and the selectors above deliberately
  // overlap — a post matches both the listitem and the componentkey rule. Keep
  // the outermost only, so each post is judged once, as the thing the user is
  // actually looking at.
  // Quadratic, over the handful of posts in one mutation batch.
  const all = [...found];
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

/** The post's own text container, never a commenter's. */
function findTextContainer(post) {
  const comments = COMMENT_SELECTORS.join(',');
  for (const selector of TEXT_SELECTORS) {
    for (const candidate of post.querySelectorAll(selector)) {
      if (!candidate.closest(comments)) return candidate;
    }
  }
  return null;
}

function findAuthor(post) {
  for (const el of post.querySelectorAll('[aria-label]')) {
    const match = AUTHOR_LABEL.exec(el.getAttribute('aria-label') ?? '');
    if (match) return match[1].trim() || null;
  }

  const legacy = firstMatch(post, AUTHOR_SELECTORS);
  if (legacy) return (legacy.textContent ?? '').trim() || null;

  // Last resort: the profile link's own text, which carries degree and
  // follow-state noise ("Navin Chaddha  • 2nd") that the exceptions check
  // tolerates because it matches on substrings.
  const link = post.querySelector('a[href*="/in/"], a[href*="/company/"]');
  if (!link) return null;
  return (link.innerText ?? link.textContent ?? '').split('\n')[0].trim() || null;
}

/**
 * Read a post, and say why when it cannot be read.
 *
 * The reason is split out because every skip looks identical to the caller,
 * which makes a stale selector indistinguishable from a post LinkedIn happened
 * to truncate. Only the diagnostics read `skip`; extractPost keeps the original
 * null-or-post contract.
 *
 * @param {Element} post
 * @returns {{ text: string|null, author: string|null, skip: null|'no text node'|'truncated' }}
 */
export function readPost(post) {
  const unreadable = (skip) => ({ text: null, author: null, skip });

  if (!post || typeof post.querySelector !== 'function') return unreadable('no text node');

  const container = findTextContainer(post);
  if (!container) return unreadable('no text node');

  // Read a copy so removing LinkedIn's own controls never mutates the page.
  const copy = container.cloneNode(true);
  for (const selector of TOGGLE_SELECTORS) {
    for (const toggle of copy.querySelectorAll(selector)) toggle.remove();
  }

  const text = (copy.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  if (!text) return unreadable('no text node');

  // "…more" clamps long posts visually, but the full text is in the DOM, so
  // this now fires rarely. When it does fire the visible text really is a
  // prefix, and judging an arbitrary prefix is worse than not judging. Clicking
  // the control to expand it is a LinkedIn interaction and forbidden (spec §19).
  if (TRUNCATED.test(text)) return unreadable('truncated');

  return { text, author: findAuthor(post), skip: null };
}

/**
 * @param {Element} post
 * @returns {{ text: string, author: string|null } | null}
 */
export function extractPost(post) {
  const read = readPost(post);
  return read.skip ? null : { text: read.text, author: read.author };
}

/** True if this element has already been processed in this page session. */
export function isProcessed(post) {
  return processed.has(post);
}

export function markProcessed(post) {
  processed.add(post);
}

/**
 * Forget every element. Used when settings change: the whole page has to be
 * judged again under the new configuration, and a WeakSet cannot be emptied.
 */
export function resetProcessed() {
  processed = new WeakSet();
}
