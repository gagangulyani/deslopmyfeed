// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyWarn, applyHide, restore, clearAll, ALWAYS_SHOW_EVENT, FLAG_COUNT_EVENT
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
  it('keeps the feed visually unchanged outside diagnostics', () => {
    const el = post('Original body');
    applyWarn(el, analysis());
    expect(el.querySelector('.dsmf-badge')).toBeNull();
    expect(el.querySelector('.content').textContent).toBe('Original body');
    expect(el.classList.contains('dsmf-hidden')).toBe(false);
    expect(el.classList.contains('dsmf-warned')).toBe(false);
    expect(el.querySelector('[data-dsmf-artifact="warn"]').hidden).toBe(true);
  });

  it('states a compact reason without inventing a number', () => {
    const el = post();
    applyWarn(el, analysis(), true);
    const badge = el.querySelector('.dsmf-badge').textContent;
    expect(badge).toContain('Pattern detected');
    expect(badge).toContain('Short, formulaic post structure');
    expect(badge).not.toMatch(/\d+(\.\d+)?%/);
  });

  it('shows warning UI only when diagnostics are enabled', () => {
    const el = post();
    applyWarn(el, analysis(), true);
    expect(el.querySelector('.dsmf-explain')).not.toBeNull();
  });

  it('shows complete evidence only when diagnostics are enabled', () => {
    const el = post();
    applyWarn(el, analysis(), true);
    const panel = el.querySelector('.dsmf-explain');
    expect(panel.textContent).toContain('3 enumerated items');
    expect(panel.textContent).toContain('7 of 9 paragraphs are a single short line');
  });

  it('shows complete vocabulary evidence inline', () => {
    const el = post();
    const vocabulary = {
      ...analysis(),
      results: [{ rule: 'vocabulary', triggered: true, score: 0.5, evidence: ['navigate', 'journey'] }]
    };
    applyWarn(el, vocabulary, true);
    const panel = el.querySelector('.dsmf-explain');
    expect(panel.textContent).toContain('Navigate');
    expect(panel.textContent).toContain('Journey');
    expect(panel.querySelector('.dsmf-technical')).toBeNull();
  });

  it('does not decorate the same post twice', () => {
    const el = post();
    applyWarn(el, analysis());
    applyWarn(el, analysis());
    expect(el.querySelectorAll('[data-dsmf-artifact="warn"]')).toHaveLength(1);
  });
});

describe('hide', () => {
  it('collapses the post and offers a way back', () => {
    const el = post();
    applyHide(el, analysis('hide'));
    expect(el.classList.contains('dsmf-hidden')).toBe(true);
    expect([...el.querySelectorAll('button')].map((b) => b.textContent))
      .toEqual(expect.arrayContaining(['ⓘ', 'Show post']));
  });

  it('uses a compact author row and concise reason for a hidden post', () => {
    const el = post();
    applyHide(el, analysis('hide'), { author: 'Priya Sharma', authorAvatar: 'https://example.test/priya.png' });
    expect(el.querySelector('.dsmf-hidden-author-name').textContent).toBe('Priya Sharma’s post was hidden');
    expect(el.querySelector('.dsmf-hidden-avatar').src).toBe('https://example.test/priya.png');
    const info = el.querySelector('.dsmf-info-button');
    expect(info.title).toBe('Hidden because: template structure + synthetic formatting');
    expect(el.querySelector('.dsmf-explain')).toBeNull();
    expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['ⓘ', 'Show post']);
  });

  it('reports flag-count changes when posts warn, hide, and restore', () => {
    const warned = post();
    const hidden = post();
    const changes = [];
    document.addEventListener(FLAG_COUNT_EVENT, (event) => changes.push(event.detail));
    applyWarn(warned, analysis());
    applyHide(hidden, analysis('hide'));
    restore(warned);
    restore(hidden);
    expect(changes).toEqual([{ delta: 1 }, { delta: 1 }, { delta: -1 }, { delta: -1 }]);
  });

  it('restores the post to exactly what it was', () => {
    const el = post('Untouched body');
    const before = el.innerHTML;
    applyHide(el, analysis('hide'));
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Show post').click();
    expect(el.innerHTML).toBe(before);
    expect(el.classList.contains('dsmf-hidden')).toBe(false);
  });

  it('shows full hidden-post evidence only in diagnostics mode', () => {
    const el = post();
    applyHide(el, analysis('hide'), { showDetails: true });
    expect(el.querySelector('.dsmf-explain').textContent).toContain('3 enumerated items');
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
    applyWarn(el, hostile, true);
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
    expect(document.querySelectorAll('.dsmf-warned')).toHaveLength(0);
  });

  it('is safe on a page it never touched', () => {
    post();
    expect(() => clearAll()).not.toThrow();
  });
});
