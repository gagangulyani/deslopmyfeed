import { loadCorpus, LABELS, wordCount } from './corpus.js';
import { analyze, MIN_WORDS_TO_ANALYZE } from '../src/detector/scoring.js';

/**
 * The false-positive budget from the plan. Recall is deliberately not budgeted:
 * this project trades recall away for precision (spec §29.5), so a low recall
 * is a documented cost, not a build failure.
 */
export const FPR_BUDGET = { hide: 0.05, warn: 0.15 };

const pct = (n) => `${(n * 100).toFixed(1)}%`;

/**
 * Run `analyze` over every fixture and summarize.
 *
 * Only posts at or above the analysis floor are counted. Shorter posts are
 * unfilterable by design, so including them would inflate precision and deflate
 * recall without either number meaning anything.
 *
 * @param {{settings?: Object, rules?: Object}} [options]
 */
export function evaluate({ settings, rules } = {}) {
  // mode 'hide' so both verdicts are reachable; the corpus measures the
  // detector, not the display preference.
  const config = { mode: 'hide', ...settings };
  const rows = {};

  for (const label of LABELS) {
    const posts = loadCorpus(label);
    const analyzed = posts.filter((p) => wordCount(p.text) >= MIN_WORDS_TO_ANALYZE);
    const results = analyzed.map((post) => ({
      post,
      analysis: analyze(post.text, config, rules)
    }));

    const hidden = results.filter((r) => r.analysis.verdict === 'hide');
    const warned = results.filter((r) => r.analysis.verdict === 'warn');

    rows[label] = {
      total: posts.length,
      analyzed: analyzed.length,
      hidden,
      warned,
      flagged: hidden.length + warned.length,
      rateHide: analyzed.length ? hidden.length / analyzed.length : 0,
      rateFlag: analyzed.length ? (hidden.length + warned.length) / analyzed.length : 0
    };
  }

  const slopFlagged = rows.ai.flagged + rows.adversarial.flagged;
  const allFlagged = slopFlagged + rows.human.flagged;

  return {
    rows,
    fpr: { hide: rows.human.rateHide, warn: rows.human.rateFlag },
    recall: { ai: rows.ai.rateFlag, adversarial: rows.adversarial.rateFlag },
    // `assisted` is excluded: it is neither a positive nor a negative class.
    precision: allFlagged ? slopFlagged / allFlagged : null
  };
}

/** @param {ReturnType<typeof evaluate>} summary */
export function formatTable(summary) {
  const header = 'label         total  analyzed  warned  hidden   flagged%';
  const lines = LABELS.map((label) => {
    const r = summary.rows[label];
    return [
      label.padEnd(13),
      String(r.total).padStart(5),
      String(r.analyzed).padStart(10),
      String(r.warned.length).padStart(8),
      String(r.hidden.length).padStart(7),
      pct(r.rateFlag).padStart(11)
    ].join('');
  });

  return [
    header,
    ...lines,
    '',
    `false positives   hide ${pct(summary.fpr.hide)} (budget ${pct(FPR_BUDGET.hide)})` +
      `   warn+ ${pct(summary.fpr.warn)} (budget ${pct(FPR_BUDGET.warn)})`,
    `recall            ai ${pct(summary.recall.ai)}   adversarial ${pct(summary.recall.adversarial)}`,
    `precision         ${summary.precision === null ? 'n/a (nothing flagged)' : pct(summary.precision)}`
  ].join('\n');
}

/**
 * @param {ReturnType<typeof evaluate>} summary
 * @returns {string[]} one message per budget breach; empty means within budget.
 */
export function budgetViolations(summary) {
  const breaches = [];
  if (summary.fpr.hide > FPR_BUDGET.hide) {
    breaches.push(`hide FPR ${pct(summary.fpr.hide)} exceeds ${pct(FPR_BUDGET.hide)}`);
  }
  if (summary.fpr.warn > FPR_BUDGET.warn) {
    breaches.push(`warn FPR ${pct(summary.fpr.warn)} exceeds ${pct(FPR_BUDGET.warn)}`);
  }
  return breaches;
}
