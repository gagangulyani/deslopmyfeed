/**
 * Temporary diagnostics. Off by default, switched on from the popup.
 *
 * The extension is silent by design, which makes "nothing happened" ambiguous:
 * a stale post selector, a post truncated behind "…see more", and a post that
 * simply is not slop all look identical from the outside. With debug on, every
 * candidate post carries a visible tag naming the stage it reached and the
 * score it earned, so the failure has a name.
 *
 * Nothing here changes what gets filtered. It only makes the existing decision
 * visible.
 */
import { POST_SELECTORS } from './post-detector.js';

/** Kept distinct from the UI's artifact attribute so a debug tag on a post
 * never makes applyWarn/applyHide think the post is already decorated. */
export const DEBUG_ATTR = 'data-dsmf-debug';

const PREFIX = '[DeSlopMyFeed]';

/**
 * Stage -> what it means, in the order a post passes through them.
 * `tone` drives the colour: skipped (grey), analyzed and clean (blue),
 * flagged (amber).
 */
export const STAGES = {
  'no text node': 'skip',
  truncated: 'skip',
  exempt: 'skip',
  show: 'clean',
  warn: 'flag',
  hide: 'flag'
};

export function log(...args) {
  console.info(PREFIX, ...args);
}

/**
 * Count what each post selector matches on the current page. This is the
 * check that separates "the extension is not running" from "the extension is
 * running and LinkedIn's markup moved".
 */
export function probe(root = document) {
  const counts = {};
  for (const selector of POST_SELECTORS) {
    counts[selector] = root.querySelectorAll(selector).length;
  }
  log('post selectors:', counts);
  return counts;
}

/**
 * Tag one post with the stage it reached.
 *
 * @param {Element} post
 * @param {keyof STAGES} stage
 * @param {string} [detail]  Score, word count, or whatever names the reason.
 */
export function stamp(post, stage, detail = '') {
  if (!post || typeof post.prepend !== 'function') return null;

  const existing = post.querySelector(`[${DEBUG_ATTR}]`);
  if (existing) existing.remove();

  const tag = document.createElement('div');
  tag.className = `dsmf-debug dsmf-debug-${STAGES[stage] ?? 'skip'}`;
  tag.setAttribute(DEBUG_ATTR, stage);

  const label = document.createElement('span');
  label.className = 'dsmf-debug-stage';
  label.textContent = stage;
  tag.appendChild(label);

  if (detail) {
    const note = document.createElement('span');
    note.className = 'dsmf-debug-detail';
    // Post-derived. textContent, never markup.
    note.textContent = detail;
    tag.appendChild(note);
  }

  post.prepend(tag);
  return tag;
}

/** Remove every debug tag. Called when debug is switched back off. */
export function clearDebug(root = document) {
  for (const tag of root.querySelectorAll(`[${DEBUG_ATTR}]`)) tag.remove();
}
