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

/** The status panel. Separate attribute so clearDebug can drop the per-post
 * tags on a rescan without taking the panel down with them. */
export const HUD_ATTR = 'data-dsmf-hud';

const PREFIX = '[DeSlopMyFeed]';

/** Running tally of what each post was classified as, for the panel. */
let tally = Object.create(null);
let hudNote = '';

/**
 * Stage -> what it means, in the order a post passes through them.
 * `tone` drives the colour: skipped (grey), analyzed and clean (blue),
 * flagged (amber).
 */
export const STAGES = {
  'no text node': 'skip',
  truncated: 'skip',
  sponsored: 'skip',
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

  tally[stage] = (tally[stage] ?? 0) + 1;
  renderHud();

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

/** Remove every debug tag and the panel. Called when debug is switched off. */
export function clearDebug(root = document) {
  for (const tag of root.querySelectorAll(`[${DEBUG_ATTR}]`)) tag.remove();
  for (const hud of root.querySelectorAll(`[${HUD_ATTR}]`)) hud.remove();
  tally = Object.create(null);
  hudNote = '';
}

/**
 * A fixed panel in the corner of the page, independent of whether any post was
 * ever found.
 *
 * This is the piece the per-post tags cannot provide: if no post matches the
 * selectors, there is nothing to tag, and a stale selector looks exactly like
 * an extension that never loaded. The panel appears either way, so "no panel"
 * and "panel saying 0 posts" are different answers.
 *
 * @param {string} note  One line of context — route, mode, why it is idle.
 */
export function showHud(note) {
  hudNote = note;
  renderHud();
}

function renderHud() {
  if (typeof document === 'undefined' || !document.body) return null;

  let hud = document.querySelector(`[${HUD_ATTR}]`);
  if (!hud) {
    hud = document.createElement('div');
    hud.setAttribute(HUD_ATTR, '');
    hud.className = 'dsmf-hud';
    document.body.appendChild(hud);
  }

  const seen = Object.values(tally).reduce((a, b) => a + b, 0);
  const breakdown = Object.entries(tally)
    .map(([stage, n]) => `${stage} ${n}`)
    .join(' · ');

  hud.textContent = '';
  const title = document.createElement('strong');
  title.textContent = 'DeSlopMyFeed';
  hud.appendChild(title);
  hud.appendChild(line(hudNote));
  hud.appendChild(line(`${seen} post(s) seen`));
  if (breakdown) hud.appendChild(line(breakdown));
  return hud;
}

function line(text) {
  const node = document.createElement('div');
  node.textContent = text;
  return node;
}
