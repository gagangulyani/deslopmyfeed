import { describe, it, expect } from 'vitest';
import { LABELS, loadCorpus, loadAll, wordCount } from './corpus.js';
import { MIN_WORDS_TO_ANALYZE } from '../src/detector/scoring.js';

/** Minimum sizes from the implementation plan, Phase 1. */
const MINIMUM = { human: 60, ai: 40, assisted: 20, adversarial: 15 };

/**
 * The false-positive budget is measured on human posts that are long enough
 * to be analyzed at all. Short posts pass the guard rail for free, so a corpus
 * full of them would flatter the number without testing anything.
 */
const MIN_ANALYZABLE_HUMAN = 50;

describe.each(LABELS)('%s corpus', (label) => {
  const posts = loadCorpus(label);

  it('meets the size floor from the plan', () => {
    expect(posts.length).toBeGreaterThanOrEqual(MINIMUM[label]);
  });

  it('every entry has the documented shape', () => {
    for (const post of posts) {
      expect(typeof post.id).toBe('string');
      expect(post.label).toBe(label);
      expect(typeof post.text).toBe('string');
      expect(post.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('ids are unique within the file', () => {
    expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length);
  });
});

describe('corpus as a whole', () => {
  const all = loadAll();

  it('ids are unique across every file', () => {
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });

  it('no two fixtures share the same text', () => {
    const texts = all.map((p) => p.text.trim());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('carries no contact details or links', () => {
    // Fixtures are the only place post text lives on disk. Keep them clean of
    // anything that could identify a person, per tests/fixtures/README.md.
    const banned = [
      /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,      // email
      /https?:\/\//i,                      // url
      /\+\d{1,3}[\s-]?\d{6,}/,             // phone with country code
      /\b\d{10}\b/                         // bare 10-digit number
    ];
    for (const post of all) {
      for (const pattern of banned) {
        expect(
          pattern.test(post.text),
          `${post.id} matches ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('has enough long human posts to make the FPR budget mean something', () => {
    const analyzable = loadCorpus('human')
      .filter((p) => wordCount(p.text) >= MIN_WORDS_TO_ANALYZE);
    expect(analyzable.length).toBeGreaterThanOrEqual(MIN_ANALYZABLE_HUMAN);
  });

  it('every non-human fixture is long enough to be analyzed', () => {
    // A slop fixture below the guard rail tests nothing: it can never be
    // filtered, so counting it as a miss would understate recall.
    for (const label of ['ai', 'assisted', 'adversarial']) {
      for (const post of loadCorpus(label)) {
        expect(
          wordCount(post.text),
          `${post.id} is below the analysis floor`
        ).toBeGreaterThanOrEqual(MIN_WORDS_TO_ANALYZE);
      }
    }
  });
});
