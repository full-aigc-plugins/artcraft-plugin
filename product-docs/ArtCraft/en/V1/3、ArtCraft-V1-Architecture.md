# ArtCraft V1 — Architecture

> **Purpose**: V1 implementation reading view; OpenSpec is normative.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](../1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](../5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../../docs/evidence/runtime-baseline.json)

## 1. V1 delta from product architecture

V1 implements local single-user execution, independent skill distribution and verified CLI calls, using SQLite and file artifacts without a service migration. Start with verified macOS arm64 headless operation; other platforms and bridge modes require separate acceptance.

## 2. Modules and implementation order

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |


## 3. Compatibility and rollback

The new repository has no legacy plugin state to migrate. Protect upstream native projects with copies. Future schema upgrades require backup, migration verification and rejection of incompatible rollback. Skills/CLI combinations must appear in a tested matrix.

## 4. Protocol detail and evidence

[Complete runtime architecture](../../../../docs/ArtCraft-Runtime-Architecture.md)

[OpenSpec design](../../../../openspec/changes/establish-v1-plugin/design.md)

Deliver brand graphics, a poster, motion intro and film; replace the logo and rebuild only its dependents; recover interruption without resubmitting already-created generation jobs.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
