import { vi } from 'vitest';

/**
 * Minimal in-memory stand-in for the slice of chrome.storage this extension
 * uses. Installs itself as the global `chrome` and returns handles for tests.
 */
export function installChromeMock(initial = {}) {
  const store = { ...initial };
  const listeners = new Set();

  const chrome = {
    storage: {
      local: {
        get: vi.fn(async (key) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (entries) => {
          const changes = {};
          for (const [key, value] of Object.entries(entries)) {
            changes[key] = { oldValue: store[key], newValue: value };
            store[key] = value;
          }
          for (const listener of listeners) listener(changes, 'local');
        })
      },
      onChanged: {
        addListener: vi.fn((fn) => listeners.add(fn)),
        removeListener: vi.fn((fn) => listeners.delete(fn))
      }
    }
  };

  vi.stubGlobal('chrome', chrome);
  return { chrome, store, listeners };
}
