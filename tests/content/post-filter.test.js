// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

const applyWarn = vi.fn();
const applyHide = vi.fn();
vi.mock('../../src/content/ui.js', () => ({
  applyWarn: (...args) => applyWarn(...args),
  applyHide: (...args) => applyHide(...args),
  restore: vi.fn(),
  clearAll: vi.fn()
}));

const { processPost, isExempt } = await import('../../src/content/post-filter.js');
const { loadCorpus } = await import('../corpus.js');

const slop = loadCorpus('ai').find((p) => p.id === 'ai-001').text;   // reaches hide
const mild = loadCorpus('ai').find((p) => p.id === 'ai-011').text;   // reaches warn only
const human = loadCorpus('human').find((p) => p.id === 'human-063').text;

function element(text, author = 'A Person') {
  const el = document.createElement('div');
  el.setAttribute('data-id', 'urn:li:activity:1');
  el.innerHTML = `<div class="update-components-actor__title">${author}</div>
    <div class="update-components-text"></div>`;
  el.querySelector('.update-components-text').textContent = text;
  return el;
}

beforeEach(() => {
  applyWarn.mockClear();
  applyHide.mockClear();
});

describe('processPost', () => {
  it('processes an element exactly once', () => {
    const el = element(mild);
    expect(processPost(el, { mode: 'warn' })).not.toBeNull();
    expect(processPost(el, { mode: 'warn' })).toBeNull();
    expect(applyWarn).toHaveBeenCalledTimes(1);
  });

  it('leaves a human post untouched', () => {
    const result = processPost(element(human), { mode: 'hide' });
    expect(result.verdict).toBe('show');
    expect(applyWarn).not.toHaveBeenCalled();
    expect(applyHide).not.toHaveBeenCalled();
  });

  it('routes a hide verdict to the collapse path', () => {
    const el = element(loadCorpus('ai').find((p) => p.id === 'ai-003').text);
    const result = processPost(el, { mode: 'hide' });
    expect(result.verdict).toBe('hide');
    expect(applyHide).toHaveBeenCalledTimes(1);
  });

  it('skips markup it cannot read rather than guessing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="unknown-markup">text</div>';
    expect(processPost(el, {})).toBeNull();
  });
});

describe('exceptions beat the detector', () => {
  it('an exempted author is never analyzed', () => {
    const settings = { mode: 'hide', exceptions: { authors: ['A Person'] } };
    expect(processPost(element(slop), settings)).toBeNull();
    expect(applyWarn).not.toHaveBeenCalled();
    expect(applyHide).not.toHaveBeenCalled();
  });

  it('an exempted keyword is never analyzed', () => {
    const settings = { mode: 'hide', exceptions: { keywords: ['leadership'] } };
    expect(processPost(element(slop), settings)).toBeNull();
  });

  it('matches authors and keywords case-insensitively', () => {
    const post = { text: 'Something about KUBERNETES here.', author: 'Priya Sharma' };
    expect(isExempt(post, { exceptions: { authors: ['priya sharma'] } })).toBe(true);
    expect(isExempt(post, { exceptions: { keywords: ['kubernetes'] } })).toBe(true);
  });

  it('ignores empty exception entries', () => {
    const post = { text: 'Anything at all.', author: 'Someone' };
    expect(isExempt(post, { exceptions: { authors: [''], keywords: [''] } })).toBe(false);
  });

  it('handles settings with no exceptions block', () => {
    expect(isExempt({ text: 'x', author: 'y' }, {})).toBe(false);
  });
});
