import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installChromeMock } from '../chrome-mock.js';
import {
  DEFAULT_SETTINGS, STORAGE_KEY, mergeSettings, loadSettings, saveSettings, onSettingsChanged
} from '../../src/storage/settings.js';

beforeEach(() => { installChromeMock(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('mergeSettings', () => {
  it('returns the defaults for an empty store', () => {
    expect(mergeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills in a rule that did not exist when the settings were saved', () => {
    const merged = mergeSettings({ rules: { templateStacking: false } });
    expect(merged.rules.templateStacking).toBe(false);
    expect(Object.keys(merged.rules)).toEqual(Object.keys(DEFAULT_SETTINGS.rules));
  });

  it('does not mutate the defaults', () => {
    mergeSettings({ rules: { templateStacking: false } });
    expect(DEFAULT_SETTINGS.rules.templateStacking).toBe(true);
  });
});

describe('load and save', () => {
  it('round-trips a patch without dropping the rest', async () => {
    await saveSettings({ mode: 'hide' });
    const loaded = await loadSettings();
    expect(loaded.mode).toBe('hide');
    expect(loaded.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
    expect(loaded.rules).toEqual(DEFAULT_SETTINGS.rules);
  });

  it('accumulates successive patches', async () => {
    await saveSettings({ mode: 'hide' });
    await saveSettings({ sensitivity: 'high' });
    expect(await loadSettings()).toMatchObject({ mode: 'hide', sensitivity: 'high' });
  });

  it('serializes overlapping patches so neither update is lost', async () => {
    await Promise.all([
      saveSettings({ mode: 'hide' }),
      saveSettings({ sensitivity: 'high' })
    ]);
    expect(await loadSettings()).toMatchObject({ mode: 'hide', sensitivity: 'high' });
  });

  it('merges partial nested patches without resetting sibling settings', async () => {
    await saveSettings({ rules: { templateStacking: false } });
    await saveSettings({ rules: { formatting: false } });
    expect((await loadSettings()).rules).toMatchObject({
      templateStacking: false,
      formatting: false
    });
  });

  it('writes everything under one key', async () => {
    await saveSettings({ mode: 'hide' });
    expect(Object.keys(await chrome.storage.local.get(STORAGE_KEY))).toEqual([STORAGE_KEY]);
  });

  it('stores only the documented schema, never post text', async () => {
    await saveSettings({ mode: 'hide', exceptions: { keywords: ['kubernetes'] } });
    const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    expect(Object.keys(stored).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});

describe('onSettingsChanged', () => {
  it('notifies with the merged settings', async () => {
    const seen = [];
    onSettingsChanged((s) => seen.push(s));
    await saveSettings({ mode: 'hide' });
    expect(seen).toHaveLength(1);
    expect(seen[0].mode).toBe('hide');
    expect(seen[0].weights).toEqual(DEFAULT_SETTINGS.weights);
  });

  it('unsubscribes', async () => {
    const seen = [];
    const off = onSettingsChanged((s) => seen.push(s));
    off();
    await saveSettings({ mode: 'hide' });
    expect(seen).toHaveLength(0);
  });

  it('ignores changes to other keys', async () => {
    const seen = [];
    onSettingsChanged((s) => seen.push(s));
    await chrome.storage.local.set({ somethingElse: 1 });
    expect(seen).toHaveLength(0);
  });
});
