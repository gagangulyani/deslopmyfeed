# Fixtures

Four labelled corpora, per spec §24. Each file is JSON:

```json
[{ "id": "human-001", "label": "human", "text": "..." }]
```

| File | Label | Notes |
| --- | --- | --- |
| `human.json` | `human` | Varied professions, styles, industries, lengths. |
| `ai.json` | `ai` | Multiple models and prompting styles. |
| `assisted.json` | `assisted` | Human text that was polished, expanded or rewritten. |
| `adversarial.json` | `adversarial` | Written to evade the known rules. |

**Do not commit real posts with identifying author information.** Paraphrase or
anonymize before adding. Fixtures are the only place post text lives on disk,
and they are test data, not user data.

`assisted` is deliberately not scored as a pass/fail class — it exists to check
that the detector degrades gracefully rather than treating light editing as slop.
