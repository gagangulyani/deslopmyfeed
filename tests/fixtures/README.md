# Fixtures

Four labelled corpora, per spec §24. Each file is JSON:

```json
[{ "id": "human-001", "label": "human", "text": "..." }]
```

| File | Label | Count | Notes |
| --- | --- | --- | --- |
| `human.json` | `human` | 90 | Varied professions, styles, industries, lengths. |
| `ai.json` | `ai` | 42 | Several formulaic registers and structures. |
| `assisted.json` | `assisted` | 22 | Concrete human content, smoothed structure. |
| `adversarial.json` | `adversarial` | 16 | Written to evade the rules in spec §6. |

**Do not commit real posts with identifying author information.** Paraphrase or
anonymize before adding. Fixtures are the only place post text lives on disk,
and they are test data, not user data. `tests/corpus.test.js` enforces the shape
and rejects emails, links and phone numbers.

## What this corpus is, and what it is not

These posts were **written for the project, not collected from LinkedIn**. That
keeps the privacy rule above trivially satisfied, and it is the corpus's biggest
weakness: the false-positive rate measured against it is a rate against one
author's idea of how humans write, not against how humans write.

Treat the number as a regression guard, not as a field measurement. It will
catch a detector that starts firing on plain prose. It will not tell you what
happens on a real feed. Replacing these with anonymized real posts is the single
highest-value improvement available to the project.

## The 50-word floor

Posts under `MIN_WORDS_TO_ANALYZE` (50) are never filtered, so they pass for
free. 54 of the 90 human posts clear that floor and they are the ones the
false-positive budget is actually measured on — hence the deliberate weight of
long, discursive human posts, including ones that use numbered lists, em dashes,
hashtags and closing questions. Those are the false-positive traps.

Every `ai`, `assisted` and `adversarial` fixture is above the floor by
construction; one below it could never be filtered and would only pollute the
recall figure.

`assisted` is deliberately not scored as a pass/fail class — it exists to check
that the detector degrades gracefully rather than treating light editing as slop.

`adversarial` is expected to produce misses. Recall is the thing this project
trades away (spec §29.5); the file exists to keep that cost visible.
