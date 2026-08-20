import { describe, it, expect } from 'vitest';
import {
  analyze,
  RULES,
  STRONG_RULES,
  CONSERVATIVE_MULTIPLIER,
  MIN_WORDS_TO_ANALYZE
} from '../../src/detector/scoring.js';
import { signal, noSignal } from '../../src/detector/rule.js';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.js';

/** Text long enough to clear the conservative band entirely. */
const LONG = 'word '.repeat(150);
/** Text inside the 50-100 word conservative band. */
const MEDIUM = 'word '.repeat(60);
/** Text below the analysis floor. */
const SHORT = 'word '.repeat(10);

/**
 * Build a rule registry where each rule reports a fixed score, so composition
 * can be tested without any detector being implemented.
 * @param {Record<string, number>} scores
 */
function stub(scores) {
  const rules = {};
  for (const [id, score] of Object.entries(scores)) {
    rules[id] = () => (score > 0 ? signal(id, score, [`${id} evidence`]) : noSignal(id));
  }
  return rules;
}

const HIDE_MODE = { mode: 'hide' };

describe('composition', () => {
  it('multiplies each rule score by its weight and sums', () => {
    // templateStacking weight 3 at full strength, vocabulary weight 1 at half.
    const result = analyze(LONG, HIDE_MODE, stub({ templateStacking: 1, vocabulary: 0.5 }));
    expect(result.score).toBe(3.5);
  });

  it('clamps a rule that reports more than 1', () => {
    const result = analyze(LONG, HIDE_MODE, stub({ templateStacking: 99 }));
    expect(result.score).toBe(DEFAULT_SETTINGS.weights.templateStacking);
  });

  it('reports only triggered rules', () => {
    const result = analyze(LONG, HIDE_MODE, stub({ templateStacking: 1, hashtags: 0 }));
    expect(result.results.map((r) => r.rule)).toEqual(['templateStacking']);
  });

  it('skips a rule the user has turned off', () => {
    const settings = { ...HIDE_MODE, rules: { templateStacking: false } };
    const result = analyze(LONG, settings, stub({ templateStacking: 1, formatting: 1 }));
    expect(result.results.map((r) => r.rule)).toEqual(['formatting']);
  });
});

describe('guard rail: short posts', () => {
  it('never filters a post below the analysis floor', () => {
    const everything = stub(Object.fromEntries(Object.keys(RULES).map((id) => [id, 1])));
    const result = analyze(SHORT, HIDE_MODE, everything);
    expect(result.verdict).toBe('show');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('too short to judge');
  });

  it('the floor is measured in words, not characters', () => {
    const justUnder = 'word '.repeat(MIN_WORDS_TO_ANALYZE - 1);
    const justOver = 'word '.repeat(MIN_WORDS_TO_ANALYZE);
    const rules = stub({ templateStacking: 1, formatting: 1 });
    expect(analyze(justUnder, HIDE_MODE, rules).score).toBe(0);
    expect(analyze(justOver, HIDE_MODE, rules).score).toBeGreaterThan(0);
  });
});

describe('guard rail: conservative band', () => {
  it('discounts posts between the floor and the ceiling', () => {
    const rules = stub({ templateStacking: 1 });
    const long = analyze(LONG, HIDE_MODE, rules).score;
    const medium = analyze(MEDIUM, HIDE_MODE, rules).score;
    expect(medium).toBeCloseTo(long * CONSERVATIVE_MULTIPLIER, 5);
  });
});

describe('guard rail: hiding needs corroboration', () => {
  const overHide = { ...HIDE_MODE, weights: { templateStacking: 9, vocabulary: 9 } };

  it('will not hide on one strong rule alone', () => {
    const result = analyze(LONG, overHide, stub({ templateStacking: 1 }));
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.hide);
    expect(result.verdict).toBe('warn');
  });

  it('will not hide on weak rules alone, however many', () => {
    const weak = Object.keys(RULES).filter((id) => !STRONG_RULES.includes(id));
    const scores = Object.fromEntries(weak.map((id) => [id, 1]));
    const weights = Object.fromEntries(weak.map((id) => [id, 9]));
    const result = analyze(LONG, { ...HIDE_MODE, weights }, stub(scores));
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.hide);
    expect(result.verdict).toBe('warn');
  });

  it('hides when a strong rule is corroborated by a second rule', () => {
    const result = analyze(LONG, overHide, stub({ templateStacking: 1, vocabulary: 1 }));
    expect(result.verdict).toBe('hide');
  });
});

describe('modes', () => {
  const strong = stub({ templateStacking: 1, formatting: 1 });
  const heavy = { weights: { templateStacking: 9, formatting: 9 } };

  it('warn mode never hides', () => {
    const result = analyze(LONG, { ...heavy, mode: 'warn' }, strong);
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.hide);
    expect(result.verdict).toBe('warn');
  });

  it('off mode analyzes nothing', () => {
    const result = analyze(LONG, { ...heavy, mode: 'off' }, strong);
    expect(result).toEqual({ verdict: 'show', score: 0, results: [], reason: 'filtering is off' });
  });

  it('the global kill switch wins over every other setting', () => {
    const result = analyze(LONG, { ...heavy, mode: 'hide', enabled: false }, strong);
    expect(result.verdict).toBe('show');
    expect(result.results).toEqual([]);
  });
});

describe('sensitivity', () => {
  // Score of exactly 5 sits on the default warn threshold.
  const rules = stub({ templateStacking: 1, formatting: 1 });

  it('medium uses the configured thresholds', () => {
    expect(analyze(LONG, { sensitivity: 'medium' }, rules).verdict).toBe('warn');
  });

  it('low raises the bar', () => {
    expect(analyze(LONG, { sensitivity: 'low' }, rules).verdict).toBe('show');
  });

  it('high lowers it', () => {
    const quiet = stub({ templateStacking: 1 });
    expect(analyze(LONG, { sensitivity: 'medium' }, quiet).verdict).toBe('show');
    expect(analyze(LONG, { sensitivity: 'high' }, quiet).verdict).toBe('warn');
  });
});

describe('registry integrity', () => {
  it('each rule reports the id it is registered under', () => {
    const features = { wordCount: 0, words: [], lines: [], paragraphs: [], sentences: [],
      hashtags: [], emDashCount: 0, digitGroups: 0, raw: '', lower: '' };
    for (const [id, rule] of Object.entries(RULES)) {
      expect(rule(features, DEFAULT_SETTINGS).rule).toBe(id);
    }
  });
});
