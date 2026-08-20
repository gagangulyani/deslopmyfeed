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

/** Fired when the user asks to stop filtering posts like this one. Phase 6
 * listens for it; the UI layer does not touch storage itself. */
export const ALWAYS_SHOW_EVENT = 'dsmf-always-show';

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
function explanation(analysis) {
  const panel = el('div', 'dsmf-explain');
  panel.hidden = true;

  for (const result of analysis.results) {
    const item = el('div', 'dsmf-explain-item');
    item.appendChild(el('span', 'dsmf-explain-rule', RULE_LABELS[result.rule] ?? result.rule));
    for (const line of result.evidence.slice(0, 3)) {
      item.appendChild(el('span', 'dsmf-explain-evidence', line));
    }
    panel.appendChild(item);
  }

  return panel;
}

function alwaysShow(post, analysis) {
  return button('Always show similar', () => {
    post.dispatchEvent(
      new CustomEvent(ALWAYS_SHOW_EVENT, { bubbles: true, detail: { analysis } })
    );
    restore(post);
  });
}

/** @param {Element} post @param {import('../detector/scoring.js').Analysis} analysis */
export function applyWarn(post, analysis) {
  if (!post || post.querySelector(`[${ARTIFACT}]`)) return;

  const badge = el('div', 'dsmf-badge');
  badge.setAttribute(ARTIFACT, 'warn');
  badge.appendChild(el('span', 'dsmf-badge-label', 'Looks formulaic'));
  badge.appendChild(el('span', 'dsmf-badge-reason', analysis.reason));

  const panel = explanation(analysis);
  badge.appendChild(button('Why?', () => { panel.hidden = !panel.hidden; }));
  badge.appendChild(panel);

  post.prepend(badge);
}

/** @param {Element} post @param {import('../detector/scoring.js').Analysis} analysis */
export function applyHide(post, analysis) {
  if (!post || post.querySelector(`[${ARTIFACT}]`)) return;

  const card = el('div', 'dsmf-card');
  card.setAttribute(ARTIFACT, 'hide');
  card.appendChild(el('div', 'dsmf-card-title', 'Post hidden'));
  card.appendChild(el('div', 'dsmf-card-reason', `Hidden because: ${analysis.reason}`));

  const panel = explanation(analysis);
  const show = button('Show post', () => restore(post));
  show.classList.add('dsmf-primary');
  card.appendChild(show);
  card.appendChild(button('Why hidden?', () => { panel.hidden = !panel.hidden; }));
  card.appendChild(alwaysShow(post, analysis));
  card.appendChild(panel);

  post.classList.add(COLLAPSED);
  post.prepend(card);
}

/** Restore a collapsed post. Always available to the user (spec §10). */
export function restore(post) {
  if (!post) return;
  post.classList.remove(COLLAPSED);
  for (const artifact of post.querySelectorAll(`[${ARTIFACT}]`)) artifact.remove();
}

/** Remove every DeSlopMyFeed artifact from the page. */
export function clearAll(root = document) {
  for (const artifact of root.querySelectorAll(`[${ARTIFACT}]`)) {
    const post = artifact.closest(`.${COLLAPSED}`);
    if (post) post.classList.remove(COLLAPSED);
    artifact.remove();
  }
}
