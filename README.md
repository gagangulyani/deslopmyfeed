# DeSlopMyFeed

> Take your feed back.

A privacy-first Chrome extension that locally filters low-quality, repetitive,
generic and AI-style content out of your LinkedIn feed.

Analysis happens entirely in your browser. No post content is sent anywhere, no
AI API is used, no account is required.

**Status: pre-alpha.** The scaffold and interfaces exist; the detectors are not
implemented yet. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

---

## What it does

DeSlopMyFeed evaluates visible feed posts with deterministic local heuristics
and, depending on your chosen mode, either marks a post:

> AI-style signals detected

or collapses it locally:

> **Post hidden** — strong AI-style pattern detected · **Show post**

The post is not deleted from LinkedIn. Only your local presentation changes.

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
| Synthetic formatting | 2 | One-line paragraph clusters, colon-led lines, em-dash density |
| Vocabulary clusters | 1–2 | Co-occurring abstract/inspirational/discourse terms |
| Engagement formula | 1 | "Thoughts?", "Comment below", 👇 |
| Hashtag behavior | 1 | Hashtag-stuffed endings |

### Score bands

| Score | Reading | Default action |
| ---: | --- | --- |
| 0–2 | Insufficient signal | Show |
| 3–4 | Mild signal | Show |
| 5–6 | Suspicious pattern | Warn |
| 7+ | Strong pattern | Hide |

### Guard rails

- Posts under 50 words are never filtered.
- 50–100 words are scored conservatively.
- Hiding requires at least two independent signal categories, one structural.
- Every hidden post offers **Show post** and **Always show similar**.

The project prefers *missing some slop* over *hiding legitimate content*.

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
