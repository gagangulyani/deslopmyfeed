/**
 * Feed lifecycle: watch for newly inserted posts, process each exactly once.
 * Never rescans the whole page.
 */
import { findPosts } from './post-detector.js';
import { processPost } from './post-filter.js';
import { clearAll } from './ui.js';
import { DEFAULT_SETTINGS, loadSettings, mergeSettings } from '../storage/settings.js';

/** Mutations arrive in bursts while the feed renders; batch them. */
const DEBOUNCE_MS = 100;

let observer = null;
let settings = null;
let pending = new Set();
let timer = null;

/** Runtime path gate — the content script matches all of linkedin.com so that
 * SPA navigation into /feed still has us loaded, but we only act on the feed. */
export function isFeedRoute(pathname = location.pathname) {
  return pathname === '/' || pathname.startsWith('/feed');
}

/**
 * Settings are advisory at boot: if storage is unavailable the extension runs
 * on defaults rather than not running. It never fails into a state where it
 * has modified the page but does not know what the user asked for.
 */
async function readSettings() {
  try {
    return await loadSettings();
  } catch {
    return mergeSettings(DEFAULT_SETTINGS);
  }
}

function flush() {
  timer = null;
  const roots = pending;
  pending = new Set();

  // Re-checked here rather than only at boot: LinkedIn is a single-page app and
  // the user can navigate off the feed without any page load happening.
  if (!isFeedRoute()) return;

  for (const root of roots) {
    for (const post of findPosts(root)) processPost(post, settings);
  }
}

function schedule(root) {
  pending.add(root);
  if (timer === null) timer = setTimeout(flush, DEBOUNCE_MS);
}

/** Boot: load settings, install MutationObserver, process what is already there. */
export async function start() {
  if (observer) return false;
  if (!isFeedRoute()) return false;

  settings = await readSettings();
  if (!settings.enabled || settings.mode === 'off') return false;

  for (const post of findPosts(document)) processPost(post, settings);

  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) schedule(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return true;
}

/** Tear down observers and restore every post. Backs the global kill switch. */
export function stop() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  pending = new Set();
  settings = null;
  clearAll();
}
