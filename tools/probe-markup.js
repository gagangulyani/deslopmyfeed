// Paste into the DevTools console on a LinkedIn feed.
//
// Reports what LinkedIn currently wraps a feed post in, so post-detector.js can
// be pointed at real markup instead of remembered markup. Reads the DOM only;
// copies a summary to the clipboard and prints nothing about post content.
(() => {
  const cls = (e) => {
    const c = [...e.classList].slice(0, 4);
    return c.length ? '.' + c.join('.') : '';
  };
  const tag = (e) => e.tagName.toLowerCase() + cls(e);

  // Anything carrying a LinkedIn urn, which is the anchor least likely to churn.
  const urns = new Set();
  for (const e of document.querySelectorAll('[data-id],[data-urn],[data-chameleon-result-urn],[data-view-name]')) {
    for (const a of e.attributes) {
      if (!/^data-/.test(a.name)) continue;
      if (!/urn:li|feed|update/i.test(a.value)) continue;
      urns.add(`${tag(e)}  ${a.name}="${a.value.split(':').slice(0, 3).join(':')}"`);
    }
  }

  // The post's text container, and everything above it up to the feed item.
  const text = document.querySelector(
    '[class*="update-components-text"],[class*="feed-shared-inline-show-more"],[class*="break-words"]'
  );
  const chain = [];
  for (let n = text; n && n !== document.body && chain.length < 10; n = n.parentElement) {
    chain.push(tag(n));
  }

  const report = [
    '--- urn-bearing elements ---',
    ...[...urns].slice(0, 20),
    '',
    '--- ancestors of post text (innermost first) ---',
    ...(chain.length ? chain : ['NONE FOUND'])
  ].join('\n');

  console.log(report);
  if (typeof copy === 'function') copy(report);
  return report;
})();
