/**
 * Classic content script. MV3 does not allow `type: "module"` in
 * content_scripts, so this file exists purely to dynamic-import the real ES
 * modules via chrome.runtime.getURL(). Everything else in the codebase stays a
 * plain ES module that Node/Vitest can import directly.
 *
 * Failure here must be silent and inert: a broken import leaves LinkedIn
 * untouched (spec §22).
 */
(async () => {
  try {
    const { start } = await import(chrome.runtime.getURL('src/content/observer.js'));
    await start();
  } catch (err) {
    console.debug('[DeSlopMyFeed] disabled:', err);
  }
})();
