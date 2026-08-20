/**
 * Per-post analysis cost. Run with `npm run bench`.
 *
 * The budget is p95 < 50ms (spec §20). What matters is the shape of the tail,
 * not the mean: one pathological post that takes 400ms is a scroll stutter the
 * user feels, while a slightly higher average is invisible.
 */
import { performance } from 'node:perf_hooks';
import { loadAll } from './corpus.js';
import { analyze } from '../src/detector/scoring.js';

const BUDGET_P95_MS = 50;
const ROUNDS = 20;

const posts = loadAll();
const settings = { mode: 'hide' };

// Warm up so the first-run compile cost does not land in the sample.
for (const post of posts) analyze(post.text, settings);

const timings = [];
for (let round = 0; round < ROUNDS; round += 1) {
  for (const post of posts) {
    const started = performance.now();
    analyze(post.text, settings);
    timings.push(performance.now() - started);
  }
}

timings.sort((a, b) => a - b);
const at = (p) => timings[Math.min(timings.length - 1, Math.floor(timings.length * p))];
const total = timings.reduce((a, b) => a + b, 0);

const report = {
  posts: posts.length,
  samples: timings.length,
  mean: total / timings.length,
  p50: at(0.5),
  p95: at(0.95),
  p99: at(0.99),
  max: timings[timings.length - 1]
};

const ms = (n) => `${n.toFixed(3)}ms`;
console.log(`analyze() over ${report.posts} posts x ${ROUNDS} rounds`);
console.log(`  mean ${ms(report.mean)}  p50 ${ms(report.p50)}  p95 ${ms(report.p95)}  p99 ${ms(report.p99)}  max ${ms(report.max)}`);
console.log(`  budget p95 < ${BUDGET_P95_MS}ms: ${report.p95 < BUDGET_P95_MS ? 'ok' : 'BREACHED'}`);

// A whole feed screen at once, which is what the observer actually hands over.
const batchStart = performance.now();
for (const post of posts.slice(0, 25)) analyze(post.text, settings);
console.log(`  25 posts in one pass: ${ms(performance.now() - batchStart)}`);

if (report.p95 >= BUDGET_P95_MS) process.exit(1);
