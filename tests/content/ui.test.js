// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyWarn, applyHide, restore, clearAll, ALWAYS_SHOW_EVENT, HIDDEN_COUNT_EVENT
} from '../../src/content/ui.js';

const analysis = (verdict = 'warn') => ({
  verdict,
  score: 3.2,
  reason: 'template structure and synthetic formatting',
  results: [
    { rule: 'templateStacking', triggered: true, score: 0.75, evidence: ['3 enumerated items'] },
    { rule: 'formatting', triggered: true, score: 0.7, evidence: ['7 of 9 paragraphs are a single short line'] }
  ]
});

function post(text = 'Post body') {
  const el = document.createElement('div');
  el.innerHTML = '<div class="content"></div>';
  el.querySelector('.content').textContent = text;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('warn', () => {
  it('adds a badge without removing anything', () => {
    const el = post('Original body');
    applyWarn(el, analysis());
    expect(el.querySelector('.dsmf-badge')).not.toBeNull();
    expect(el.querySelector('.content').textContent).toBe('Original body');
    expect(el.classList.contains('dsmf-hidden')).toBe(false);
  });

  it('states a compact reason without inventing a number', () => {
    const el = post();
    applyWarn(el, analysis());
    const badge = el.querySelector('.dsmf-badge').textContent;
    expect(badge).toContain('Formulaic pattern detected');
    expect(badge).toContain('template structure + synthetic formatting');
    expect(badge).not.toMatch(/\d+(\.\d+)?%/);
  });

  it('keeps the explanation collapsed until asked', () => {
    const el = post();
    applyWarn(el, analysis());
    const panel = el.querySelector('.dsmf-explain');
    expect(panel.hidden).toBe(true);
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Why it was flagged ›').click();
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.dsmf-explain-item').textContent).toContain('Short hook');
    expect(panel.querySelector('.dsmf-explain-item').textContent).not.toContain('3 enumerated items');
    expect(panel.querySelector('summary').textContent).toBe('Show technical details');
  });

  it('uses user-facing rule labels and keeps raw vocabulary hits technical', () => {
    const el = post();
    const vocabulary = {
      ...analysis(),
      results: [{ rule: 'vocabulary', triggered: true, score: 0.5, evidence: ['navigate', 'journey'] }]
    };
    applyWarn(el, vocabulary);
    const panel = el.querySelector('.dsmf-explain');
    const visible = panel.querySelector('.dsmf-explain-item').textContent;
    expect(visible).toContain('vocabulary cues');
    expect(visible).toContain('Generic business language detected');
    expect(visible).not.toContain('navigate');
    expect(panel.querySelector('.dsmf-technical').open).toBe(false);
  });

  it('does not decorate the same post twice', () => {
    const el = post();
    applyWarn(el, analysis());
    applyWarn(el, analysis());
    expect(el.querySelectorAll('.dsmf-badge')).toHaveLength(1);
  });
});

describe('hide', () => {
  it('collapses the post and offers a way back', () => {
    const el = post();
    applyHide(el, analysis('hide'));
    expect(el.classList.contains('dsmf-hidden')).toBe(true);
    expect([...el.querySelectorAll('button')].map((b) => b.textContent))
      .toEqual(expect.arrayContaining(['Show post', 'Always show similar']));
  });

  it('states why the post was hidden and expands the supporting evidence', () => {
    const el = post();
    applyHide(el, analysis('hide'));
    expect(el.querySelector('.dsmf-card-reason').textContent)
      .toBe('template structure + synthetic formatting');

    const panel = el.querySelector('.dsmf-explain');
    expect(panel.hidden).toBe(true);
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Why it was hidden ›').click();
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Repeated short paragraphs');
  });

  it('reports hidden-count changes when a post hides and restores', () => {
    const el = post();
    const changes = [];
    document.addEventListener(HIDDEN_COUNT_EVENT, (event) => changes.push(event.detail));
    applyHide(el, analysis('hide'));
    restore(el);
    expect(changes).toEqual([{ delta: 1 }, { delta: -1 }]);
  });

  it('restores the post to exactly what it was', () => {
    const el = post('Untouched body');
    const before = el.innerHTML;
    applyHide(el, analysis('hide'));
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Show post').click();
    expect(el.innerHTML).toBe(before);
    expect(el.classList.contains('dsmf-hidden')).toBe(false);
  });

  it('announces "always show similar" instead of writing settings itself', () => {
    const el = post();
    applyHide(el, analysis('hide'));
    const seen = [];
    document.addEventListener(ALWAYS_SHOW_EVENT, (e) => seen.push(e.detail));
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Always show similar').click();
    expect(seen).toHaveLength(1);
    expect(el.classList.contains('dsmf-hidden')).toBe(false);
  });
});

describe('post text is never treated as markup', () => {
  it('renders evidence containing HTML as text', () => {
    const el = post();
    const hostile = {
      verdict: 'warn',
      score: 3,
      reason: '<img src=x onerror="window.__pwned=1">',
      results: [{
        rule: 'templates',
        triggered: true,
        score: 1,
        evidence: ['<script>window.__pwned = 1</script>']
      }]
    };
    applyWarn(el, hostile);
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.dsmf-explain').textContent).toContain('<script>');
  });
});

describe('clearAll', () => {
  it('removes every artifact and uncollapses every post', () => {
    const warned = post();
    const hidden = post();
    applyWarn(warned, analysis());
    applyHide(hidden, analysis('hide'));

    clearAll();

    expect(document.querySelectorAll('[data-dsmf-artifact]')).toHaveLength(0);
    expect(document.querySelectorAll('.dsmf-hidden')).toHaveLength(0);
  });

  it('is safe on a page it never touched', () => {
    post();
    expect(() => clearAll()).not.toThrow();
  });
});
