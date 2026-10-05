# 工作流合同 / Workflow contract

`workflow.py` 自动 setup，生成包含真实身份的登记表，冻结输入计划和默认截止时间，再调用固定 ArtCraft CLI。所有领域调用都使用独立技能的公开 workflow.py，不导入其私有 Python 模块。

The entry bootstraps pinned dependencies, creates a registry of actual identities, freezes the plan and its default deadline, then invokes the fixed ArtCraft CLI. Domain calls use public independent workflow scripts.

## 计划 / Plan

顶层指定 `workflowId`、`revision`、`budget`、可选 UTC `deadline` 和 `nodes`。预算必须显式声明币种、金额上限、修订上限和外部调用上限；null 表示明确无限制。当前共享预算计数仍待实现，不能借有预算字段声称实际限额已强制生效。

Top-level fields are `workflowId`, `revision`, explicit `budget`, optional UTC `deadline` and `nodes`. Budget counters remain unfinished; declared fields alone do not enforce shared limits.

节点指定 `id`、`pluginId`、`dependsOn`、`projectKey`、`expectedRevision`（当前须 null）、`payload`。`providedAssets` 指定通过 `--asset` 提供的现有素材名称；只使用到的素材可以登记。运行时拒绝环、未知插件、坏引用和摘要变化。

Nodes declare `id`, `pluginId`, `dependsOn`, `projectKey`, `expectedRevision` (currently null) and `payload`. `providedAssets` binds explicitly supplied `--asset` files. Cycles, unknown plugins, invalid references and changed digests fail before consumption.

`payload` 为 `craft-skill-workflow/v1`：`plan` 是领域计划，`assetBindings` 为 `{name,assetId}`，`outputs` 为 `{assetId,location,mediaType}`。输出路径必须在领域交付包内。不要在 `plan` 内嵌任意 `assets` 路径；素材只能来自已核验输入。多个输出依赖时使用 `inputBindings` 选择所需产物。

The payload contains a native `plan`, `{name,assetId}` media bindings and `{assetId,location,mediaType}` outputs under `craft-skill-workflow/v1`. Output paths stay inside the delivery. Inputs are verified public artifacts. Use `inputBindings` to select specific dependency outputs.

## 项目目录 / Project directory

工作目录包含拥有者标记、文件锁、安装回执、带摘要的登记表、按修订冻结的计划、SQLite 账本、结果回执和 `outputs` 内各子任务交付。锁串行化相同项目入口，SQLite 租约保护原生写入；用户已有且未被本入口管理的非空目录会拒绝使用。

The project holds an owner marker, lock, installation receipt, hashed registry, frozen revision plans, SQLite ledger, result receipts and per-task deliveries under `outputs`. The entry serializes the same project; SQLite leases protect native writers. Unmanaged nonempty directories are rejected.

同修订重复运行核对原计划与登记表；不刷新默认截止时间。内容变化须新修订。新修订以实际输入摘要和参数确定缓存指纹；既有产物变更会阻止下游消费。

Repeating a revision verifies its frozen plan and registry without refreshing the default deadline. Changed plans require a new revision. Cache fingerprints bind input hashes and parameters; modified existing files block consumers.

## 状态与取消 / Status and cancellation

从 `installation-receipt.json` 读取 Node 和入口路径，从对应登记表与冻结计划继续运行。公开 CLI 接口：

```text
artcraft run --database ABS --registry ABS --plan ABS --owner ID --authorization REF
artcraft status --database ABS [--task ID]
artcraft cancel --database ABS --task ID
artcraft cancel --database ABS --workflow RUN_KEY
```

实际 argv 为 `[nodeExecutable, entryPoint, ...]`，不拼接 shell。取消后核查真实状态；未知运行结果不能自动重启。当前不支持崩溃监督器自动接管。

The actual argv is `[nodeExecutable, entryPoint, ...]`; no shell command is constructed. Cancellation needs confirmed process stop. Unknown outcomes cannot be replayed, and crashed-supervisor adoption is not implemented.

## 验收 / Acceptance

保留 `.fcproj`、`.ecproj`、`.pcraft`、`.vectorcraft`、收集素材、预览、导出、公共血缘和回执。单项项目与原生素材交接测试不等于创作验收或宿主发布。安装包本地验证、在线下载和插件市场安装是不同证据范围。

