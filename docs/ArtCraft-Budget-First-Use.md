# Budget protocol first use

Source85 pins runtime 0.1.0-dev.113-runtime.1. The installer accepts the restricted -dev.N-runtime.N suffix while preserving origin, archive and per-file SHA256 verification. Arbitrary suffixes and paths remain rejected. Version validation failed first; all eight setup tests then passed.

A single artcraft-cli-execute skill copied into project .agents/skills automatically installed public dependencies without offline overrides. Native Vector creation and two revision-cap refusals passed in 36.701 seconds. Public code is budget_exhausted; legacy message remains budget_exceeded: revisions. All eight ledger tables, original attempt and native files were preserved. Source regression: 155 total, 117 passed, 38 conditional skips. This does not establish fixed plugin113 host installation, all budget schedules, or full V1.

```mermaid
flowchart LR
  S[Single skill] --> I[Verified public install]
  I --> N[Native Vector create]
  N --> R[Two revision refusals]
  R --> P[Ledger and native files preserved]
```

[Evidence](evidence/craft-budget-source-first-use-20261008.json).
