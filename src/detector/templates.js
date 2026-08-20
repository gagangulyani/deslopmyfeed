import { signal, noSignal } from './rule.js';

/**
 * 6.1 Rhetorical templates.
 * One match contributes very little; distinct templates matter.
 *
 * Scoring is deliberately sub-linear. Any single one of these phrases is a
 * thing a person might write once; three different ones in one post is a
 * register, not a coincidence.
 */
const SCORE_BY_DISTINCT_MATCHES = { 1: 0.25, 2: 0.6 };

/** @type {import('./rule.js').Rule} */
export function templates(features) {
  const text = features.raw ?? '';
  if (!text) return noSignal('templates');

  const evidence = [];
  for (const pattern of TEMPLATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) evidence.push(match[0].trim());
  }

  if (evidence.length === 0) return noSignal('templates');

  const score = SCORE_BY_DISTINCT_MATCHES[evidence.length] ?? 1;
  return signal('templates', score, evidence);
}

/** Seed patterns. Editable, stored locally, extended by the user. */
export const TEMPLATE_PATTERNS = [
  /here'?s what i learned/i,
  /here'?s (?:how|why|what) (?:i|we|you|to|changed|nobody)/i,
  /here'?s the thing/i,
  /here'?s the (?:difference|framework|playbook|math|shift)/i,
  /the key is/i,
  /the real problem is/i,
  /the result\?/i,
  /the lesson is/i,
  /it'?s not [^.,;\n]{1,30}, it'?s/i,
  /\b(?:isn'?t|is not) [^.\n]{1,40}\.\s*it'?s\b/i,
  /stop [^.,;\n]{1,30}\.?\s*start/i,
  /nobody (?:tells|talks about|is talking about|warns)/i,
  /unpopular opinion/i,
  /the (?:uncomfortable|honest|hard|real) truth/i,
  /here'?s the uncomfortable part/i,
  /let that sink in/i,
  /read that again/i,
  /steal this/i,
  /and that'?s okay\b/i,
  /the (?:best|worst) [^.\n]{1,30} i ever (?:received|got|made|heard|had)/i,
  /\bmost (?:people|leaders|founders|managers) (?:get|miss|think)\b/i,
  /what (?:most|nobody) (?:people )?(?:miss|misses|tells you)/i,
  /\b(?:get|stay) ahead of (?:most|\d+%)\b/i,
  /\bdo this instead\b/i,
  /\b(?:the )?secret is\b/i,
  /\bthings i wish i knew\b/i
];
