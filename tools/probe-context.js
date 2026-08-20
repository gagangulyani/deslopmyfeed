// Paste into the DevTools console on a LinkedIn feed.
//
// Runs when the markup probe comes back empty. That result means the document
// being queried is not the one holding the feed, so this reports which document
// it actually is: the URL, how much DOM is in it, what frames it contains, what
// shadow roots it hosts, and which class tokens dominate. Reads structure only,
// never post text.
(() => {
  const all = document.querySelectorAll('*');

  const frames = [...document.querySelectorAll('iframe')].map((f) => {
    let inner = 'cross-origin';
    try { inner = `${f.contentDocument.querySelectorAll('*').length} nodes`; } catch { /* opaque */ }
    return `${f.src ? new URL(f.src, location.href).origin : '(no src)'} — ${inner}`;
  });

  const shadowHosts = [];
  for (const e of all) if (e.shadowRoot) shadowHosts.push(e.tagName.toLowerCase());

  // Which class tokens the page is actually built from. Names the design system
  // even when every selector we remembered has gone.
  const freq = new Map();
  for (const e of all) {
    for (const c of String(e.className || '').trim().split(/\s+/)) {
      if (c) freq.set(c, (freq.get(c) ?? 0) + 1);
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([c, n]) => `${n}\t${c}`);

  const report = [
    `url: ${location.href}`,
    `title: ${document.title}`,
    `elements in this document: ${all.length}`,
    `text length: ${document.body?.innerText?.length ?? 0}`,
    `iframes: ${frames.length}`,
    ...frames.slice(0, 10).map((f) => '  ' + f),
    `shadow roots: ${shadowHosts.length}`,
    ...[...new Set(shadowHosts)].slice(0, 10).map((h) => '  ' + h),
    '--- most common class tokens ---',
    ...top
  ].join('\n');

  console.log(report);
  if (typeof copy === 'function') copy(report);
  return report;
})();
