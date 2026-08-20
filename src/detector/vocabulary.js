import { signal, noSignal } from './rule.js';

/**
 * 6.5 Vocabulary clusters.
 * Scores co-occurrence across groups, never a single word.
 *
 * Every word below is a word people legitimately use. "Journey" in a post about
 * a career change is not evidence of anything. The same post also reaching for
 * "mindset" and "ultimately" is a register, and the register is the signal — so
 * this rule only counts hits in two or more different groups.
 */
const MIN_GROUPS = 2;

/** @type {import('./rule.js').Rule} */
export function vocabulary(features, settings) {
  const { lower = '' } = features;
  if (!lower) return noSignal('vocabulary');

  const groups = mergeGroups(settings?.customVocabulary);
  const hitGroups = [];
  const evidence = [];

  for (const [name, terms] of Object.entries(groups)) {
    const hits = terms.filter((term) => containsTerm(lower, term));
    if (hits.length === 0) continue;
    hitGroups.push(name);
    evidence.push(...hits.slice(0, 3));
  }

  if (hitGroups.length < MIN_GROUPS) return noSignal('vocabulary');

  return signal('vocabulary', hitGroups.length >= 3 ? 1 : 0.5, evidence);
}

/** Word-boundary match so "impact" does not fire on "impactful"'s neighbours. */
function containsTerm(lower, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'i').test(lower);
}

/** User terms are merged in, never replacing the seed groups. */
function mergeGroups(custom) {
  if (!custom) return VOCABULARY_GROUPS;
  const merged = {};
  for (const [name, terms] of Object.entries(VOCABULARY_GROUPS)) {
    merged[name] = custom[name] ? [...terms, ...custom[name]] : terms;
  }
  for (const [name, terms] of Object.entries(custom)) {
    if (!merged[name]) merged[name] = terms;
  }
  return merged;
}

/** Seed dictionaries. Merged with user additions from chrome.storage.local. */
export const VOCABULARY_GROUPS = {
  corporateAbstraction: [
    'leverage', 'navigate', 'landscape', 'ecosystem', 'unlock', 'elevate',
    'dynamic', 'alignment', 'empower', 'transformative', 'seamless',
    'north star', 'double down', 'best-in-class', 'game-changer', 'at scale',
    'learnings', 'value-add', 'synergy'
  ],
  inspiration: [
    'journey', 'mindset', 'growth mindset', 'impact', 'meaningful', 'purpose',
    'possibility', 'resilience', 'authentic', 'intentional', 'thrive',
    'humbled', 'thrilled to', 'delighted to announce', 'grateful for the',
    'compounds', 'showing up', 'the grind', 'inspiring'
  ],
  discourse: [
    'ultimately', 'more importantly', 'at its core', "it's worth noting",
    'in today', 'the reality is', 'that said', 'what if i told you',
    'the truth is', 'and yet', 'but here', 'the difference is',
    'which is why', 'that is the entire'
  ]
};
