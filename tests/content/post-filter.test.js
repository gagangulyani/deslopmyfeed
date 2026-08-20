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

function element(text, author = 'A Person', reposted = false) {
  const el = document.createElement('div');
  el.setAttribute('data-id', 'urn:li:activity:1');
  el.innerHTML = `${reposted ? '<span>Example Person reposted this</span>' : ''}
    <div class="update-components-actor__title">${author}</div>
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

  it('skips reposts in a profile activity archive', () => {
    history.replaceState({}, '', '/in/example-profile/recent-activity/all/');
    expect(processPost(element(slop, 'A Person', true), { mode: 'hide' })).toBeNull();
    expect(applyHide).not.toHaveBeenCalled();
    history.replaceState({}, '', '/');
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

describe('diagnostics', () => {
  const tag = (el) => el.querySelector('[data-dsmf-debug]');

  it('marks nothing when debug is off', () => {
    const el = element(human);
    processPost(el, { mode: 'warn' });
    expect(tag(el)).toBeNull();
  });

  it('marks a post that was analyzed and cleared, which otherwise looks like doing nothing', () => {
    const el = element(human);
    processPost(el, { mode: 'warn', debug: true });
    expect(tag(el).getAttribute('data-dsmf-debug')).toBe('show');
    expect(tag(el).textContent).toContain('score');
  });

  it('marks a post skipped by the user exception list', () => {
    const el = element(slop, 'Trusted Colleague');
    processPost(el, { mode: 'hide', debug: true, exceptions: { authors: ['Trusted Colleague'] } });
    expect(tag(el).getAttribute('data-dsmf-debug')).toBe('exempt');
  });

  it('marks a flagged post without suppressing the real badge', () => {
    const el = element(mild);
    processPost(el, { mode: 'warn', debug: true });
    expect(tag(el).getAttribute('data-dsmf-debug')).toBe('warn');
    expect(applyWarn).toHaveBeenCalledTimes(1);
  });

  it('does not change any verdict', () => {
    const quiet = processPost(element(mild), { mode: 'warn' });
    const loud = processPost(element(mild), { mode: 'warn', debug: true });
    expect(loud.verdict).toBe(quiet.verdict);
    expect(loud.score).toBe(quiet.score);
  });
});
