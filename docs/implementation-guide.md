# ArtCraft Implementation and delivery guide

> **Purpose**: Task order, acceptance assets, operations and release gates.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

## 1. Authority and execution boundary

[OpenSpec tasks](../openspec/changes/establish-v1-plugin/tasks.md)

All tasks are unimplemented. Start with failing tests, implement minimally, then collect real evidence. Skills and runtimes release separately; installation requires synchronized package/catalog metadata and actual host acceptance.

## 2. Order and ownership

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |

## 3. Acceptance fixtures and evidence bundle

Deliver brand graphics, a poster, motion intro and film; replace the logo and rebuild only its dependents; recover interruption without resubmitting already-created generation jobs.

Use owned or redistributable fixture assets with provenance and hashes. Evidence bundles contain inputs, plans, runtime identity, ledgers, native projects, reopen inspection, exports and loss reports. Repeat tests in a fresh workspace and retain previous outputs for comparison.

## 4. Test handoff and fault injection

| Case | Expectation |
| :--- | :--- |
| Bad archive digest | Reject installation; old runtime remains usable |
| Kill process after submission | Reconcile; no blind replay |
| Replace output under same name | Acceptance becomes stale |
| Concurrent GUI edit | Revision conflict; no overwrite |
| Late result after cancellation | Record orphan output without state promotion |

## 5. Operations and rollback

Inspect runtime identity, authorization scope, plan hash and project revision before diagnosis. Preserve workspace and ledger for unknown outcomes and query the original task or native outputs. Drain and back up before upgrades, recover the verified version combination on failure, and restore backups for incompatible schema rollback. Uninstall removes plugin-owned cache only; retain user projects and assets by default.

## 6. Release and definition of done

Every P0 requirement has reproducible evidence; tasks are checked only after verification; skills locks, runtime locks, host manifests and catalog versions agree; clean installation succeeds; both languages agree; unsupported platforms and modes are explicit. Perform OpenSpec verification or equivalent before sync/archive; complete documentation alone cannot justify archive.

---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