Retain all native projects, collected dependencies, previews, exports, lineage and receipts. Functional handoff tests do not establish creative or host-release acceptance. Local locked archives, online download and marketplace installation are separate verification scopes.

## 共享预算 / Shared budgets

相同 ownerId、workflowId 与 authorizationRef 下的节点和计划修订共享额度，政策首次登记后固定。首个计划不扣 maxRevisions；之后每个新计划修订扣一轮，同修订重跑不重复扣。原生四领域声明金额与外部服务调用上界为零；预算来自可信适配器而非 payload。未知和失败执行保留分配额度，不能靠重跑自动退款。额度不足在启动原生副作用前阻断；状态回执显示 budget，CLI status 显示 budgets。

Nodes and revisions under the same owner/workflow/authorization share one frozen policy. The initial plan uses no revision round; each subsequent new revision uses one, without replay charges. Native adapters declare zero money/external-service calls. Trusted adapters choose usage bounds, not payloads. Unknown and failed attempts retain allocations. Insufficient allowance blocks before native side effects; result budget and CLI budgets expose snapshots.

账本版本升级为 2；旧历史没有预算证据时仍能读取状态，但在旧授权范围继续执行会报 budget_history_untracked。不要删除账本或伪造授权来绕过。运行时升级改变登记表与身份摘要，同修订不可直接替换。完整质量停滞循环与付费账单核销仍未完成。

Ledger version 2 preserves historical reads but unmetered historical scopes reject execution with budget_history_untracked. Do not delete the ledger or fabricate authorization to bypass it. Runtime upgrades change registry/identity hashes and require an explicit revision; quality stagnation loops and provider invoice settlement remain pending.


## 登记源工程局部修订 / Registered native source revisions

开发版本 3 的节点允许 `payload.sourceProject = {"assetId":"old-output"}`。从前次结果取该输出完整 artifact 和 root 放入 `externalInputs`，`expectedRevision` 取 `artifact.nativeProjectRef.sha256`。源输入独立于媒体 `assetBindings`；每个输入必须有明确消费。旧工程不得通过 `--asset` 伪装成媒体，也不得自行提供源路径字段。领域 plan 不含 document；适配器注入匹配的 expectedProjectSha256。新任务保存到独立交付目录，源文件在执行前后核验，漂移停止。

Development version 3 accepts `payload.sourceProject = {"assetId":"old-output"}`. Register the prior result's full artifact and root in node `externalInputs`; set `expectedRevision` to `artifact.nativeProjectRef.sha256`. Source inputs are consumed separately from media bindings. Domain plans omit document recreation; the adapter injects the expected project digest and calls the public skill source interface. It creates a new delivery and verifies the old package before and after execution.

```json
{
  "expectedRevision": "<prior nativeProjectRef.sha256>",
  "externalInputs": [{"root": "<prior node.root>", "artifact": "<prior complete output artifact object>"}],
  "payload": {
    "schemaVersion": "craft-skill-workflow/v1",
    "sourceProject": {"assetId": "old-output"},
    "plan": {"operations": [{"command": "layer.setText", "params": {"layer": {"$ref": "title.layer"}, "text": "Updated title"}}], "frames": [0, 0.5], "exports": [{"format": "mp4"}]},
    "assetBindings": [],
    "outputs": [{"assetId": "updated-output", "location": "intro.mp4", "mediaType": "video/mp4"}]
  }
}
```

上例是字段示意，artifact 必须为真实完整对象，摘要为 64 位真实值，不可把示意字符串直接执行。同一项目的新修订仍消耗共享修订预算；不能改授权绕过。继承素材由领域技能收集，旧工程保留在 sourceRefs 血缘，不假称打包了旧工程。开发版本 4 的安装锁竞争修复后，技术回归并行通过；创作审核、故障接管及最终打包仍待完成。

The example describes fields, not an executable fixture; artifact must be the real full object and the digest the real 64-character SHA. New revisions remain under shared budgets. Inherited media are collected; the prior project stays in source lineage. Development version 4 fixes installer lock contention and passes parallel native regression; creative review, crash adoption and final packaging remain open.
