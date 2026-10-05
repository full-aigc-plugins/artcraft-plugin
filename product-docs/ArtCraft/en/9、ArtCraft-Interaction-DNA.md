# ArtCraft — Interaction-DNA

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Interaction surfaces

The first release uses host conversation, file previews and native applications, not a new web editor. Present goals, inputs, plan, progress, artifacts, acceptance and recovery actions in that order. Creative decisions should not require knowledge of internal modules.

## 2. States and feedback

| State | Required feedback | Available action |
| :--- | :--- | :--- |
| Empty project | Missing assets and goals | Select assets and define goals |
| Running | Current stage and actual task identity | Inspect progress or request cancellation |
| Failed or unknown | Known side effects and missing evidence | Reconcile, recover or revise |
| Review ready | Native project, preview, findings and losses | Accept current revision or target a change |


## 3. Visual and accessibility principles

Use clear hierarchy and neutral light surfaces in host views, with text and icons rather than color alone for state. Collapse long logs but keep recovery actions visible. Label previews with aspect ratio, revision and proxy/final status. Future custom UI would test 390×884, 768×1024 and 1280×1024 viewports; no custom responsive-page acceptance is claimed now.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
