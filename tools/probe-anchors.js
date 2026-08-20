// Paste into the DevTools console on a LinkedIn feed.
//
// Runs when the class names turn out to be build hashes. Class selectors cannot
// survive that, so this looks for what remains stable: attribute names, ARIA
// roles, and the repeated-sibling structure of the feed itself. Reports
// structure and attribute names only — never attribute values that could carry
// post content, and never post text.
(() => {
  const all = document.querySelectorAll('*');

  // Attribute names, not values. A data-* or aria-* that appears on every post
  // is the anchor class names used to be.
  const attrs = new Map();
  for (const e of all) {
    for (const a of e.attributes) {
      if (a.name === 'class' || a.name === 'style') continue;
      attrs.set(a.name, (attrs.get(a.name) ?? 0) + 1);
    }
  }
  const attrTop = [...attrs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([n, c]) => `${c}\t${n}`);

  const roles = new Map();
  for (const e of all) {
    const r = e.getAttribute('role');
    if (r) roles.set(r, (roles.get(r) ?? 0) + 1);
  }

  /** Attributes of one element, values elided unless they are structural. */
  const shape = (e) => {
    if (!e) return '(none)';
    const safe = [...e.attributes]
      .filter((a) => a.name !== 'class' && a.name !== 'style')
      .map((a) => {
        const structural = /^(role|aria-label|data-view-name|data-test|id|data-id|data-urn|type)$/.test(a.name);
        return structural ? `${a.name}="${a.value.slice(0, 40)}"` : a.name;
      });
    return `<${e.tagName.toLowerCase()} ${safe.join(' ')}>`;
  };

  // The feed is a list of siblings that each hold a lot of text. Find the
  // deepest container whose direct children look like that, and its children
  // are the posts.
  let best = null;
  for (const e of document.querySelectorAll('main *')) {
    const kids = [...e.children];
    if (kids.length < 4) continue;
    const substantial = kids.filter((k) => (k.innerText || '').length > 150).length;
    if (substantial < 3) continue;
    if (!best || substantial > best.substantial) best = { el: e, substantial, kids: kids.length };
  }

  const report = [
    '--- attribute names by frequency (values withheld) ---',
    ...attrTop,
    '',
    '--- roles ---',
    ...[...roles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([r, c]) => `${c}\t${r}`),
    '',
    '--- likely feed container ---',
    best ? `${shape(best.el)}  (${best.kids} children, ${best.substantial} text-heavy)` : 'NONE FOUND',
    '',
    '--- shape of one post and its ancestors ---',
    ...(best
      ? (() => {
          const post = [...best.el.children].find((k) => (k.innerText || '').length > 150);
          const out = ['post: ' + shape(post)];
          // Descend to whatever holds the text, reporting each level's shape.
          let n = post, depth = 0;
          while (n && depth < 6) {
            const next = [...n.children].find((c) => (c.innerText || '').length > 100);
            if (!next) break;
            out.push('  > ' + shape(next));
            n = next;
            depth += 1;
          }
          return out;
        })()
      : [])
  ].join('\n');

  console.log(report);
  if (typeof copy === 'function') copy(report);
  return report;
})();
