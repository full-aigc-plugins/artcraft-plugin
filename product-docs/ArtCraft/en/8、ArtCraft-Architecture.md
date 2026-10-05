# ArtCraft — Architecture

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Cross-version architecture constraints

Dependencies flow from Skills through Harness and Runtime Adapter to Native CLI. Creative knowledge, execution state, native projects and cross-plugin projects have distinct owners. Upstream responses, model suggestions and user assets cannot directly advance acceptance state.

## 2. Layers and boundaries

| Component | Authoritative data | Must not own |
| :--- | :--- | :--- |
| Skills | Procedural knowledge, triggers and domain methods | Task state or secrets |
| Domain Harness | Domain plans, project revisions and child task ledger | Other plugins’ internal state |
| Runtime Adapter | Command mappings and capability snapshots | Changing creative goals |
| Native CLI | Native objects, edits and rendering | Cross-plugin project authority |
| ArtCraft | Brief, DAG, asset versions and aggregate delivery | Fabricating child success |


## 3. Deployment and data

V1 uses a local single-user workspace: read-only plugin packages, versioned runtimes and user-managed project state and assets. JSON receipts isolate language and host differences. SaaS, message brokers and distributed transactions are not dependencies.

## 4. Detailed design ownership

[Complete runtime architecture](../../../docs/ArtCraft-Runtime-Architecture.md)

The detailed architecture owns processes, states, interfaces, recovery, upgrade, resource budgets and operations. V1 architecture records only release scope and deltas. Change OpenSpec before external behavior; narrative documentation cannot silently alter contracts.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
