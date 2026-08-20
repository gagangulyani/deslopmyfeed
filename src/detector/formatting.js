import { noSignal } from './rule.js';

/**
 * 6.4 Synthetic formatting.
 * Clusters only: one-line paragraph ratio, numbered advice blocks,
 * colon-led statements, em-dash density, repeated sentence shapes.
 * @type {import('./rule.js').Rule}
 */
export function formatting(features, config) {
  return noSignal('formatting');
}
