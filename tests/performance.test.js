import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { loadAll } from './corpus.js';
import { analyze } from '../src/detector/scoring.js';

/**
 * The real budget is 50ms (spec §20) and the bench measures ~0.17ms at p95.
 * This asserts a much looser 5ms so it catches a detector that starts doing
 * something quadratic, without failing on a loaded CI machine.
 */
const REGRESSION_CEILING_MS = 5;

describe('analysis cost', () => {
  it('stays far inside the per-post budget', () => {
    const posts = loadAll();
    const settings = { mode: 'hide' };
    for (const post of posts) analyze(post.text, settings); // warm up

    const timings = posts.map((post) => {
      const started = performance.now();
      analyze(post.text, settings);
      return performance.now() - started;
    });

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95)];
    expect(p95, `p95 was ${p95.toFixed(3)}ms`).toBeLessThan(REGRESSION_CEILING_MS);
  });

  it('does not blow up on a pathologically long post', () => {
    // 40x the longest fixture. The detectors are all linear scans over the
    // shared feature object; if one is not, this is where it shows.
    const long = loadAll().map((p) => p.text).join('\n\n');
    const started = performance.now();
    analyze(long, { mode: 'hide' });
    const elapsed = performance.now() - started;
    expect(elapsed, `${elapsed.toFixed(1)}ms`).toBeLessThan(250);
  });
});
