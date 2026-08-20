import { describe, it, expect } from 'vitest';
import { templates } from '../../src/detector/templates.js';
import { extractFeatures } from '../../src/detector/features.js';
import { loadCorpus } from '../corpus.js';

const run = (text) => templates(extractFeatures(text), {});
const fixture = (label, id) => loadCorpus(label).find((p) => p.id === id).text;

describe('rhetorical templates', () => {
  it('scores a single match as near-noise', () => {
    const one = run('Nobody tells you that the first year of running a shop is mostly paperwork.');
    expect(one.triggered).toBe(true);
    expect(one.score).toBeLessThanOrEqual(0.25);
  });

  it('scores distinct templates sub-linearly, not by count', () => {
    const two = run("Here's the thing. The key is consistency.");
    const three = run("Here's the thing. The key is consistency. Unpopular opinion: it is not.");
    expect(two.score).toBeGreaterThan(0.25);
    expect(three.score).toBeGreaterThan(two.score);
    expect(three.score).toBe(1);
  });

  it('counts a repeated phrase once', () => {
    const once = run('The key is consistency.');
    const twice = run('The key is consistency. The key is showing up.');
    expect(twice.score).toBe(once.score);
  });

  it('quotes what it matched as evidence', () => {
    const result = run('Unpopular opinion: most people get this wrong.');
    expect(result.evidence).toContain('Unpopular opinion');
  });
});

describe('rhetorical templates on human posts', () => {
  it('the two human posts that do match stay at the noise floor', () => {
    // Both use one stock phrase in otherwise concrete writing. A single phrase
    // must never be enough to matter on its own.
    for (const id of ['human-016', 'human-081']) {
      expect(run(fixture('human', id)).score).toBeLessThanOrEqual(0.25);
    }
  });

  it.each([
    ['human-050', 'incident writeup with a lessons-shaped ending'],
    ['human-069', 'a failure retrospective, the highest-risk human shape'],
    ['human-077', 'estimates post that explains a rule of thumb']
  ])('does not fire on %s (%s)', (id) => {
    expect(run(fixture('human', id)).triggered).toBe(false);
  });
});
