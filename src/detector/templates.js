import { noSignal } from './rule.js';

/**
 * 6.1 Rhetorical templates.
 * One match contributes very little; distinct templates matter.
 * @type {import('./rule.js').Rule}
 */
export function templates(features, config) {
  return noSignal('templates');
}

/** Seed patterns. Editable, stored locally, extended by the user. */
export const TEMPLATE_PATTERNS = [
  /here'?s what i learned/i,
  /here'?s how/i,
  /here'?s the thing/i,
  /the key is/i,
  /the real problem is/i,
  /the result\?/i,
  /the lesson is/i,
  /it'?s not [^.,;\n]{1,30}, it'?s/i,
  /stop [^.,;\n]{1,30}\.?\s*start/i
];
