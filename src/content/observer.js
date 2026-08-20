/**
 * Feed lifecycle: watch for newly inserted posts, process each exactly once.
 * Never rescans the whole page.
 */
import { findPosts, resetProcessed } from './post-detector.js';
import { processPost, markAlwaysShow } from './post-filter.js';
import { clearAll, ALWAYS_SHOW_EVENT } from './ui.js';
import {
  DEFAULT_SETTINGS, loadSettings, saveSettings, onSettingsChanged, mergeSettings
} from '../storage/settings.js';
import { RULES } from '../detector/scoring.js';
import { clearDebug, log, probe } from './debug.js';

/** Mutations arrive in bursts while the feed renders; batch them. */
const DEBOUNCE_MS = 100;

let observer = null;
let settings = null;
let pending = new Set();
let timer = null;
let unsubscribe = null;

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

  let seen = 0;
  for (const root of roots) {
    for (const post of findPosts(root)) {
      processPost(post, settings);
      seen += 1;
    }
  }
  if (settings?.debug && seen > 0) log(`scanned ${seen} newly inserted post(s)`);
}

function schedule(root) {
  pending.add(root);
  if (timer === null) timer = setTimeout(flush, DEBOUNCE_MS);
}

/** Judge the whole page again. Cheap enough: a feed holds tens of posts. */
function rescan() {
  resetProcessed();
  clearAll();
  clearDebug();
  if (!settings?.enabled || settings.mode === 'off') return;
  for (const post of findPosts(document)) processPost(post, settings);
}

/** 'system' leaves the attribute unset so the media query decides. */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-dsmf-theme', theme);
  else root.removeAttribute('data-dsmf-theme');
}

/**
 * "Always show similar" turns off the signal that drove the verdict.
 *
 * The spec (§12) names the control but not its mechanism. Disabling the
 * dominant rule is the reading that uses only what the settings schema already
 * has: it is visible in the popup, reversible in one click, and cannot silently
 * accumulate state the user cannot inspect. It is a heavier action than the
 * label suggests, which is the honest trade for not inventing a hidden
 * per-pattern memory.
 */
async function onAlwaysShow(event) {
  // The post the user just un-hid stays visible no matter what the rules say
  // afterwards. The rule change below is about future posts.
  if (event?.target?.nodeType === 1) markAlwaysShow(event.target);

  const results = event?.detail?.analysis?.results ?? [];
  if (results.length === 0 || !settings) return;

  const dominant = results.reduce((best, r) =>
    r.score * (settings.weights[r.rule] ?? 0) > best.score * (settings.weights[best.rule] ?? 0)
      ? r
      : best
  );
  if (!RULES[dominant.rule]) return;

  await saveSettings({ rules: { ...settings.rules, [dominant.rule]: false } });
}

/** Boot: load settings, install MutationObserver, process what is already there. */
export async function start() {
  if (observer) return false;

  // One line, unconditionally. Without it a content script that loaded and
  // then declined to act is indistinguishable from one that never loaded at
  // all, which is the single hardest thing to diagnose from a real feed.
  if (!isFeedRoute()) {
    log(`loaded on ${location.pathname} — not a feed route, standing by`);
    return false;
  }

  settings = await readSettings();
  applyTheme(settings.theme);
  if (!settings.enabled || settings.mode === 'off') {
    log(`loaded but idle — enabled=${settings.enabled} mode=${settings.mode}`);
    return false;
  }

  log(`active on ${location.pathname} — mode=${settings.mode} sensitivity=${settings.sensitivity}`);
  if (settings.debug) probe();

  let initial = 0;
  for (const post of findPosts(document)) {
    processPost(post, settings);
    initial += 1;
  }
  if (settings.debug) log(`${initial} post(s) present at boot`);

  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) schedule(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener(ALWAYS_SHOW_EVENT, onAlwaysShow);

  // Settings changed in the popup take effect here without a reload.
  try {
    unsubscribe = onSettingsChanged((next) => {
      settings = next;
      applyTheme(settings.theme);
      rescan();
    });
  } catch {
    unsubscribe = null;
  }

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
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  document.removeEventListener(ALWAYS_SHOW_EVENT, onAlwaysShow);
  pending = new Set();
  settings = null;
  resetProcessed();
  clearAll();
  clearDebug();
}
