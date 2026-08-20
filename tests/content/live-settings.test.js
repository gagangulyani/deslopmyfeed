// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from '../chrome-mock.js';

// The real UI is used here: this test is about the page actually changing.
const { start, stop } = await import('../../src/content/observer.js');
const { saveSettings, DEFAULT_SETTINGS } = await import('../../src/storage/settings.js');
const { loadCorpus } = await import('../corpus.js');
const { ALWAYS_SHOW_EVENT } = await import('../../src/content/ui.js');

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

const badges = () => document.querySelectorAll('.dsmf-badge').length;
const cards = () => document.querySelectorAll('.dsmf-card').length;

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-dsmf-theme');
  installChromeMock();
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('settings take effect without a reload', () => {
  it('switching to hide collapses posts already on the page', async () => {
    appendPost();
    await start();
    expect(badges()).toBe(1);
    expect(cards()).toBe(0);

    await saveSettings({ mode: 'hide' });

    expect(cards()).toBe(1);
    expect(badges()).toBe(0);
  });

  it('switching to off clears every artifact', async () => {
    appendPost();
    await start();
    expect(badges()).toBe(1);

    await saveSettings({ mode: 'off' });

    expect(document.querySelectorAll('[data-dsmf-artifact]')).toHaveLength(0);
    expect(document.querySelectorAll('.dsmf-hidden')).toHaveLength(0);
  });

  it('the kill switch clears the page', async () => {
    appendPost();
    await start();
    await saveSettings({ enabled: false });
    expect(document.querySelectorAll('[data-dsmf-artifact]')).toHaveLength(0);
  });

  it('turning a rule off re-judges the page', async () => {
    appendPost();
    await start();
    expect(badges()).toBe(1);

    // Removing the structural rules drops the post below the warn threshold.
    await saveSettings({
      rules: { ...DEFAULT_SETTINGS.rules, templateStacking: false, formatting: false, genericity: false }
    });

    expect(badges()).toBe(0);
  });

  it('an exception keyword takes effect immediately', async () => {
    appendPost();
    await start();
    expect(badges()).toBe(1);

    await saveSettings({ exceptions: { authors: [], keywords: ['leadership'] } });

    expect(badges()).toBe(0);
  });

  it('applies the theme to the page and unsets it for system', async () => {
    await start();
    await saveSettings({ theme: 'dark' });
    expect(document.documentElement.getAttribute('data-dsmf-theme')).toBe('dark');

    await saveSettings({ theme: 'system' });
    expect(document.documentElement.hasAttribute('data-dsmf-theme')).toBe(false);
  });
});

describe('always show similar', () => {
  it('turns off the signal that drove the verdict and persists it', async () => {
    appendPost();
    await start({ mode: 'hide' });
    await saveSettings({ mode: 'hide' });
    expect(cards()).toBe(1);

    const post = document.querySelector('[data-id^="urn:li:activity"]');
    [...post.querySelectorAll('button')]
      .find((b) => b.textContent === 'Always show similar')
      .click();

    // The click dispatches; the handler writes asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = (await chrome.storage.local.get('settings')).settings;
    expect(stored.rules.templateStacking).toBe(false);
    expect(cards()).toBe(0);
  });

  it('ignores an event carrying no analysis', async () => {
    await start();
    document.dispatchEvent(new CustomEvent(ALWAYS_SHOW_EVENT, { detail: {} }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = (await chrome.storage.local.get('settings')).settings;
    expect(stored).toBeUndefined();
  });
});
