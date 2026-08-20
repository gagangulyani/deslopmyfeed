# DeSlopMyFeed

> Take your feed back.

A privacy-first Chrome extension that locally filters low-quality, repetitive,
generic, formulaic, and promotional content out of your LinkedIn feed.

Analysis happens entirely in your browser. No post content is sent anywhere, no
AI API is used, no account is required.

**Status: alpha, exercised against a live LinkedIn feed.** The DOM extraction
path and classifier were evaluated on live feed cards, but this is not a
controlled end-to-end release test or a measured field false-positive rate. See
[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for verified behavior and remaining
validation gaps.

---

## What it does

DeSlopMyFeed evaluates visible feed posts with deterministic local heuristics
and, depending on your chosen mode, either marks a post:

> AI-style signals detected

or collapses it locally:

> **Post hidden** — **Hidden because:** template structure and synthetic formatting · **Show post** · **Why hidden?**

The post is not deleted from LinkedIn. Only your local presentation changes.

The toolbar icon is gray outside LinkedIn or while filtering is off. On an
active LinkedIn tab it uses the colored brand icon and displays the number of
currently flagged posts, whether they are warned or hidden; the badge disappears at zero.

Every hidden card states the matched categories. **Why hidden?** expands the
specific structural and phrasing evidence used for that decision. You can also
choose **Useful — show more like this** or **Hide more like this**; those explicit
choices adjust matching pattern weights locally, never storing post text, author
identity, or post URLs.

## What it does not claim

DeSlopMyFeed is **not an AI authorship detector**. It cannot tell you whether AI
wrote a post, which model was used, or how much assistance was involved. Humans
write things that look like AI, and AI writes things that look human.

> It detects patterns, not provenance.

There is deliberately no "93.72% AI generated" number anywhere in the UI. The
system has no evidence that would justify one.

## Detection signals

Seven categories, each independently toggleable, each weighted. Individual clues
are weak on purpose; combinations carry the signal.

| Signal | Weight | Idea |
| --- | ---: | --- |
| Template stacking | 3 | Hook + story + numbered lessons + generic close, together |
| Rhetorical templates | 2 | "Here's what I learned", "It's not X, it's Y" |
| Genericity | 2 | Broad claims, few dates, numbers, names or concrete events |
| Synthetic formatting | 2 | One-line paragraph clusters, colon-led lines, dash separators |
| Vocabulary clusters | 1 | Co-occurring abstract/inspirational/discourse terms |
| Engagement formula | 1 | "Thoughts?", "Comment below", 👇 |
| Hashtag behavior | 1 | Hashtag-stuffed endings |

### Score bands

Each rule reports a strength between 0 and 1; the score is that strength times
the rule's weight, summed. Thresholds were calibrated against the test corpus
rather than guessed — the highest score any human fixture reaches is 0.8.

| Score | Reading | Default action |
| ---: | --- | --- |
| under 2.5 | Insufficient signal | Show |
| 2.5+ | Corroborated suspicious pattern | Warn, or hide in Hide mode |

### Measured behavior

Against `tests/fixtures/` (179 posts), at default settings:

| Corpus | Flagged | Hidden |
| --- | ---: | ---: |
| human (91 judged) | 0.0% | 0.0% |
| ai (50) | 74.0% | 74.0% |
| assisted (22) | 0.0% | 0.0% |
| adversarial (16) | 0.0% | 0.0% |

Run `npm test` to reproduce; the build fails if the human false-positive rate
goes above budget. **These fixtures were written for the project, not collected
from LinkedIn** — the number is a regression guard, not a field measurement. Live calibration is still ongoing and does not establish a measured false-positive rate.
Adversarial recall is 0% by construction: those posts were written to evade
every rule, and the project's stated preference is to miss slop rather than hide
a real post.

### Guard rails

- Posts under 10 words are never judged.
- 10–49 words can be flagged but never hidden — little text is little evidence. A dash separator is weak evidence and needs another signal to warn.
- 50–100 words are scored conservatively (0.7x).
- Posts detected as likely Romanized Hindi/Hinglish are left unscored; other languages are not yet reliably identified.
- Sponsored posts are never judged — ad copy is engineered to trip the rules.
- Hide mode offers two policies: **Score threshold** hides a 50+ word post when its score meets the user-selected threshold; **Any enabled signal** hides a 50+ word post whenever one enabled rule matches. Concrete first-person posts with multiple real-world anchors remain visible in both modes.
- Posts with concrete first-person context and multiple real-world anchors remain visible, even when other signals warn.
- Every hidden post offers **Show post** and **Always show similar**, and a post
  you have asked to see stays visible for the rest of the session.

The project prefers *missing some slop* over *hiding legitimate content*.

## When it looks like nothing is happening

Most posts are not slop, so a working extension and a broken one look the same
from a feed. Turn on **Diagnostics -> Show what the extension sees** in the
popup: every post gets a tag naming the stage it reached.

| Tag | Meaning |
| --- | --- |
| `SHOW` (green) | Analyzed, scored below the warn threshold. Working as intended. |
| `WARN` / `HIDE` (red) | Flagged. |
| `SPONSORED` (slate) | Promoted content. Never judged. |
| `NO TEXT NODE` (slate) | The text selector did not match — LinkedIn's markup has moved. |
| `EXEMPT` (slate) | Skipped by a configured exception. |

A status panel appears in the bottom-right corner whether or not any post
matched, because a selector that matches nothing leaves nothing to tag:

- **No panel at all** — the content script is not running. The console prints
  one line per page load; `[DeSlopMyFeed] failed to start:` names the reason.
- **Panel reading `0 selector match(es)`** — running, but LinkedIn's markup has
  moved out from under `src/content/post-detector.js`.
- **Panel counting posts** — running and reading the feed. The per-stage
  breakdown says what it decided.

`tools/probe-selectors.js` answers the same question without the extension:
paste it into the DevTools console on your feed and it reports which selectors
match and what LinkedIn currently wraps post text in.

## Privacy

See [PRIVACY.md](PRIVACY.md). Short version: no backend, no AI APIs, no
analytics, no post database, and the extension makes no network requests of its
own — enforced by architecture, not by promise.

## Install (development)

```bash
git clone git@github.com:gagangulyani/deslopmyfeed.git
cd deslopmyfeed
npm install
npm test
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the repository root. There is no build step; the extension
ships the source as-is.

`npm run bench` reports per-post analysis cost (currently p95 0.17ms against a
50ms budget).

## Platform risk

DeSlopMyFeed is an experimental project. LinkedIn's terms prohibit certain
third-party extensions that scrape data, modify LinkedIn's appearance, or
automate activity. This project therefore makes **no claim of being
LinkedIn-approved or terms-compliant**.

It is designed to minimize risk:

- No LinkedIn account automation — no likes, comments, follows, reports
- No requests to LinkedIn APIs
- No external backend, no transmission of analyzed post content
- No attempt to bypass LinkedIn security or anti-automation systems
- No attempt to conceal the extension from LinkedIn

Use is at your own risk.

## License

MIT — see [LICENSE](LICENSE).
