import { describe, it, expect } from 'vitest';
import {
  analyze,
  RULES,
  STRONG_RULES,
  CONSERVATIVE_MULTIPLIER,
  SENSITIVITY_OFFSETS,
  MIN_WORDS_TO_ANALYZE,
  SHORT_POST_FLOOR
} from '../../src/detector/scoring.js';
import { signal, noSignal } from '../../src/detector/rule.js';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.js';

/** Text long enough to clear the conservative band entirely. */
const LONG = 'word '.repeat(150);
/** Text inside the 50-100 word conservative band. */
const MEDIUM = 'word '.repeat(60);
/** Text inside the short band: judged, but the verdict is capped at warn. */
const SHORT = 'word '.repeat(20);

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
  it('never judges a post below the short-post floor', () => {
    const everything = stub(Object.fromEntries(Object.keys(RULES).map((id) => [id, 1])));
    const result = analyze('word '.repeat(SHORT_POST_FLOOR - 1), HIDE_MODE, everything);
    expect(result.verdict).toBe('show');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('too short to judge');
  });

  it('the floor is measured in words, not characters', () => {
    const justUnder = 'word '.repeat(SHORT_POST_FLOOR - 1);
    const justOver = 'word '.repeat(SHORT_POST_FLOOR);
    const rules = stub({ templateStacking: 1, formatting: 1 });
    expect(analyze(justUnder, HIDE_MODE, rules).score).toBe(0);
    expect(analyze(justOver, HIDE_MODE, rules).score).toBeGreaterThan(0);
  });

  it('a short post can be flagged but never hidden, at any weight', () => {
    const everything = stub(Object.fromEntries(Object.keys(RULES).map((id) => [id, 1])));
    const weights = Object.fromEntries(Object.keys(RULES).map((id) => [id, 9]));
    const result = analyze(SHORT, { ...HIDE_MODE, weights }, everything);
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.hide);
    expect(result.verdict).toBe('warn');
  });

  it('does not warn on a short-post dash without another signal', () => {
    const dashOnly = {
      formatting: () => signal('formatting', 0.5, ['short post uses a dash separator'])
    };
    const result = analyze(SHORT, { ...HIDE_MODE, weights: { formatting: 9 } }, dashOnly);
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.warn);
    expect(result.verdict).toBe('show');
  });

  it('allows a short-post dash to corroborate another signal', () => {
    const corroborated = {
      formatting: () => signal('formatting', 0.5, ['short post uses a dash separator']),
      templateStacking: () => signal('templateStacking', 1, ['stock hook'])
    };
    const result = analyze(SHORT, {
      ...HIDE_MODE,
      weights: { formatting: 9, templateStacking: 9 }
    }, corroborated);
    expect(result.verdict).toBe('warn');
  });

  it('the hide verdict still needs the full analysis floor', () => {
    const rules = stub({ templateStacking: 1, vocabulary: 1 });
    const weights = { templateStacking: 9, vocabulary: 9 };
    const short = 'word '.repeat(MIN_WORDS_TO_ANALYZE - 1);
    const full = 'word '.repeat(MIN_WORDS_TO_ANALYZE);
    expect(analyze(short, { ...HIDE_MODE, weights }, rules).verdict).toBe('warn');
    expect(analyze(full, { ...HIDE_MODE, weights }, rules).verdict).toBe('hide');
  });
});

describe('guard rail: non-English posts', () => {
  it('does not score Hinglish with English-only rules', () => {
    const hinglish = 'bhai yeh hai matlab sabse zyada generic post '.repeat(3);
    const everything = stub(Object.fromEntries(Object.keys(RULES).map((id) => [id, 1])));
    const result = analyze(hinglish, HIDE_MODE, everything);
    expect(result.verdict).toBe('show');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('non-English text');
  });
});

describe('structural input', () => {
  it('accepts the object readPost returns, not only a bare string', () => {
    const post = { text: LONG, headline: 'CEO at Example', reactions: 12, comments: 3 };
    const result = analyze(post, HIDE_MODE, stub({ templateStacking: 1 }));
    expect(result.score).toBe(3);
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

  it('uses the configured hide threshold after a post qualifies for hiding', () => {
    const rules = stub({ templateStacking: 1, vocabulary: 1 });
    const low = analyze(LONG, { mode: 'hide', thresholds: { warn: 2.5, hide: 2.5 } }, rules);
    const high = analyze(LONG, { mode: 'hide', thresholds: { warn: 2.5, hide: 5 } }, rules);
    expect(low.verdict).toBe('hide');
    expect(high.verdict).toBe('warn');
  });

  it('does not treat two layout rules as independent hide corroboration', () => {
    const result = analyze(LONG, HIDE_MODE, stub({ templateStacking: 0.5, formatting: 0.5 }));
    expect(result.score).toBe(DEFAULT_SETTINGS.thresholds.warn);
    expect(result.verdict).toBe('warn');
  });

  it('does not hide a concrete first-person event account', () => {
    const text = [
      'I hosted a meetup with Anuvrat and Nupur in Delhi last Saturday.',
      'I shared the event link after June 20th.',
      'The conversations were thoughtful and I learned a lot from the group.',
      LONG
    ].join(' ');
    const result = analyze(text, HIDE_MODE, stub({ templateStacking: 1, vocabulary: 1 }));
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.thresholds.warn);
    expect(result.verdict).toBe('warn');
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
  // Pin the thresholds in the test so it measures the offsets, not the defaults.
  const thresholds = { warn: 5, hide: 9 };
  const onTheLine = stub({ templateStacking: 1, formatting: 1 }); // 3 + 2 = 5

  it('medium uses the configured thresholds unchanged', () => {
    expect(SENSITIVITY_OFFSETS.medium).toBe(0);
    expect(analyze(LONG, { thresholds, sensitivity: 'medium' }, onTheLine).verdict).toBe('warn');
  });

  it('low raises the bar above the same score', () => {
    expect(SENSITIVITY_OFFSETS.low).toBeGreaterThan(0);
    expect(analyze(LONG, { thresholds, sensitivity: 'low' }, onTheLine).verdict).toBe('show');
  });

  it('high lowers it', () => {
    expect(SENSITIVITY_OFFSETS.high).toBeLessThan(0);
    const quiet = stub({ templateStacking: 1 }); // 3, under the warn threshold
    const raised = { thresholds: { warn: 3 - SENSITIVITY_OFFSETS.high / 2, hide: 9 } };
    expect(analyze(LONG, { ...raised, sensitivity: 'medium' }, quiet).verdict).toBe('show');
    expect(analyze(LONG, { ...raised, sensitivity: 'high' }, quiet).verdict).toBe('warn');
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
