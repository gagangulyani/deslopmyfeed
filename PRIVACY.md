# Privacy

DeSlopMyFeed is local-only by design. The privacy model is meant to be
technically enforceable rather than a promise in a document.

## What the extension collects

Nothing is collected. There is no server to collect it to.

## What leaves your browser

Nothing. The extension makes no network requests of its own — no `fetch`, no
WebSocket, no remote scripts, no remote configuration, no analytics SDK, no
external fonts, no tracking pixels.

You can verify this: open DevTools → Network while browsing your feed, or read
the source. The codebase contains no network calls.

## What is stored locally

`chrome.storage.local` holds only your configuration:

- Whether filtering is enabled, and the mode (off / warn / hide)
- Sensitivity and score thresholds
- Which detection rules are enabled, and their weights
- Custom vocabulary terms you add
- Local exceptions (authors and keywords you always want to see)
- Theme preference

This never leaves your machine and is never synced.

## What is *not* stored

Post content. Text is read from the page, analyzed in memory, and discarded.
There is no post database, no history, no cache on disk.

The one exception is `tests/fixtures/`, which contains anonymized sample text
committed to the repository as test data by developers. It is not produced by
the extension and never contains anything from your browsing session.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Persist your settings between sessions. |
| Content script on `https://www.linkedin.com/*` | Read visible feed post text and collapse posts locally. |

The extension requests no `<all_urls>`, no `history`, no `cookies`, no
`webRequest`, and no `tabs`.

The content script matches all of `linkedin.com` rather than only `/feed/*`
because LinkedIn is a single-page app: client-side navigation into the feed
would not trigger injection on a narrower match. The script gates itself at
runtime and does nothing outside feed routes.

## Third parties

None. No OpenAI, no Anthropic, no third-party detection service, no Google
Analytics, PostHog, Mixpanel, or telemetry of any kind.

## Kill switch

Filtering can be disabled entirely from the popup, which restores every
collapsed post and detaches all observers.
