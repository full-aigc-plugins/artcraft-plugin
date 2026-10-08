# ArtCraft DAG Node Identity Architecture

Task6.9 is now complete;see [native scheduling acceptance](ArtCraft-Native-Scheduling-Acceptance-Architecture.md).Open6.9 statements below describe the historical core-fix release checkpoint.

This document covers the AC-DM-003 scheduler identity fix for implementation, skill maintenance and acceptance. Plugin OpenSpec owns behavior; standalone skills pin the runtime, and the plugin vendors immutable skill snapshots. [Implementation evidence](evidence/dag-identity-implementation-20261008.json).

Legal IDs such as `__proto__`, `constructor` and `toString` previously collided with inherited object properties or the prototype setter, incorrectly blocking a valid dependency chain. The scheduler now uses `Object.fromEntries` over the validated topological order to create an own writable data property for every node. Scheduling, persistence and consumer verification retain their existing paths. Legal IDs, public JSON, artifact protocols and node fingerprints are unchanged.

```mermaid
flowchart TD
    Plan[Public task graph] --> Graph[Duplicate / missing / cycle checks]
    Graph --> Own[Own state property for each node]
    Own --> Schedule[Dependencies and project single writer]
    Schedule --> Verify[Verify child artifact digests and versions]
    Verify --> Save[SQLite records and JSON receipt]
    Save --> Resume[Restart and recheck cached results]
    Resume -->|valid| Reuse[Reuse task IDs and budget]
    Verify -->|failed or unknown| Block[Block consumers / reconcile]
    Resume -->|damaged evidence| Block
```

| Contract | Implementation and verification |
| :--- | :--- |
| Opaque IDs | Three special names form a real local child-process dependency chain; all results are own properties and survive JSON roundtrip. |
| Verified handoff | Consumers receive verified parent artifacts; inherited properties cannot fabricate readiness. |
| Recovery and budget | A new scheduler uses the same durable ledger and reuses task IDs, budget and outputs without launching new processes. |
| Other scheduling | Cycle/missing-node checks, parallelism, same-project serialization, damaged cache, cancellation and crash recovery regressions continue to pass. |
| Release boundary | Published runtime126 bytes match the downloaded archive; fixed source98/plugin126 installation requires separate evidence. |

The regression failed before the fix because `blocked` differed from `review_ready`, then passed. Runtime regression: 299 tests, 278 passed and 21 conditional skips. CLI regression was rerun after updating the version field. Domain versions, the 2646-command catalog and native formats retain their existing contracts. Upgrades use separate version directories and preserve old runtimes; rolling back to a defective old version does not preserve this fix.

This proves the scheduler fix and affected regressions. The complete four-domain native concurrent/single-writer matrix, generic Skills CLI, GUI, human creative approval and full V1 require separate acceptance; task6.9 remains open. A passing fixed-install scenario does not automatically close that matrix.

Fixed plugin126/source98/runtime126 acceptance passes:64-skill discovery with zero errors,10 independent Art cold installs,64 CLI probes,four-domain opaque-ID native creation/reuse/moved package,and installed-tree preservation.[Fixed evidence](evidence/craft-art126-dag-identity-fixed-first-use-20261008.json). Earlier candidate-pending wording describes the release checkpoint;6.9 remains open.

The whole-workspace source audit refused because the four domain worktrees differ from the pinned tags;Art skill files match source98.Fixed release archives,host skills and cold copies were verified independently against the lock.This does not prove all five current source worktrees match pinned refs.Other repositories were not modified;the refusal and32 open tasks remain explicit.
