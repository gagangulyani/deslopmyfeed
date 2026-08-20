# Implementation Plan — V1

Ordered by dependency, not by how interesting the work is. Each phase has a
success criterion that can be checked by running something, not by looking at
the code and feeling good about it.

The single most important sequencing decision: **the labelled corpus comes
before the detectors.** Every weight and threshold in the spec (§6, §8) is a
guess until it is measured against real text. Writing seven detectors first and
tuning them afterwards means tuning against intuition.

---

## Phase 0 — Scaffold ✅

Directory layout, `manifest.json`, module contracts, docs, repo. Done.

**Done when:** `chrome://extensions` loads the unpacked folder with no errors,
and the popup opens. (The popup will render nothing until Phase 5.)

---

## Phase 1 — Corpus and harness

Build the measuring instrument first.

1. `tests/fixtures/human.json` — 60+ anonymized real posts across professions,
   industries, styles, lengths. This is the false-positive dataset and the one
   that matters most.
2. `tests/fixtures/ai.json` — 40+ posts from several models and prompt styles.
3. `tests/fixtures/assisted.json` — 20+ human posts that were polished,
   expanded or rewritten.
4. `tests/fixtures/adversarial.json` — 15+ posts written to dodge the rules in
   §6 (no em dashes, concrete-sounding fake numbers, no CTA).
5. `tests/metrics.test.js` — runs `analyze()` over every fixture and reports
   false-positive rate, false-negative rate and precision. It **fails the build**
   when FPR on `human.json` exceeds the budget.

**Budget:** FPR ≤ 5% at hide threshold, ≤ 15% at warn threshold. Recall is
explicitly the thing we sacrifice (spec §29.5).

**Success criterion:** `npm test` prints a metrics table and fails on a
deliberately broken threshold.

**Risk:** this phase is slow and unglamorous, and the corpus quality caps the
quality of everything after it. Anonymize by paraphrasing names/companies, not
by deleting them — deleting named entities destroys exactly the signal the
genericity detector reads.

---

## Phase 2 — Features and scoring engine

`src/detector/features.js`, `src/detector/scoring.js`.

- Single-pass tokenization producing `PostFeatures` (one pass, seven readers).
- `analyze()` composes enabled rules, applies weights, enforces the guard rails
  centrally: <50 words never filtered, 50–100 words conservative, hiding needs
  ≥2 categories with ≥1 from `STRONG_RULES`.
- Sensitivity maps to threshold offsets (low `+2`, medium `0`, high `-2`).

Guard rails live here, not in rules. A rule that has to remember not to fire on
short posts is a rule that will forget.

**Success criterion:** unit tests where every rule is stubbed to a fixed score,
asserting the composition and each guard rail independently.

---

## Phase 3 — Detectors, strongest first

One module per rule, each with its own test file, each landing green against the
Phase 1 metrics before the next one starts. Order matters: adding a weak rule to
an untuned strong rule makes both untestable.

1. **`stacking.js`** — the load-bearing detector. Segment the post into hook /
   body / enumerated block / close, score co-presence. Should carry most of the
   true positives on its own.
2. **`templates.js`** — regex bank. Score *distinct* templates, sub-linearly:
   1 match ≈ 0.5, 2 ≈ 1.5, 3+ ≈ 2. A single "Here's how" must be near-noise.
3. **`formatting.js`** — ratios not counts: one-line-paragraph ratio, colon-led
   line ratio, em-dashes per 100 words, sentence-length variance. Normalizing by
   length keeps long posts from auto-triggering.
4. **`genericity.js`** — hardest, and the biggest false-positive risk. Density
   of numbers, dates, capitalized mid-sentence tokens (proxy for named
   entities), concrete nouns vs. abstract-suffix words (`-ity`, `-ness`,
   `-ment`, `-tion`). No NLP dependency (spec §20).
5. **`vocabulary.js`** — score group *co-occurrence*, never single hits. Merge
   user terms from storage.
6. **`engagement.js`** and **`hashtags.js`** — weak by construction, capped so
   they can never combine to a hide verdict.

**Success criterion per detector:** metrics do not regress, and the detector has
a test asserting it does *not* fire on at least three specific human fixtures
that look superficially similar to its target pattern.

**Risk on genericity:** a well-written short human post about an abstract topic
looks identical to slop by every measure here. If FPR cannot be brought under
budget, ship it default-off rather than weakening the whole score.

