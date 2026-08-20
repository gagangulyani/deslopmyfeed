import { describe, it, expect } from 'vitest';
import { evaluate, formatTable, budgetViolations, FPR_BUDGET } from './metrics.js';
import { signal } from '../src/detector/rule.js';

describe('detector metrics', () => {
  const summary = evaluate();

  it('reports the corpus table', () => {
    console.log('\n' + formatTable(summary) + '\n');
    expect(summary.rows.human.analyzed).toBeGreaterThan(0);
  });

  it('stays inside the false-positive budget', () => {
    const flagged = summary.rows.human.hidden
      .concat(summary.rows.human.warned)
      .map((r) => `${r.post.id} [${r.analysis.verdict} ${r.analysis.score}] ${r.analysis.reason}`);

    expect(budgetViolations(summary), flagged.join('\n')).toEqual([]);
  });
});

describe('the harness itself fails when it should', () => {
  // Guards against the failure mode where the budget check silently passes
  // because nothing is ever flagged.
  const flagEverything = {
    templateStacking: () => signal('templateStacking', 1, ['stub']),
    formatting: () => signal('formatting', 1, ['stub'])
  };

  it('detects a breach when every post is flagged', () => {
    const broken = evaluate({ rules: flagEverything });
    expect(broken.fpr.warn).toBeGreaterThan(FPR_BUDGET.warn);
    expect(budgetViolations(broken).length).toBeGreaterThan(0);
  });
});
