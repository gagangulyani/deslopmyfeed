import { signal, noSignal } from './rule.js';

/**
 * 6.2 Template stacking — the strongest single detector.
 * Looks for hook + story + numbered lessons + generic close appearing together,
 * not for any one of them alone.
 *
 * Each component below is common in ordinary human writing. What is not common
 * is all of them arranged in the same order in the same post, which is why this
 * rule scores co-presence and refuses to fire on a single component.
 */

/** A hook is a very short opening paragraph that withholds rather than informs. */
const HOOK_MAX_WORDS = 12;

/** Enumerated blocks below this length are just a list; above it, a format. */
const MIN_ENUMERATED_ITEMS = 3;

/** Fragmentation: standalone one-sentence paragraphs used as beats. */
const MIN_FRAGMENT_PARAGRAPHS = 4;

const ENUMERATION = /^(?:\d{1,2}[.)]\s|[-•*→▪]\s|[0-9]️?⃣\s)/;

/** Closing moves: aphorism, imperative, or a rhetorical question at the end. */
const GENERIC_CLOSE = [
  /^(?:stay|start|stop|choose|decide|remember|build|protect|steal|hire|ship|do|be|never|always)\b/i,
  /\b(?:agree|thoughts|what would you add|which one|what's your|whats your)\b.*\?$/i,
  /^(?:the (?:truth|point|lesson|result|question|difference)|that(?:'| i)s the (?:whole )?(?:job|point|answer))\b/i,
  /\bcompounds?\.$|\bis a (?:choice|kindness|posture|system|muscle|practice)\.$/i
];

const wordsIn = (text) => (text.match(/[a-z0-9']+/gi) ?? []).length;

/** Trailing hashtag-only lines are packaging, not the close. */
function contentLines(lines) {
  const out = lines.slice();
  while (out.length && /^(?:#[\w]+\s*)+$/.test(out[out.length - 1])) out.pop();
  return out;
}

/** @type {import('./rule.js').Rule} */
export function stacking(features) {
  const { paragraphs = [], lines = [] } = features;
  const body = contentLines(lines);
  if (body.length < 4) return noSignal('templateStacking');

  const evidence = [];
  let components = 0;

  // A first line ending in a colon introduces the list under it. That is how
  // people write notes; a hook withholds instead of introducing, so it does not
  // end in a colon.
  const first = paragraphs[0] ?? '';
  const isHook =
    paragraphs.length >= 3 &&
    wordsIn(first) <= HOOK_MAX_WORDS &&
    !first.endsWith(':') &&
    !ENUMERATION.test(first);

  if (isHook) {
    components += 1;
    evidence.push(`opens on a ${wordsIn(first)}-word hook: "${first}"`);
  }

  const enumerated = body.filter((line) => ENUMERATION.test(line));
  if (enumerated.length >= MIN_ENUMERATED_ITEMS) {
    components += 1;
    evidence.push(`${enumerated.length} enumerated items`);
  }

  const fragments = paragraphs.filter((p) => !p.includes('\n') && wordsIn(p) <= 20);
  if (fragments.length >= MIN_FRAGMENT_PARAGRAPHS) {
    components += 1;
    evidence.push(`${fragments.length} one-line paragraphs used as beats`);
  }

  const close = body[body.length - 1] ?? '';
  if (wordsIn(close) <= 15 && GENERIC_CLOSE.some((p) => p.test(close))) {
    components += 1;
    evidence.push(`closes on a stock line: "${close}"`);
  }

  // Co-presence only. One component is a writing choice; three is a template.
  if (components < 2) return noSignal('templateStacking');

  const score = { 2: 0.45, 3: 0.75, 4: 1 }[components] ?? 1;
  return signal('templateStacking', score, evidence);
}
