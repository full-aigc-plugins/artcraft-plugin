# ArtCraft V1 — Release-Scope

> **Purpose**: V1 implementation reading view; OpenSpec is normative.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](../1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](../5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../../docs/evidence/runtime-baseline.json)

## 1. V1 entrypoints

| Skill entry | Purpose | Status |
| :--- | :--- | :--- |
| artcraft-use | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-brief | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-planning | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-routing | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-assets | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-workflows | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-consistency | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-review | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-rework | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-delivery | Maintained in independent skills; plugin pins snapshots | Planned |
| artcraft-recover | Maintained in independent skills; plugin pins snapshots | Planned |


## 2. Capabilities and gates

| Capability | Behavioral boundary | Status |
| :--- | :--- | :--- |
| Mixed brief and deliverable constraints | Create a versioned brief covering aspect ratios, brand, identities, fonts, budget and native deliverables; unresolved constraints block dependent steps but not independent inspections. | Planned |
| Capability and deliverable driven routing | Route using capability snapshots and requested native formats; never silently replace a requested Jianying project with FilmCraft or FFmpeg; do not require every plugin for every task. | Planned |
| Dependency scheduling and concurrency isolation | Validate DAG cycles, missing nodes and input revisions; independent nodes may run concurrently, native projects have one writer, and downstream nodes consume only verified artifacts. | Planned |
| Asset versions and selective invalidation | Separate logical asset IDs from content hashes; record derivation edges and invalidate only transitive dependents of a logo change while retaining historical reviewed versions. | Planned |
| Cross-artifact consistency | Evaluate posters, intros and films against fixed brand and identity references; bind findings to versions and frames or regions; a shared prompt is not consistency evidence. | Planned |
| Delivery and external ecosystem adapters | Collect child projects, assets, outputs, loss reports and acceptance records; integrate existing plugins through public adapters without importing private sibling modules or fabricating completion. | Planned |


## 3. Release partition

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |


## 4. Scope change rule

Add capability rows, risks and acceptance fixtures before specifying more effects, formats, platforms or providers. Changing export formats cannot bypass required native delivery.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
