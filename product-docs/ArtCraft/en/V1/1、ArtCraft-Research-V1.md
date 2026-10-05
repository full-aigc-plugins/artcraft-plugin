# ArtCraft V1 — Research

> **Purpose**: V1 implementation reading view; OpenSpec is normative.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](../1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](../5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../../docs/evidence/runtime-baseline.json)

## 1. Research scope and method

Inputs are the five-plugin responsibility brief, existing repository patterns, public upstream documentation and basic CLI probes. This is engineering feasibility research, not user interviews or broad compatibility testing.

## 2. Representative scenario

Deliver brand graphics, a poster, motion intro and film; replace the logo and rebuild only its dependents; recover interruption without resubmitting already-created generation jobs.

## 3. Observations and gaps

Runtime entrypoints were observed; domain skills, plan compilation, durable tasks and delivery validation still need implementation. Borrow runtime isolation from Jianying, media receipts from Video Factory and revision management from Content Factory without treating their tests as this plugin’s acceptance.

## 4. Questions for experiments

| Risk | Detection | Mitigation and owner |
| :--- | :--- | :--- |
| R1 | Upstream command or format changes | Runtime owner: pin releases, diff schemas and rerun fixtures; keep old version until verified |
| R2 | Text, alpha or color loss on handoff | Domain owner: retain native sources, emit loss reports and inspect pixels and objects |
| R3 | Duplicate submission after disconnect | Harness owner: persist intent and idempotency keys, reconcile before retry |
| R4 | Design documentation mistaken for implementation | Release owner: planned feature status; no marketplace entry without working skills and runtime |
| R5 | ArtCraft branding and restricted-source boundaries | Maintainer: independent implementation; do not copy ArtCraft/Services source; clear branding before distribution |




---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
