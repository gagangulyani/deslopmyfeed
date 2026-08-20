/**
 * Presentation only. Collapses and restores posts, renders the warn badge and
 * the explanation panel. Never touches LinkedIn's own controls.
 *
 * Every string that came from a post is written with textContent, never as
 * markup. Post text is attacker-controlled input from the page and this is the
 * one place it gets rendered back into the DOM.
 */

import { RULE_LABELS } from '../detector/scoring.js';

/** Marks our own nodes so clearAll can find them without retaining references
 * to LinkedIn's recycled post elements. */
const ARTIFACT = 'data-dsmf-artifact';
const COLLAPSED = 'dsmf-hidden';
const WARNED = 'dsmf-warned';

/** Fired when the user asks to stop filtering posts like this one. Phase 6
 * listens for it; the UI layer does not touch storage itself. */
export const ALWAYS_SHOW_EVENT = 'dsmf-always-show';
export const FLAG_COUNT_EVENT = 'dsmf-flag-count';

function reportFlagCount(detail) {
  document.dispatchEvent(new CustomEvent(FLAG_COUNT_EVENT, { detail }));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick) {
  const node = el('button', 'dsmf-button', label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/**
 * Reasons are phrased as observations, never as a probability. "93% AI" is a
 * number the extension does not have (spec §7).
 */
const SUMMARY_LABELS = {
  vocabulary: 'vocabulary cues'
};

function summary(analysis) {
  return analysis.results
    .map((result) => SUMMARY_LABELS[result.rule] ?? RULE_LABELS[result.rule] ?? result.rule)
    .join(' + ');
}

function evidenceLine(line) {
  const hook = line.match(/^opens on a \d+-word hook:\s*(.+)$/i);
  if (hook) return `Opening hook: ${hook[1]}`;

  const beats = line.match(/^(\d+) one-line paragraphs used as beats$/i);
  if (beats) {
    const number = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][Number(beats[1])];
    return `${number ? number.charAt(0).toUpperCase() + number.slice(1) : beats[1]} one-line paragraphs`;
  }

  const dashes = line.match(/^(\d+) em dashes in (\d+) words$/i);
  if (dashes) return `${dashes[1]} em dashes across ${dashes[2]} words`;

  return line.charAt(0).toUpperCase() + line.slice(1);
}

function explanation(analysis) {
  const panel = el('div', 'dsmf-explain');

  for (const result of analysis.results) {
    for (const line of result.evidence) {
      panel.appendChild(el('span', 'dsmf-explain-evidence', evidenceLine(line)));
    }
  }

  return panel;
}

function patternDescription(analysis) {
  const rules = new Set(analysis.results.map((result) => result.rule));
  if (rules.has('templateStacking') && rules.has('formatting')) {
    return 'Short, formulaic post structure';
  }
  return 'Recurring formulaic cues';
}

function hiddenAuthor(author, avatarUrl) {
  const row = el('div', 'dsmf-hidden-author');
  if (avatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'dsmf-hidden-avatar';
    avatar.src = avatarUrl;
    avatar.alt = '';
    row.appendChild(avatar);
  }
  row.appendChild(el('span', 'dsmf-hidden-author-name', `${author || 'This author'}’s post was hidden`));
  return row;
}

function reasonPopover(analysis) {
  const popover = el('div', 'dsmf-reason-popover');
  popover.hidden = true;
  popover.appendChild(el('strong', 'dsmf-reason-title', 'Why this post was hidden'));
  popover.appendChild(el('span', 'dsmf-reason-label', 'Matched signals'));
  const list = el('ul', 'dsmf-reason-list');
  for (const result of analysis.results) {
    list.appendChild(el('li', '', SUMMARY_LABELS[result.rule] ?? RULE_LABELS[result.rule] ?? result.rule));
  }
  popover.appendChild(list);
  return popover;
}

function postContent(post) {
  return [...post.children].filter((child) => !child.matches('.dsmf-card, .dsmf-debug'));
}

function animateContent(post, from, to) {
  for (const node of postContent(post)) {
    if (typeof node.animate !== 'function') continue;
    node.animate([{ opacity: from, transform: `translateY(${from ? 0 : -4}px)` }, { opacity: to, transform: `translateY(${to ? 0 : -4}px)` }], {
      duration: 160,
      easing: 'ease-out',
      fill: 'both'
    });
  }
}

function setHidden(post, card, hidden) {
  const action = card.querySelector('.dsmf-primary');
  const label = card.querySelector('.dsmf-hidden-author-name');
  if (hidden) {
    animateContent(post, 1, 0);
    setTimeout(() => post.classList.add(COLLAPSED), 160);
    action.textContent = 'Show post';
    label.textContent = label.textContent.replace('is shown', 'was hidden');
    reportFlagCount({ delta: 1 });
  } else {
    post.classList.remove(COLLAPSED);
    animateContent(post, 0, 1);
    action.textContent = 'Hide post';
    label.textContent = label.textContent.replace('was hidden', 'is shown');
    reportFlagCount({ delta: -1 });
  }
}

/** @param {Element} post @param {import('../detector/scoring.js').Analysis} analysis @param {boolean} [showDetails] */
export function applyWarn(post, analysis, showDetails = false) {
  if (!post || post.querySelector(`[${ARTIFACT}]`)) return;

  // Warn mode is intentionally quiet. Keep an invisible marker so rescan and
  // duplicate prevention work, while showing the explanation only in Diagnostics.
  if (!showDetails) {
    const marker = el('span');
    marker.setAttribute(ARTIFACT, 'warn');
    marker.hidden = true;
    post.prepend(marker);
    reportFlagCount({ delta: 1 });
    return;
  }

  const badge = el('div', 'dsmf-badge dsmf-decision');
  badge.setAttribute(ARTIFACT, 'warn');
  badge.appendChild(el('span', 'dsmf-badge-label', 'Pattern detected'));
  badge.appendChild(el('span', 'dsmf-badge-reason', patternDescription(analysis)));
  badge.appendChild(explanation(analysis));

  post.classList.add(WARNED);
  post.prepend(badge);
  reportFlagCount({ delta: 1 });
}

/** @param {Element} post @param {import('../detector/scoring.js').Analysis} analysis @param {{author?: string|null, authorAvatar?: string|null, showDetails?: boolean}} [postInfo] */
export function applyHide(post, analysis, postInfo = {}) {
  if (!post || post.querySelector(`[${ARTIFACT}]`)) return;

  const card = el('div', 'dsmf-card dsmf-hidden-row');
  card.setAttribute(ARTIFACT, 'hide');
  card.appendChild(hiddenAuthor(postInfo.author, postInfo.authorAvatar));

  const popover = reasonPopover(analysis);
  const info = button('ⓘ', () => {
    popover.hidden = !popover.hidden;
    info.setAttribute('aria-expanded', String(!popover.hidden));
  });
  info.classList.add('dsmf-info-button');
  info.setAttribute('aria-label', 'Why this post was hidden');
  info.setAttribute('aria-expanded', 'false');
  card.appendChild(info);

  const show = button('Show post', () => setHidden(post, card, !post.classList.contains(COLLAPSED)));
  show.classList.add('dsmf-primary');
  card.appendChild(show);
  card.appendChild(popover);
  if (postInfo.showDetails) card.appendChild(explanation(analysis));

  post.classList.add(COLLAPSED);
  post.prepend(card);
  reportFlagCount({ delta: 1 });
}

/** Restore a collapsed post. Always available to the user (spec §10). */
export function restore(post) {
  if (!post) return;
  const wasFlagged =
    post.classList.contains(COLLAPSED) ||
    post.classList.contains(WARNED) ||
    Boolean(post.querySelector(`[${ARTIFACT}]`));
  post.classList.remove(COLLAPSED, WARNED);
  for (const artifact of post.querySelectorAll(`[${ARTIFACT}]`)) artifact.remove();
  if (wasFlagged) reportFlagCount({ delta: -1 });
}

/** Remove every DeSlopMyFeed artifact from the page. */
export function clearAll(root = document) {
  for (const artifact of root.querySelectorAll(`[${ARTIFACT}]`)) {
    const post = artifact.closest(`.${COLLAPSED}`) ?? artifact.parentElement;
    if (post) post.classList.remove(COLLAPSED, WARNED);
    artifact.remove();
  }
  reportFlagCount({ reset: true });
}
