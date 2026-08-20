// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderInto, applyTheme } from '../src/popup/popup.js';
import { DEFAULT_SETTINGS } from '../src/storage/settings.js';
import { RULES } from '../src/detector/scoring.js';

let root;
const changes = [];
const render = (settings = DEFAULT_SETTINGS) =>
  renderInto(root, settings, (patch) => changes.push(patch));

beforeEach(() => {
  document.body.innerHTML = '<main id="app"></main>';
  document.documentElement.removeAttribute('data-theme');
  root = document.getElementById('app');
  changes.length = 0;
});

describe('popup renders from the settings schema', () => {
  it('shows a toggle for every registered rule', () => {
    render();
    const labels = [...root.querySelectorAll('.row-label')].map((n) => n.textContent);
    // One checkbox per rule, plus the kill switch and the debug toggle. Modes,
    // sensitivities and themes are radios, not checkboxes.
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      Object.keys(RULES).length + 2
    );
    expect(labels).toContain('Enable DeSlopMyFeed');
  });

  it('reflects the settings it was given', () => {
    render({ ...DEFAULT_SETTINGS, mode: 'hide', sensitivity: 'high' });
    expect(root.querySelector('input[name="mode"][value="hide"]').checked).toBe(true);
    expect(root.querySelector('input[name="sensitivity"][value="high"]').checked).toBe(true);
  });

  it('reports a mode change as a patch', () => {
    render();
    root.querySelector('input[name="mode"][value="hide"]').click();
    expect(changes).toEqual([{ mode: 'hide' }]);
  });

  it('reports a rule toggle without dropping the other rules', () => {
    render();
    root.querySelectorAll('input[type="checkbox"]')[1].click();
    expect(Object.keys(changes[0].rules)).toEqual(Object.keys(DEFAULT_SETTINGS.rules));
    expect(Object.values(changes[0].rules).filter((v) => v === false)).toHaveLength(1);
  });

  it('reports the kill switch', () => {
    render();
    root.querySelector('input[type="checkbox"]').click();
    expect(changes).toEqual([{ enabled: false }]);
  });

  it('renders a rule that a stored older settings object is missing', () => {
    // Forward compatibility: a user who saved settings before a rule existed
    // must still see it, defaulted on.
    render({ rules: { templateStacking: false } });
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(
      Object.keys(RULES).length + 2
    );
  });
});

describe('theme', () => {
  it('leaves the attribute unset for system so the media query decides', () => {
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it.each(['light', 'dark'])('sets an explicit %s choice', (theme) => {
    applyTheme(theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });
});
