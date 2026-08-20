import { commitSettingsPatch } from '../storage/settings.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'dsmf-save-settings') return undefined;

  commitSettingsPatch(message.patch)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: String(error?.message ?? error) }));
  return true;
});
