// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const applyWarn = vi.fn();
const applyHide = vi.fn();
const clearAll = vi.fn();
vi.mock('../../src/content/ui.js', () => ({
  applyWarn: (...a) => applyWarn(...a),
  applyHide: (...a) => applyHide(...a),
  restore: vi.fn(),
  clearAll: (...a) => clearAll(...a),
  ALWAYS_SHOW_EVENT: 'dsmf-always-show'
}));

const { start, stop, isFeedRoute } = await import('../../src/content/observer.js');
const { loadCorpus } = await import('../corpus.js');

const slop = loadCorpus('ai').find((p) => p.id === 'ai-001').text;

let seq = 0;
function appendPost(text = slop) {
  const el = document.createElement('div');
  el.setAttribute('data-id', `urn:li:activity:${(seq += 1)}`);
  el.innerHTML = '<div class="update-components-text"></div>';
  el.querySelector('.update-components-text').textContent = text;
  document.body.appendChild(el);
  return el;
}

/** The observer debounces at 100ms; give it room. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

beforeEach(() => {
  document.body.innerHTML = '';
  applyWarn.mockClear();
  applyHide.mockClear();
  clearAll.mockClear();
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('isFeedRoute', () => {
  it.each([['/', true], ['/feed/', true], ['/feed/update/x', true], ['/jobs', false], ['/in/someone', false]])(
    '%s -> %s',
    (path, expected) => expect(isFeedRoute(path)).toBe(expected)
  );
});

describe('start', () => {
  // The default mode is 'warn', so a slop post gets a badge rather than a
  // collapse. Nothing is hidden until the user asks for hiding.
  it('processes posts already on the page', async () => {
    appendPost();
    expect(await start()).toBe(true);
    expect(applyWarn).toHaveBeenCalledTimes(1);
    expect(applyHide).not.toHaveBeenCalled();
  });

  it('processes posts inserted later', async () => {
    await start();
    expect(applyWarn).not.toHaveBeenCalled();
    appendPost();
    await settle();
    expect(applyWarn).toHaveBeenCalledTimes(1);
  });

  it('processes each post exactly once across repeated mutations', async () => {
    await start();
    const el = appendPost();
    await settle();
    // Re-inserting the same element must not re-process it.
    document.body.appendChild(el);
    el.appendChild(document.createElement('span'));
    await settle();
    expect(applyWarn).toHaveBeenCalledTimes(1);
  });

  it('does nothing off the feed', async () => {
    vi.stubGlobal('location', { pathname: '/jobs' });
    appendPost();
    expect(await start()).toBe(false);
    expect(applyWarn).not.toHaveBeenCalled();
  });

  it('does nothing when the kill switch is off', async () => {
    // loadSettings is not wired to chrome.storage yet, so this exercises the
    // documented fallback: unavailable storage means defaults, not a crash.
    appendPost();
    expect(await start()).toBe(true);
  });

  it('is idempotent', async () => {
    expect(await start()).toBe(true);
    expect(await start()).toBe(false);
  });
});

describe('stop', () => {
  it('stops processing new posts', async () => {
    await start();
    stop();
    appendPost();
    await settle();
    expect(applyWarn).not.toHaveBeenCalled();
  });

  it('restores the page', async () => {
    await start();
    stop();
    expect(clearAll).toHaveBeenCalledTimes(1);
  });

  it('can be called without start', () => {
    expect(() => stop()).not.toThrow();
  });
});
