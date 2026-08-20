import { describe, it, expect } from 'vitest';
import { noSignal } from '../../src/detector/rule.js';
import { RULES, STRONG_RULES } from '../../src/detector/scoring.js';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.js';

describe('rule contract', () => {
  it('noSignal produces a zero-score result', () => {
    expect(noSignal('templates')).toEqual({
      rule: 'templates',
      triggered: false,
      score: 0,
      evidence: []
    });
  });
});

describe('settings schema', () => {
  it('every registered rule has a toggle and a weight', () => {
    for (const id of Object.keys(RULES)) {
      expect(DEFAULT_SETTINGS.rules).toHaveProperty(id);
      expect(DEFAULT_SETTINGS.weights).toHaveProperty(id);
    }
  });

  it('every strong rule is a registered rule', () => {
    for (const id of STRONG_RULES) {
      expect(Object.keys(RULES)).toContain(id);
    }
  });

  it('weak rules alone cannot reach the hide threshold', () => {
    const weak = Object.keys(RULES).filter((id) => !STRONG_RULES.includes(id));
    const total = weak.reduce((sum, id) => sum + DEFAULT_SETTINGS.weights[id], 0);
    expect(total).toBeLessThan(DEFAULT_SETTINGS.thresholds.hide);
  });
});
