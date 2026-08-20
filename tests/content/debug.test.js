// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stamp, clearDebug, probe, DEBUG_ATTR } from '../../src/content/debug.js';
import { POST_SELECTORS } from '../../src/content/post-detector.js';

beforeEach(() => {
  document.body.textContent = '';
});

function post() {
  const el = document.createElement('div');
  el.setAttribute('data-id', 'urn:li:activity:1');
  el.appendChild(document.createElement('article'));
  document.body.appendChild(el);
  return el;
}

describe('stamp', () => {
  it('tags a post with the stage it reached', () => {
    const el = post();
    stamp(el, 'truncated');
    const tag = el.querySelector(`[${DEBUG_ATTR}]`);
    expect(tag.getAttribute(DEBUG_ATTR)).toBe('truncated');
    expect(tag.textContent).toBe('truncated');
  });

  it('puts the tag first so it reads above the post', () => {
    const el = post();
    stamp(el, 'show', 'score 0.7');
    expect(el.firstElementChild.getAttribute(DEBUG_ATTR)).toBe('show');
  });

  it('colours by outcome, not by stage name', () => {
    expect(stamp(post(), 'truncated').className).toContain('dsmf-debug-skip');
    expect(stamp(post(), 'show').className).toContain('dsmf-debug-clean');
    expect(stamp(post(), 'hide').className).toContain('dsmf-debug-flag');
  });

  it('replaces its own tag rather than stacking them', () => {
    const el = post();
    stamp(el, 'show', 'first');
    stamp(el, 'warn', 'second');
    expect(el.querySelectorAll(`[${DEBUG_ATTR}]`)).toHaveLength(1);
    expect(el.textContent).toContain('second');
    expect(el.textContent).not.toContain('first');
  });

  // The detail string is derived from post text, which is attacker-controlled.
  it('writes the detail as text, never as markup', () => {
    const el = post();
    stamp(el, 'show', '<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('does not use the artifact attribute the real badges are keyed on', () => {
    const el = post();
    stamp(el, 'warn', 'score 3');
    expect(el.querySelector('[data-dsmf-artifact]')).toBeNull();
  });
});

describe('clearDebug', () => {
  it('removes every tag and nothing else', () => {
    const el = post();
    stamp(el, 'show');
    clearDebug();
    expect(el.querySelector(`[${DEBUG_ATTR}]`)).toBeNull();
    expect(el.querySelector('article')).not.toBeNull();
  });
});

describe('probe', () => {
  it('reports a count for every post selector', () => {
    post();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const counts = probe();
    info.mockRestore();

    expect(Object.keys(counts)).toEqual(POST_SELECTORS);
    expect(counts['div[data-id^="urn:li:activity"]']).toBe(1);
    expect(counts['div.feed-shared-update-v2']).toBe(0);
  });
});
