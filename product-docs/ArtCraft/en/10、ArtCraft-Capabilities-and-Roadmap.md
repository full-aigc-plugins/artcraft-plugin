# ArtCraft — Capabilities-and-Roadmap

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Capability entrypoints

| Entry | Purpose | Version |
| :--- | :--- | :--- |
| artcraft-use | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-brief | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-planning | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-routing | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-assets | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-workflows | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-consistency | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-review | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-rework | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-delivery | Domain knowledge or workflow entry; currently planned | V1 |
| artcraft-recover | Domain knowledge or workflow entry; currently planned | V1 |


## 2. Functional scope

| Capability | Behavioral boundary | Status |
| :--- | :--- | :--- |
| Mixed brief and deliverable constraints | Create a versioned brief covering aspect ratios, brand, identities, fonts, budget and native deliverables; unresolved constraints block dependent steps but not independent inspections. | Planned |
| Capability and deliverable driven routing | Route using capability snapshots and requested native formats; never silently replace a requested Jianying project with FilmCraft or FFmpeg; do not require every plugin for every task. | Planned |
| Dependency scheduling and concurrency isolation | Validate DAG cycles, missing nodes and input revisions; independent nodes may run concurrently, native projects have one writer, and downstream nodes consume only verified artifacts. | Planned |
| Asset versions and selective invalidation | Separate logical asset IDs from content hashes; record derivation edges and invalidate only transitive dependents of a logo change while retaining historical reviewed versions. | Planned |
| Cross-artifact consistency | Evaluate posters, intros and films against fixed brand and identity references; bind findings to versions and frames or regions; a shared prompt is not consistency evidence. | Planned |
| Delivery and external ecosystem adapters | Collect child projects, assets, outputs, loss reports and acceptance records; integrate existing plugins through public adapters without importing private sibling modules or fabricating completion. | Planned |


## 3. Navigation and routing

Route single-domain requests directly and mixed scenarios to ArtCraft. Inspect before execution and return bounded availability when capabilities are missing. Choose executors by requested native format, not silent substitution. Lifecycle operations are shared; concrete commands are adapter-specific.

## 4. Release cadence

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |




---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
