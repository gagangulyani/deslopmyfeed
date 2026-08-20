/**
 * Single source of truth for user settings. chrome.storage.local only.
 * Post content is never written here.
 */

export const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'warn',              // 'off' | 'warn' | 'hide'
  sensitivity: 'medium',     // 'low' | 'medium' | 'high' -> threshold offsets
  // Calibrated against the corpus in tests/fixtures, not guessed. The highest
  // score any human fixture reaches is 0.8; warn sits at roughly three times
  // that so that real humans, who are more varied than the corpus, have room.
  thresholds: { warn: 2.5, hide: 2.5 },
  rules: {
    templateStacking: true,
    genericity: true,
    formatting: true,
    templates: true,
    vocabulary: true,
    engagement: true,
    hashtags: true
  },
  weights: {
    templateStacking: 3,
    genericity: 2,
    formatting: 2,
    templates: 2,
    vocabulary: 1,
    engagement: 1,
    hashtags: 1
  },
  customVocabulary: {},      // group -> extra terms
  exceptions: {
    authors: [],             // author names the user always wants to see
    keywords: []             // posts containing these are always shown
  },
  theme: 'system',           // 'system' | 'dark' | 'light'
  // Diagnostics. Tags every candidate post with the stage it reached and logs
  // selector match counts, so a silent feed can be told apart from a stale
  // selector. Off by default; it changes nothing about what gets filtered.
  debug: false
};

/**
 * Merge a stored (possibly older, possibly partial) settings object over the
 * defaults. Nested objects are merged one level deep so that adding a rule in
 * a later version does not leave existing users with it missing.
 *
 * @param {Partial<typeof DEFAULT_SETTINGS>} [stored]
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function mergeSettings(stored) {
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  for (const key of ['thresholds', 'rules', 'weights', 'customVocabulary', 'exceptions']) {
    merged[key] = { ...DEFAULT_SETTINGS[key], ...(stored?.[key] ?? {}) };
  }
  return merged;
}

/** The single key under which everything is stored. */
export const STORAGE_KEY = 'settings';

/** @returns {Promise<typeof DEFAULT_SETTINGS>} */
export async function loadSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return mergeSettings(stored?.[STORAGE_KEY]);
}

// chrome.storage has no atomic read-modify-write operation. Serializing saves
// prevents quick successive popup changes from each merging against stale data.
let pendingWrite = Promise.resolve();

/**
 * Read-modify-write so a patch touching one field cannot drop the rest, and so
 * a settings object saved by an older version gains any new defaults on its
 * next write.
 *
 * @param {Partial<typeof DEFAULT_SETTINGS>} patch
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export function commitSettingsPatch(patch) {
  const write = pendingWrite.then(async () => {
    const current = await loadSettings();
    const next = mergeSettings({
      ...current,
      ...patch,
      thresholds: { ...current.thresholds, ...(patch.thresholds ?? {}) },
      rules: { ...current.rules, ...(patch.rules ?? {}) },
      weights: { ...current.weights, ...(patch.weights ?? {}) },
      customVocabulary: { ...current.customVocabulary, ...(patch.customVocabulary ?? {}) },
      exceptions: { ...current.exceptions, ...(patch.exceptions ?? {}) }
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  });

  // A failed write must not strand later writes behind a rejected promise.
  pendingWrite = write.catch(() => {});
  return write;
}

/**
 * Route production writes through the extension service worker, which owns the
 * queue shared by popup and content-script contexts. Tests without a runtime
 * bridge use the same local commit path.
 */
export function saveSettings(patch) {
  if (chrome.runtime?.sendMessage) {
    return chrome.runtime.sendMessage({ type: 'dsmf-save-settings', patch });
  }
  return commitSettingsPatch(patch);
}

/**
 * Subscribe to changes made anywhere — the popup writing while a feed tab is
 * open is the case that matters, and it is what makes settings take effect
 * without a reload.
 *
 * @param {(settings: typeof DEFAULT_SETTINGS) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onSettingsChanged(handler) {
  const listener = (changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    handler(mergeSettings(changes[STORAGE_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
