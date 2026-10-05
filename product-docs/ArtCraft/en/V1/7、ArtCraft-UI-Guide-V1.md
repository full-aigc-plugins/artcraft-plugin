# ArtCraft V1 — UI-Guide

> **Purpose**: V1 implementation reading view; OpenSpec is normative.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](../1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](../5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../../docs/evidence/runtime-baseline.json)

## 1. Global interaction rules

Follow product interaction DNA. V1 uses existing host preview components and native editors, not custom pages. Every action identifies its project, revision and artifact.

## 2. Essential feedback

| Situation | User feedback | Next action |
| :--- | :--- | :--- |
| Runtime missing | Verified runtime is missing; no editing started | Open setup with source and version |
| Outcome unknown | Reconciling the previous execution without resubmission | Query or reconcile manually |
| Stale evidence | Artifact changed; fresh verification required | Verify the current revision |
| Targeted revision | Show changed scope and invalidated dependents | Execute within existing authority |


## 3. Preview and accessibility

Video previews identify timecode, audio and caption versions; images identify aspect ratio and color space; vector previews identify artboards. List native-project links separately from flat exports. State is not conveyed by color alone; errors include a copyable code and plain explanation.

## 4. UI acceptance boundary

This phase generates no UI screenshots and claims no native UI acceptance. Host installation and bridge behavior have separate cases; add module PRD/Stitch/UI triplets only if custom UI enters scope.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
