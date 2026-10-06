# ArtCraft Vector Assets Architecture

## Authority and candidate boundary

AC-DM-007 in the existing OpenSpec change owns logical VectorCraft asset handoff. The current TypeScript adapter is a source candidate. Published plugin dev.59/source dev.41/runtime dev.58 and their fixed bundle lock are unchanged; existing installations still use the former behavior until a new immutable release is validated.

## Input and execution contract

Models supply assetBindings with names and artifact IDs, never machine paths or inline plan.assets. publicSkillFactory verifies all registered input bytes, derives --asset arguments and pins the interpreter, native executable and skill files through launcher identity. sourceProject is another registered artifact and must match expectedRevision and its manifest.

```mermaid
sequenceDiagram
    participant A as ArtCraft ledger
    participant V as Vector public skill
    participant P as Photo public skill
    A->>V: Registered image, validated digest
    V->>V: Native place, collect, reopen, export
    V-->>A: Native project, PNG, dependencies
    A->>P: Verified Vector PNG
    P-->>A: Layered native poster, PNG and PSD
    A->>V: Old native project and replacement JPEG
    V-->>A: New revision, same raster IDs
    A->>P: Changed upstream rendition
    Note over A,P: Independent icon task is reused
```

## Verification and revisions

The former unconditional Vector asset rejection is removed only because the independent workflow now implements the public asset contract. New and inherited collected files are rehashed. For asset.replace, the new input must occur in one explicit replacement mapping and its collected digest must appear under the old alias. Missing, unbound, duplicated or mismatched inputs do not become accepted lineage.

Result artifacts retain sourceRefs, nativeProjectRef, lossReportRef, manifest evidence and collected dependency references. Source revision is preserved rather than overwritten. A changed asset invalidates consumers through actual input hashes; unrelated nodes can reuse only verified prior outputs. Replay of the same plan must not allocate extra native tasks.

## Source-candidate acceptance

`test/public_skill_adapter.test.ts` first failed on skill_assets_unsupported, then verifies public argv and unbound/path rejection. `test/vector_asset_workflow.test.ts` runs actual current Vector/Photo scripts: supplied PNG, collected native dependency, layered poster, JPEG source replacement, changed output pixels, reuse of independent icon, preservation of all old package hashes and same-plan replay. This is not a substitute for a newly installed fixed ArtCraft skill.

Evidence: [candidate verification](evidence/vector-assets-candidate-20261006.json). New distribution locks, immutable source/runtime/plugin releases, installed-host first use, complete four-domain creative acceptance and model/GUI gates remain open. Jianying adaptation remains outside ArtCraft.
