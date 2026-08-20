import { describe, it, expect } from 'vitest';
import { stacking } from '../../src/detector/stacking.js';
import { extractFeatures } from '../../src/detector/features.js';
import { loadCorpus } from '../corpus.js';

const run = (text) => stacking(extractFeatures(text), {});
const fixture = (label, id) => loadCorpus(label).find((p) => p.id === id).text;

describe('template stacking', () => {
  it('fires when hook, enumeration, fragmentation and close appear together', () => {
    const result = run(fixture('ai', 'ai-001'));
    expect(result.triggered).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it('reports the rule id it is registered under', () => {
    expect(run(fixture('ai', 'ai-011')).rule).toBe('templateStacking');
  });
});

describe('template stacking does not fire on human posts that look similar', () => {
  // Each of these carries one or two components. The rule requires co-presence,
  // so a human who writes lists is not a false positive.
  it.each([
    ['human-004', 'meeting notes: colon intro plus three bullets'],
    ['human-010', 'numbered list of three fixes with a specific close'],
    ['human-051', 'a bulleted book list, the most template-shaped human post']
  ])('%s (%s)', (id) => {
    expect(run(fixture('human', id)).triggered).toBe(false);
  });

  it('a list on its own is never enough', () => {
    const listOnly = [
      'We shipped the migration this week and I want to record what broke,',
      'because I will forget by March and someone will ask.',
      '',
      '1. The connection pool was sized for the old instance class',
      '2. Two cron jobs ran against the replica and returned stale rows',
      '3. Our health check did not cover the write path at all',
      '',
      'All three are fixed. The health check one took the longest because it',
      'needed a real write and a cleanup, and nobody wanted to own that.'
    ].join('\n');
    expect(run(listOnly).triggered).toBe(false);
  });

  it('a short opening line on its own is never enough', () => {
    const hookOnly = [
      'We deleted the legacy service.',
      '',
      'It had been running since 2018 on an instance nobody could account for,',
      'serving one nightly report to eleven people, of whom one read it.',
      'Shutting it down took four weeks of asking who depended on it and',
      'getting no answer, then two minutes of terminating the instance.'
    ].join('\n');
    expect(run(hookOnly).triggered).toBe(false);
  });
});
