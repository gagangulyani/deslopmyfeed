import { signal, noSignal } from './rule.js';

/**
 * 6.3 Genericity / low specificity.
 * Broad claims, few dates, numbers, named entities or concrete events.
 * Measures low-information writing, not "bad" writing.
 *
 * This is the detector most likely to hide something the reader wanted: a short,
 * well-written human post about an abstract subject scores exactly like slop on
 * every measure available without NLP (spec §20 forbids a dependency).
 *
 * It therefore requires BOTH conditions at once — high abstraction AND low
 * specificity — and both thresholds sit outside the human corpus rather than at
 * the edge of it. The margin is thin and measured on a small authored corpus;
 * treat any change to these two numbers as a change that needs the metrics run.
 */
const ABSTRACT_PER_100_WORDS = 4;
const SPECIFIC_PER_100_WORDS = 2.5;

/** Unambiguous: full strength rather than the floor. */
const ABSTRACT_STRONG = 6;
const SPECIFIC_VERY_LOW = 1;

/** Suffixes that mark a noun as an abstraction rather than a thing. */
const ABSTRACT_SUFFIX = /(?:ity|ness|ment|tion|sion|ance|ence|ship|ism)$/;

/** Dates and named periods are the cheapest form of concreteness. */
const TIME_MARKER =
  /^(?:january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tonight|q[1-4]|\d{4})$/;

/**
 * Capitalized tokens that are not sentence-initial: a dependency-free proxy for
 * named entities. Over-counts sentence fragments and under-counts lowercase
 * brand names; it is a density signal, not a parser.
 */
function properNounCount(sentences) {
  let count = 0;
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    for (let i = 1; i < tokens.length; i += 1) {
      if (/^[A-Z][a-z']{2,}/.test(tokens[i])) count += 1;
    }
  }
  return count;
}

/** @type {import('./rule.js').Rule} */
export function genericity(features) {
  const { words = [], sentences = [], wordCount = 0, digitGroups = 0 } = features;
  if (wordCount === 0) return noSignal('genericity');

  const abstractWords = words.filter((w) => w.length > 5 && ABSTRACT_SUFFIX.test(w));
  const timeWords = words.filter((w) => TIME_MARKER.test(w));

  const abstraction = (abstractWords.length / wordCount) * 100;
  const specificity =
    ((digitGroups + properNounCount(sentences) + timeWords.length) / wordCount) * 100;

  if (abstraction < ABSTRACT_PER_100_WORDS || specificity > SPECIFIC_PER_100_WORDS) {
    return noSignal('genericity');
  }

  const emphatic = abstraction >= ABSTRACT_STRONG || specificity <= SPECIFIC_VERY_LOW;
  const evidence = [
    `few concrete details: ${digitGroups} numbers in ${wordCount} words`,
    `abstract vocabulary: ${abstractWords.slice(0, 4).join(', ')}`
  ];

  return signal('genericity', emphatic ? 1 : 0.6, evidence);
}
