/**
 * Feed lifecycle: watch for newly inserted posts, process each exactly once.
 * Never rescans the whole page.
 */

/** Runtime path gate — the content script matches all of linkedin.com so that
 * SPA navigation into /feed still has us loaded, but we only act on the feed. */
export function isFeedRoute() {
  throw new Error('not implemented');
}

/** Boot: load settings, install MutationObserver, process what is already there. */
export async function start() {
  throw new Error('not implemented');
}

/** Tear down observers and restore every post. Backs the global kill switch. */
export function stop() {
  throw new Error('not implemented');
}
