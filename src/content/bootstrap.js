/**
 * Classic content script. MV3 does not allow `type: "module"` in
 * content_scripts, so this file exists purely to dynamic-import the real ES
 * modules via chrome.runtime.getURL(). Everything else in the codebase stays a
 * plain ES module that Node/Vitest can import directly.
 *
 * Failure here must be inert: a broken import leaves LinkedIn untouched
 * (spec §22). It is not silent, though — an inert extension that says nothing
 * cannot be told apart from one that never loaded.
 */
(async () => {
  try {
    // Set the action state before feed discovery, so every LinkedIn page reflects
    // whether filtering is enabled even when it is not a feed route.
    chrome.runtime.sendMessage({ type: 'dsmf-linkedin-active' });
    const { start } = await import(chrome.runtime.getURL('src/content/observer.js'));
    await start();
  } catch (err) {
    // console.error, not console.debug: Chrome hides the Verbose level by
    // default, so a failed import used to produce a completely silent
    // extension with no way to tell it apart from one that never loaded.
    console.error('[DeSlopMyFeed] failed to start:', err);
  }
})();
