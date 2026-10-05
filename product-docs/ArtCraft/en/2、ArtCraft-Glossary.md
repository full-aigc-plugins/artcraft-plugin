# ArtCraft — Glossary

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Shared vocabulary

| Term | Definition |
| :--- | :--- |
| CreativeBrief | Creative goals and constraints; no execution state |
| DomainPlan | Declarative editing plan for a domain tool |
| ProjectRevision | Revision identity of a native project and its dependencies |
| TaskReceipt | Execution identity, state and result references |
| ArtifactManifest | Logical asset identity, immutable version, provenance and dependencies |
| CapabilitySnapshot | Discovered interface capabilities for a runtime and execution mode |
| QualityVerdict | Artifact-bound technical, creative and acceptance results |
| reconciling | Reconcile uncertain side effects before retry |
| lossReport | Losses from interchange, baking or font substitution |
| WorkflowPlan | Domain-plan object; fields are specified by V1 domain requirements |
| AssetVersion | Domain-plan object; fields are specified by V1 domain requirements |


## 2. State and evidence vocabulary

| Term | Meaning and limit |
| :--- | :--- |
| planned | Defined intent; not executed |
| accepted | Request acknowledged, not completed |
| verified | Specific checks passed, not automatic creative acceptance |
| completed | Current revision satisfies acceptance conditions |
| NOT_RUN | No check evidence; never equivalent to PASS |
| preview | Review representation, not proof of native editability |


## 3. Units and versions

Record protocol, plugin, skill and upstream CLI versions separately. Time uses explicit units and rational bases; color records space, depth and alpha interpretation. Version strings do not replace content hashes. “Supported” requires evidence for the relevant version, mode and case.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
