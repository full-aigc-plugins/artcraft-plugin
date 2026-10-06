# ArtCraft FilmCraft Receipt Integration Architecture

ArtCraft fixed source dev.33 updates only the FilmCraft skill bundle from fixed dev.5 to dev.6 (85866c064c7d91abd8da63b0570d78bee3202bf5). Orchestration runtime remains dev.41; FilmCraft native CLI remains 0.2.0-craft.1. The other three fixed domain bundles are unchanged. Fixed plugin dev.43 receives skills only through the vendor tool.

## First use and reuse

```mermaid
sequenceDiagram
    participant S as Single ArtCraft skill
    participant I as Locked dependency installer
    participant F as FilmCraft bootstrap
    participant W as Workflow ledger
    S->>I: Install selected fixed bundles
    I->>F: Verify native installation and receipt
    alt Receipt identity mismatches
        F-->>S: Installation error
        Note over S,W: Keep project and native installation unchanged
    else Receipt valid
        F-->>I: Verified executable
        S->>W: Run or reuse bound workflow
        W-->>S: Native artifacts and original task identities
    end
```

The previous domain bundle ignored invalid receipt identity while reusing an intact executable. A real default-online test reproduced an incorrect review_ready result after the platform field changed. The new fixed bundle checks the receipt before ArtCraft dispatch. Rejected setup preserves every project file and native installation file. Restoring the original valid receipt permits same-revision reuse; no automatic repair or native replay is performed.

## Acceptance boundary

The integration test copies only one skill, downloads default public fixed dependencies into a fresh runtime with a system-only PATH, creates four native projects, repeats them, rejects the changed receipt, restores it and checks original task IDs. It also exercises four source-project Brief revisions, Photo variant cache checks and moved-package verification. Audio in this fixture is a sine tone; the test proves technical handoff, not spoken narration or creative acceptance. Source evidence and fixed-plugin host evidence must be recorded separately. Existing complete creative/model/GUI/other-platform release gates remain open.

## Fixed installed acceptance

Codex 0.153.4 installs five fixed public releases and discovers all 58 enabled skills with zero loading errors. The installed ArtCraft dev.43/source dev.33 passes three cold mixed cases (110.253 s). All 58 skills copied individually execute version and command discovery (53.999 s), with one fresh runtime per domain. A separate Chinese spoken-voice fixture passes two cases (51.620 s): 72 frames, caption-only Film rework, preserved upper-image Logo pixels and audio, unchanged other task IDs and verified four-child packaging. Every installed skill digest remains unchanged. The QA driver is fingerprinted separately from immutable source tag dev.33. [Bounded evidence](evidence/codex-release43-film-receipt-first-use-20261006.json). Full creative, model, GUI and production gates remain open.
