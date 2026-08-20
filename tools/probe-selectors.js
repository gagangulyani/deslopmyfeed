// Paste into the DevTools console on a LinkedIn feed.
//
// Deliberately standalone: it imports nothing and assumes nothing about the
// extension, so it still answers the question when the extension is the thing
// that is broken. Reports which post selectors match, whether the extension's
// stylesheet reached the page, and — when every known selector misses — what
// LinkedIn is actually wrapping post text in now.
(() => {
  const tried = {
    'div[data-id^="urn:li:activity"]': 0,
    'div[data-urn^="urn:li:activity"]': 0,
    'div.feed-shared-update-v2': 0,
    '[data-id*="urn:li:activity"]': 0,
    '[data-urn*="urn:li:activity"]': 0,
    '.fie-impression-container': 0,
    '.update-components-text': 0,
    '.feed-shared-update-v2__description': 0,
    '.feed-shared-inline-show-more-text': 0
  };
  for (const s of Object.keys(tried)) tried[s] = document.querySelectorAll(s).length;
  console.table(tried);

  console.log('dsmf artifacts on page:',
    document.querySelectorAll('[data-dsmf-debug],[data-dsmf-artifact]').length);
  console.log('dsmf stylesheet loaded:',
    getComputedStyle(document.documentElement).getPropertyValue('--dsmf-bg') !== '');

  // What actually wraps a post right now, if the known selectors all missed.
  const anyText = document.querySelector('.update-components-text, [class*="update-components-text"]');
  if (anyText) {
    let n = anyText, chain = [];
    while (n && n !== document.body && chain.length < 8) {
      chain.push(n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : '') +
        (n.dataset?.id ? `[data-id="${n.dataset.id.slice(0, 24)}…"]` : '') +
        (n.dataset?.urn ? `[data-urn="${n.dataset.urn.slice(0, 24)}…"]` : ''));
      n = n.parentElement;
    }
    console.log('ancestors of a post text node:\n' + chain.join('\n  ^ '));
  } else {
    console.log('no text-container candidate found at all');
  }
})();
