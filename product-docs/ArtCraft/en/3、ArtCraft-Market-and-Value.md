# ArtCraft — Market-and-Value

> **Purpose**: Product boundaries and cross-version decisions.
>
> **Version**: 1.0.0
> **Updated**: 2026-10-05
> **Status**: Target design, not implemented. Observations and acceptance evidence are identified separately.

Related documents: [Brand boundary](1%E3%80%81ArtCraft-Naming-and-Brand.md) · [Technical plan](5%E3%80%81ArtCraft-Technical-Plan.md) · [Detailed architecture](../../../docs/ArtCraft-Runtime-Architecture.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [Evidence](../../../docs/evidence/runtime-baseline.json)

## 1. Demand source and evidence

Confirmed demand comes from the five-plugin brief and its representative acceptance cases, not a market survey. Target users are local creators and content-production engineering teams. No willingness-to-pay interviews have been conducted; TAM, SAM, SOM, prices and market shares are not fabricated.

## 2. Problems and value hypotheses

| Problem | Value hypothesis | Validation |
| :--- | :--- | :--- |
| Only flattened deliverables | Native projects reduce revision effort | Perform a second revision and reopen during acceptance |
| Full rebuild for every change | Dependencies avoid unrelated rebuilds | Compare executed nodes before and after changes |
| Success responses with unusable files | Independent verification reduces bad delivery | Inject corrupt output and inspect gates |


## 3. Adjacent products and integration strategy

Native applications own editing engines; Image Factory and generation platforms supply assets; Video Factory provides bounded deterministic video processing; Jianying is an alternative native editing target; Content Factory owns editorial and channel delivery. ArtCraft owns orchestration for mixed workflows. This is responsibility mapping, not an unmeasured performance ranking.

## 4. Commercial and adoption decisions

This phase publishes documentation and specifications, not paid tiers. Model and cloud costs follow actual providers and task budgets. Maintainers resolve commercial distribution and naming before M4; these conditions do not weaken local functional acceptance.



---

**Document version**: 1.0.0
**Created**: 2026-10-05
**Updated**: 2026-10-05
**Document status**: Ready for review; implementation status is governed by OpenSpec tasks and evidence.
