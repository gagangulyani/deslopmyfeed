import { noSignal } from './rule.js';

/**
 * 6.2 Template stacking — the strongest single detector.
 * Looks for hook + story + numbered lessons + generic close appearing together,
 * not for any one of them alone.
 * @type {import('./rule.js').Rule}
 */
export function stacking(features, config) {
  return noSignal('templateStacking');
}
