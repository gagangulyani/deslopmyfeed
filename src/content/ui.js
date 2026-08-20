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

  const badge = el('div', 'dsmf-badge dsmf-decision');
  badge.setAttribute(ARTIFACT, 'warn');
  badge.appendChild(el('span', 'dsmf-badge-label', 'Pattern detected'));
  badge.appendChild(el('span', 'dsmf-badge-reason', patternDescription(analysis)));

  badge.appendChild(explanation(analysis));

  post.classList.add(WARNED);
  post.prepend(badge);
  reportFlagCount({ delta: 1 });
}

/** @param {Element} post @param {import('../detector/scoring.js').Analysis} analysis */
export function applyHide(post, analysis) {
  if (!post || post.querySelector(`[${ARTIFACT}]`)) return;

  const card = el('div', 'dsmf-card');
  card.setAttribute(ARTIFACT, 'hide');
  card.appendChild(el('div', 'dsmf-card-title', 'Post hidden'));
  card.appendChild(el('div', 'dsmf-card-reason', summary(analysis)));

  const panel = explanation(analysis);
  const show = button('Show post', () => restore(post));
  show.classList.add('dsmf-primary');
  card.appendChild(show);
  card.appendChild(alwaysShow(post, analysis));
  card.appendChild(panel);

  post.classList.add(COLLAPSED);
  post.prepend(card);
  reportFlagCount({ delta: 1 });
}

/** Restore a collapsed post. Always available to the user (spec §10). */
export function restore(post) {
  if (!post) return;
  const wasFlagged = post.classList.contains(COLLAPSED) || post.classList.contains(WARNED);
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
