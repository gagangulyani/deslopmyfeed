import { noSignal } from './rule.js';

/**
 * 6.3 Genericity / low specificity.
 * Broad claims, few dates, numbers, named entities or concrete events.
 * Measures low-information writing, not "bad" writing.
 * @type {import('./rule.js').Rule}
 */
export function genericity(features, config) {
  return noSignal('genericity');
}
