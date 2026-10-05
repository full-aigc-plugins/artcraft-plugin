# ArtCraft — Product-Roadmap

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Product and release boundaries

Current 0.1.0-dev.0 identifies repository metadata and a documentation baseline; it contains no installable skills or production executor. V1 names target scope, not a released product. CLI 0.2.0 is an upstream version, not the plugin version.

## 2. Milestones

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |


## 3. Priority and dependencies

P0: independent skills, trusted runtime, domain workflow, native delivery, recovery and core safety. P1: additional platforms, recipes and generation providers. P2: performance optimization and convenience UI. ArtCraft integration depends on domain endpoints reaching M2, while public protocol design can proceed earlier.

## 4. Release and stop conditions

Do not enter installable marketplaces before critical acceptance passes. Failed rollback, corrupt native formats and duplicate paid submissions block release. Documentation updates do not close implementation tasks; do not archive the implementation change early.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
