/**
 * Single source of truth for user settings. chrome.storage.local only.
 * Post content is never written here.
 */

export const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'warn',              // 'off' | 'warn' | 'hide'
  sensitivity: 'medium',     // 'low' | 'medium' | 'high' -> threshold offsets
  thresholds: { warn: 5, hide: 7 },
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
  theme: 'system'            // 'system' | 'dark' | 'light'
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

/** @returns {Promise<typeof DEFAULT_SETTINGS>} */
export async function loadSettings() {
  throw new Error('not implemented');
}

/** @param {Partial<typeof DEFAULT_SETTINGS>} patch */
export async function saveSettings(patch) {
  throw new Error('not implemented');
}

/** @param {(settings: typeof DEFAULT_SETTINGS) => void} handler */
export function onSettingsChanged(handler) {
  throw new Error('not implemented');
}