---

## Phase 4 — Content script

`bootstrap.js` → `observer.js` → `post-detector.js` → `post-filter.js`.

- `post-detector.js` is the only file that knows LinkedIn markup. Isolate it so
  DOM churn is a one-file fix.
- Selector strategy: prefer stable-ish semantic anchors (`div[data-id^="urn:li:activity"]`,
  `.feed-shared-update-v2`) with fallbacks, and **return `null` when uncertain**.
  No heuristic guessing at markup (spec §22).
- MutationObserver on the feed container, debounced, incremental. Track
  processed nodes in a `WeakSet` so LinkedIn's virtualized list recycling does
  not cause reprocessing or leaks.
- Runtime feed-route gate, re-checked on SPA navigation.

**Known issue to solve here:** LinkedIn truncates long posts behind "…see more".
The DOM text is then a fragment, which both starves the detectors and trips the
<50-word guard. Read the full text from the collapsed node's underlying content
if it is present in the DOM; if only truncated text is available, treat the post
as unanalyzable and leave it alone. Do **not** click "see more" — that is a
LinkedIn control, and clicking it is exactly the automation the project forbids
(spec §19).

**Success criterion:** on a real feed, every post is processed exactly once
(counter in console), and `stop()` restores the page to an untouched state.

---

## Phase 5 — UI

`ui.js`, `content.css`, popup, themes.

- Warn: quiet inline badge. Hide: collapsed card with **Show post** and
  **Always show similar**.
- Explanation panel lists triggered rules grouped strong/weak with actual
  evidence strings from the post.
- Popup renders from `DEFAULT_SETTINGS` so UI and schema cannot drift.
- Themes: light base, dark override, `system` leaves `data-theme` unset.
- All styles namespaced `.dsmf-`.

**Success criterion:** collapse → restore leaves the post visually identical;
all three themes render correctly in popup and injected UI; no LinkedIn styles
are affected with the extension enabled.

---

## Phase 6 — Settings and exceptions

`storage/settings.js`.

- Load/save/observe on `chrome.storage.local`, defaults merged for
  forward-compatible schema changes.
- Live propagation: changing mode in the popup updates open feed tabs without a
  reload.
- Exceptions checked **before** analysis — user preference beats detector.

**Success criterion:** toggle every rule and mode from the popup and observe the
feed react without reload; settings survive browser restart.

---

## Phase 7 — Performance

`tests/bench.js`: run `analyze()` over the whole corpus, report p50/p95/max.

**Budget:** p95 < 50 ms per post. If features.js is doing its job this should be
comfortable; if a detector blows it, that detector is doing something it should
not.

**Success criterion:** bench committed, budget met, no jank scrolling a real
feed.

---

## Phase 8 — Release readiness

Walk the spec §31 checklist explicitly:

- [ ] Filtering works on the LinkedIn feed
- [ ] All analysis local
- [ ] Zero network requests — verified in DevTools, not assumed
- [ ] Every detector independently toggleable
- [ ] Warn / hide modes
- [ ] Sensitivity adjustable
- [ ] Hidden posts always restorable
- [ ] FPR measured against the real human dataset
- [ ] Dark / light / system correct
- [ ] No LinkedIn account actions automated
- [ ] Global kill switch
- [ ] `PRIVACY.md` matches actual behavior
- [ ] Platform risk documented
- [ ] No anti-automation bypass

---

## Open questions

1. **Corpus sourcing.** 60 anonymized human posts is real work. Paraphrasing
   changes the writing style being measured; copying verbatim raises its own
   questions. Leaning toward paraphrase-preserving-structure, and documenting it.
2. **Calibration honesty.** The weights in the spec are reasonable guesses. If
   measurement contradicts them, measurement wins — the spec's numbers are a
   starting point, not a contract.
3. **Genericity may not survive.** See Phase 3 risk. It carries weight 2 and it
   is the detector most likely to hide something the user wanted.
4. **DOM fragility.** LinkedIn class names are partly generated. The plan is to
   fail closed and isolate the damage, not to chase selectors.

## Explicitly out of V1

Machine learning, cloud processing, accounts, sync, analytics, mobile, LinkedIn
API integration, any automatic LinkedIn action, comment filtering, message
filtering.
