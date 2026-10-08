# 固定参考的一致性审阅 / Fixed-reference consistency review

此能力属于 `scripts/review.py record/verify` 的可选合同。技能源提供此合同；首次使用以当前技能锁定的运行时为准，固定安装验收另有版本绑定证据。原有不含 consistency 的输入及记录保持兼容。

Use the optional contract through `scripts/review.py record/verify`. The skill source provides this contract. Use its pinned runtime; installed-release acceptance requires separate version-bound evidence. Legacy inputs and records remain supported.

## 输入 / Input

在 `craft-review-input/v1` 增加 `consistency`：

```json
{
  "schema": "craft-consistency/v1",
  "references": [
    {"id": "brand-logo", "role": "brand", "asset": {"nodeId": "logo", "assetId": "logo-png", "version": "1", "sha256": "<current asset SHA256>"}},
    {"id": "product", "role": "subject", "asset": {"nodeId": "product", "assetId": "product-png", "version": "1", "sha256": "<current asset SHA256>"}}
  ],
  "assessments": [{"checkId": "poster-brand-subject", "referenceIds": ["brand-logo", "product"]}]
}
```

示例中的摘要必须替换成当前包真实资产摘要。brand 与 subject 两类参考都必须存在，品牌资产同时存在于顶层 brandReferences。每项 assessment 指向已有 creative check，完整使用同一组参考，不允许只选部分参考或复用同一资产冒充两类参考。

Replace placeholder digests with current packaged asset digests. Both brand and subject roles are required. Brand assets must also occur in top-level brandReferences. Every assessment selects an existing creative check and the entire fixed reference set; subsets and duplicate assets are refused.

## 观察文件 / Observation files

每项已执行检查的 evidence 必须指向实际观察 JSON，并使用真实文件摘要。观察文件字段严格为：schema (`craft-consistency-observation/v1`)、checkId、target、references、evaluator、status、method、observations。前五项绑定与所指检查及固定参考完全相同；status 与检查相同。method 记录实际方法；observations 为非空 `[{"description":"实际观察内容"}]`。仅含提示词、文件摘要或肯定结论的文件不满足合同。

Each executed check must provide hashed JSON evidence with exactly these fields: schema (`craft-consistency-observation/v1`), checkId, target, references, evaluator, status, method, observations. Bindings and status must match the check and fixed references. Describe the actual method and nonempty observations as `[{"description":"actual observation"}]`. A prompt, digest or unsupported assertion alone does not satisfy the contract.

PhotoCraft 目标必须标 region（归一化 x/y/width/height），EffectCraft 与 FilmCraft 必须标非负 frame。每个当前 Photo/Effect/Film 输出都要有已执行观察；缺失领域、缺失输出或 NOT_RUN 保持一致性 NOT_RUN。任一失败返回 FAIL，issues 保留资产版本、摘要和帧／区域。

PhotoCraft targets require a normalized region; EffectCraft and FilmCraft targets require a nonnegative frame. Every current output from these domains requires an executed observation. Missing domains, outputs or NOT_RUN checks keep consistency NOT_RUN. Any failure produces FAIL and preserves version, digest and frame/region in issues.

## 保存与复验 / Record and verify

沿用 [审阅记录](review.md) 的命令。记录目录包含原始输入和按摘要收集的观察文件，可整体移动。verify 重新验证清单、摘要及观察合同，复算一致性结果；不能只信任 review.json 中的 PASS。

Use the commands in [review records](review.md). The directory contains the original input and digest-addressed observations and may be moved as a unit. Verification checks inventory, digests and contracts and recomputes consistency rather than trusting a stored PASS.

一致性 PASS 只说明具名评价者的观察合同通过，不证明模型语义正确或人工接受。没有实际执行的视觉、听觉或人工审阅仍为未验证；工具不得生成虚假观察来填满覆盖率。任务账本仍为 review_ready。

Consistency PASS proves the named-evaluator observation contract only. It does not establish semantic correctness or human acceptance. Unperformed visual, audio or human review remains unverified; tools must not fabricate observations to fill coverage. The task ledger remains review_ready.

旧版本引用、缺失目标摘要或无效摘要会在公开拒绝回执中返回 `consistency.result=STALE`、`action=reevaluate` 及原始 reason；不得复用为已审阅结果。

Stale references, missing target digests and invalid digests return `consistency.result=STALE`, `action=reevaluate` and the original reason in the public refusal receipt. They must not be reused as reviewed results.
