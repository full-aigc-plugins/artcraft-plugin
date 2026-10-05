# ArtCraft — Technical-Plan

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Technical decisions and alternatives

| ADR | Decision and rationale | Alternative and reversal condition |
| :--- | :--- | :--- |
| ADR-001 | Independent skills repositories with immutable snapshots inside plugin packages | Reject sibling symlinks; add host dependency resolution only after it is verified |
| ADR-002 | Reuse official Rust CLIs through controlled MCP/argv | Do not rewrite editors; surface missing APIs before adding adapters |
| ADR-003 | Target TypeScript and Node.js 24 LTS for orchestration, matching ecosystem experience | Pin patch versions and dependencies during implementation; design is not compatibility proof |
| ADR-004 | SQLite ledger and content-addressed files for a local single-user workspace | Revisit service storage only when multi-machine collaboration is required |
| ADR-005 | ArtCraft OpenSpec owns shared task and artifact protocols | Domain repositories own mappings and consumer tests, not competing field definitions |
| ADR-006 | Separate technical gates from creative review; preserve valid existing authorization | Do not require approval per call; obtain new authority only when scope changes |

## 2. Independent skill supply chain

`artcraft-skills` is the planned independent knowledge repository and is not yet published. It owns SKILL.md, references and portable helper scripts where required. The plugin resolves a fixed tag to a commit, verifies the whole skill tree and packages it in `skills/`. Release checks run in a clean export and verify links, licenses, inventory and locks. The current skills lock has no sources; no version or digest is fabricated.

| Stage | Input | Failure rule |
| :--- | :--- | :--- |
| resolve | repository + immutable tag | Stop on unresolved tags or disallowed provenance |
| verify | commit + tree digests | Reject any content drift |
| package | skills inventory | Reject escaping links and duplicate names |
| audit | clean install fixture | Standalone skill installs must resolve public dependencies |

## 3. Domain plan compilation strategy

| Capability | Behavioral boundary | Status |
| :--- | :--- | :--- |
| Mixed brief and deliverable constraints | Create a versioned brief covering aspect ratios, brand, identities, fonts, budget and native deliverables; unresolved constraints block dependent steps but not independent inspections. | Planned |
| Capability and deliverable driven routing | Route using capability snapshots and requested native formats; never silently replace a requested Jianying project with FilmCraft or FFmpeg; do not require every plugin for every task. | Planned |
| Dependency scheduling and concurrency isolation | Validate DAG cycles, missing nodes and input revisions; independent nodes may run concurrently, native projects have one writer, and downstream nodes consume only verified artifacts. | Planned |
| Asset versions and selective invalidation | Separate logical asset IDs from content hashes; record derivation edges and invalidate only transitive dependents of a logo change while retaining historical reviewed versions. | Planned |
| Cross-artifact consistency | Evaluate posters, intros and films against fixed brand and identity references; bind findings to versions and frames or regions; a shared prompt is not consistency evidence. | Planned |
| Delivery and external ecosystem adapters | Collect child projects, assets, outputs, loss reports and acceptance records; integrate existing plugins through public adapters without importing private sibling modules or fabricating completion. | Planned |

The planner emits a declarative plan. The compiler validates command availability, fields, units and bounds, then emits typed operations. Inspect source objects to obtain real IDs first. Compilation records planHash and capabilitySnapshotHash and returns unsupported_mapping for unsupported operations; only verified mappings reach submission.

## 4. Runtime installation and management

Runtime management separates discover, verify, install, probe, activate, upgrade and rollback. Reuse compatible existing installs after verification. Pin download URLs and digests, reject archive traversal and escaping symlinks, and verify before execution. Versioned installs do not overwrite active binaries and preserve prior receipts. An untested platform is unverified; a universal ZIP does not prove every architecture works.

## 5. Submission, recovery and artifact protocol

Use persisted intent, idempotency keys and single-writer leases. Even synchronous CLIs without external task IDs require attempt IDs, process identity, checkpoints and expected outputs. After process failure, inspect projects and files rather than blindly rerunning. Reconciliation handles the gap between file creation and ledger registration. Validate native projects and exports separately; list non-redistributable dependencies and fonts with verifiable acquisition instructions.

## 6. Test plan and acceptance assets

| Layer | Required coverage | Evidence |
| :--- | :--- | :--- |
| contract | Missing/unknown fields, idempotency and revision conflicts | schema + fixture results |
| adapter | Real command discovery, mode differences and error mapping | runtime identity + transcript |
| recovery | Disconnect after submit, late results and unconfirmed cancellation | ledger before/after + duplicate count |
| native | Deliver brand graphics, a poster, motion intro and film; replace the logo and rebuild only its dependents; recover interruption without resubmitting already-created generation jobs. | project reopen + output inspection |
| host | Clean host install, upgrade and user-data preserving uninstall | host/version/platform + logs |

## 7. Implementation route

| Phase | Deliverable | Exit evidence |
| :--- | :--- | :--- |
| D0 | Bilingual documentation and OpenSpec baseline | Document, link and spec validation; implementation tasks remain open |
| M1 | Independent skills and runtime adapter | Clean installation, checksums and real MCP invocation |
| M2 | Complete domain workflow | Representative task, native reopen, decode and targeted revision |
| M3 | ArtCraft cross-plugin collaboration | Version propagation, selective invalidation and interruption recovery |
| M4 | Host and release acceptance | Actual host installation, platform evidence and synchronized catalogs |

Use dependency order without invented dates or effort estimates. Each OpenSpec task carries a requirement ID, owner role, output and validation. Start with failing behavior tests, implement minimally, and leave tasks unchecked until evidence exists.

## 8. Operations, upgrade and release

Plugin, skills, upstream CLI and protocol versions evolve independently. Release matrices pin their combinations; host manifests and marketplace metadata must match verified commits and locks. The documentation baseline ships no installable plugin package; M4 gates the first installable release. Roll back to a previously verified plugin/skills/CLI combination; restore backups when state migrations are incompatible.

---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.

## Shared budget implementation progress

The ledger now provides parent/child shared allowances, revision counters and atomic admission. See docs/ArtCraft-Budget-Architecture.md for implementation and migration contracts. Actual provider settlement and complete quality loops remain pending.

dev.6 implements fixed independent worker supervision, adoption of original stop evidence and interrupted verification rechecks. Scheduler recovery retains the frozen plan, token, epoch, attempt and budget; workers read parent cancellation directly. Worker death and uncertain submission windows retain ownership without replay. See Runtime Architecture 10.4 and crash-recovery.json for implementation and acceptance boundaries; creative review and full host acceptance remain open.
