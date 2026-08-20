import { commitSettingsPatch, loadSettings } from '../storage/settings.js';

const COLOR_ICONS = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};
const GRAY_ICONS = {
  16: 'icons/icon-gray-16.png',
  32: 'icons/icon-gray-32.png',
  48: 'icons/icon-gray-48.png',
  128: 'icons/icon-gray-128.png'
};
const hiddenCounts = new Map();

function extensionIconPaths(icons) {
  return Object.fromEntries(
    Object.entries(icons).map(([size, path]) => [size, chrome.runtime.getURL(path)])
  );
}

function isLinkedIn(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

function setBadge(tabId, count = hiddenCounts.get(tabId) ?? 0) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' });
  chrome.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' });
}

async function setTabAppearance(tabId, linkedIn, settings) {
  const currentSettings = settings ?? await loadSettings();
  const active = linkedIn && currentSettings.enabled && currentSettings.mode !== 'off';
  chrome.action.setIcon({
    tabId,
    path: extensionIconPaths(active ? COLOR_ICONS : GRAY_ICONS)
  });
  if (!active) hiddenCounts.delete(tabId);
  setBadge(tabId);
}

async function refreshLinkedInIcons(settings) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (Number.isInteger(tab.id)) await setTabAppearance(tab.id, isLinkedIn(tab.url), settings);
  }
}

// A reloaded extension does not necessarily receive a URL-change event for an
// already-open LinkedIn tab. Refreshing at worker startup/install guarantees
// the default grayscale manifest icon cannot get stuck there.
chrome.runtime.onInstalled.addListener(() => { void refreshLinkedInIcons(); });
chrome.runtime.onStartup.addListener(() => { void refreshLinkedInIcons(); });

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'loading') {
    void setTabAppearance(tabId, isLinkedIn(changeInfo.url ?? tab.url));
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await setTabAppearance(tabId, isLinkedIn(tab.url));
});

chrome.tabs.onRemoved.addListener((tabId) => hiddenCounts.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'dsmf-save-settings') {
    commitSettingsPatch(message.patch)
      .then(async (settings) => {
        await refreshLinkedInIcons(settings);
        sendResponse(settings);
      })
      .catch((error) => sendResponse({ error: String(error?.message ?? error) }));
    return true;
  }

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return undefined;

  if (message?.type === 'dsmf-linkedin-active') {
    void setTabAppearance(tabId, true);
  } else if (message?.type === 'dsmf-hidden-count') {
    const count = message.reset
      ? 0
      : Math.max(0, (hiddenCounts.get(tabId) ?? 0) + (message.delta ?? 0));
    hiddenCounts.set(tabId, count);
    setBadge(tabId, count);
  }

  return undefined;
});
