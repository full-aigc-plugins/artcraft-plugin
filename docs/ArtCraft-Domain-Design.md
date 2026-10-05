# ArtCraft Domain technical design

> **Purpose**: Translate domain scenarios into compilable plans, fixtures and artifact checks.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

## 1. Plan boundary

The fields below are a proposed domain-plan design, not released CLI arguments. Implement final JSON schemas and consumer tests through the corresponding OpenSpec tasks; ArtCraft specifications remain authoritative for the shared task envelope.

| Field | Shape | Semantics |
| :--- | :--- | :--- |
| brief | id, revision, goal, identities, styleRefs, nativeDeliverables | Preserve goals and non-substitutable native deliverable formats |
| nodes[] | id, adapterId, operation, payloadRef, inputRefs, outputSlots | Nodes use public protocols, not private sibling implementations |
| edges[] | fromOutput, toInput, invalidationPolicy | Edges encode data dependencies; detect cycles before scheduling |
| resources | projectWriteKeys, cpuSlots, renderSlots, budgetRef | One writer per project; compute resources and financial budgets are distinct |
| delivery | requiredArtifacts, variants, reviewTargets, acceptanceRefs | Verify aggregate deliverables individually; child ACKs are insufficient |

## 2. Compilation and execution

1. Verify assets and native-project revisions and preserve a checkpoint.
2. Discover command schemas, object IDs, units and available capabilities in the actual session.
3. Validate the domain plan and reject unsupported mappings with field-level errors.
4. Compile operations with stable object mapping, plan hash and runtime identity.
5. Execute under a single-writer lease and persist confirmed steps.
6. Save, close and reopen the native project, then export and collect evidence.
7. Use input/object diffs for targeted revisions and preserve unchanged parts.

ArtCraft performs steps 2–6 through child adapters. The parent owns the task graph, input versions and public receipts; it does not directly save or mutate the four applications’ internal project objects.

## 3. Observed entrypoints and capability gates

No upstream ArtCraft CLI was installed in this work. The planned local orchestrator calls child adapters through capabilities/submit/status/reconcile/collect/verify. These are proposed protocol operations, not commands already implemented uniformly by existing plugins.

## 4. First acceptance fixture

Use owned product images and voice-over to deliver a logo, poster, five-second intro, 30-second master and aspect-ratio variants. After logo v1→v2, rerun only transitive dependents. Compare the task ID and hash of logo-independent voice-over to prove reuse.

Test assets and references must be redistributable and record fixed seeds or inputs. Set technical thresholds before execution; do not relax them after failures. Visual judgments record reference revision, evaluator and localized evidence.

## 5. Targeted revision and invalidation

Operation cache keys cover input hashes, object selection, edit parameters, runtime identity and output settings. Object IDs are not globally unique across projects and must bind a project revision. Re-inspect after user edits; if mapping is ambiguous, reject automatic overwrite and retain both versions. Local project edits and partial renderer caching are different capabilities: preserve untouched objects, but claim render-cache reuse only when upstream support is actually tested.

## 6. Delivery checklist and downstream consumption

| File or record | Check | Failure behavior |
| :--- | :--- | :--- |
| project-manifest.json | Reopen and inspect objects and dependencies | Do not claim editable delivery |
| Preview and final export | Identify format, dimensions, duration and color/alpha | Retain diagnostics and rerun affected steps |
| Asset dependencies | Hashes, licensing, fonts and relative references | List missing items and block incomplete delivery |
| Acceptance record | Bind current artifacts, plan and runtime identity | Invalidate stale records without inheriting acceptance |

## 7. Specifications and implementation tasks

[Domain OpenSpec](../openspec/changes/establish-v1-plugin/specs/domain-workflow/spec.md) · [Tasks](../openspec/changes/establish-v1-plugin/tasks.md) · [Traceability](traceability.json)

---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
