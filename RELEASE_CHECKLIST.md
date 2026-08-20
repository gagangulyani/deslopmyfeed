# Release readiness — spec §31

Each item names the evidence. "Tested" means a test fails if the behavior
regresses; "verified" means it was checked once by hand and could drift.

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Filtering works on the LinkedIn feed | **Not verified** | Tested against synthetic LinkedIn-shaped markup in `tests/content/`. Never run against a real feed — see below. |
| 2 | All analysis local | Tested | `tests/policy.test.js` — no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` or `importScripts` anywhere in `src/`. |
| 3 | Zero network requests | Tested + needs DevTools | Same test, plus no remote URLs in any CSS or HTML. A DevTools network check on a real feed is still owed. |
| 4 | Every detector independently toggleable | Tested | `tests/detector/scoring.test.js` skips a disabled rule; `tests/popup.test.js` renders one toggle per registered rule. |
| 5 | Warn and hide modes | Tested | `tests/detector/scoring.test.js` (warn never hides, off analyzes nothing); `tests/content/live-settings.test.js` switches modes on a live page. |
| 6 | Sensitivity adjustable | Tested | `tests/detector/scoring.test.js` — low raises the bar, high lowers it. |
| 7 | Hidden posts always restorable | Tested | `tests/content/ui.test.js` asserts `innerHTML` is byte-identical after Show post. |
| 8 | False-positive rate measured | Measured, weak corpus | `tests/metrics.test.js` prints the table and fails the build on the budget. 0.0% on 54 analyzable human fixtures — but they are authored, not collected. See the caveat below. |
| 9 | Dark, light and system correct | Tested | `tests/popup.test.js` for the attribute contract; `tests/content/live-settings.test.js` applies the theme to the page. Rendering itself was not eyeballed in a browser. |
| 10 | No LinkedIn account actions automated | Tested | `tests/policy.test.js` — nothing in `src/` calls `.click()`, `.submit()` or dispatches a MouseEvent. |
| 11 | Global kill switch | Tested | `tests/detector/scoring.test.js` (`enabled: false` wins over every other setting) and `tests/content/live-settings.test.js` (clears the page live). |
| 12 | `PRIVACY.md` matches actual behavior | Tested | Each claim in it maps to an assertion in `tests/policy.test.js`. |
| 13 | Platform risk documented | Verified | `README.md`, carried from spec §1. |
| 14 | No anti-automation bypass | Verified | No obfuscation, no stealth, no attempt to hide the extension. The content script matches `linkedin.com` openly and does nothing when it cannot read the markup. |

## The two things that are not done

**It has never run on LinkedIn.** Every DOM test uses markup written to look
like LinkedIn's, based on the selectors in `src/content/post-detector.js`. If
those selectors are wrong or stale, every test still passes and the extension
does nothing on the real site. That is the single largest untested assumption in
the project, and it is deliberate: the detector fails closed, so being wrong
costs a no-op rather than a broken feed. Loading the unpacked extension and
scrolling a real feed is the next step, and it needs a human.

**The false-positive rate is measured against writing I produced.** 0.0% on the
human corpus is a regression guard, not a field result. The corpus does not
contain a human who writes in the influencer register, and real people do. The
honest expectation is that the real rate is higher than zero; the thresholds were
set at roughly three times the highest human score seen so that there is room for
that, rather than fitted to the edge of the corpus.

Replacing the authored fixtures with anonymized real posts is the highest-value
change available to this project.
