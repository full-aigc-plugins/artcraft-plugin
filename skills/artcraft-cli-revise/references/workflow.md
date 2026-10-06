# 工作流合同 / Workflow contract

`workflow.py` 自动 setup，生成包含真实身份的登记表，冻结输入计划和默认截止时间，再调用固定 ArtCraft CLI。所有领域调用都使用独立技能的公开 workflow.py，不导入其私有 Python 模块。

The entry bootstraps pinned dependencies, creates a registry of actual identities, freezes the plan and its default deadline, then invokes the fixed ArtCraft CLI. Domain calls use public independent workflow scripts.

## 计划 / Plan

顶层指定 `workflowId`、`revision`、`budget`、可选 UTC `deadline` 和 `nodes`。预算必须显式声明币种、金额上限、修订上限和外部调用上限；null 表示明确无限制。当前运行时按相同 owner、workflow 和 authorization 共享预算计数，具体扣减、失败保留与历史账本限制见下文。付费服务账单核销仍未实现。

Top-level fields are `workflowId`, `revision`, explicit `budget`, optional UTC `deadline` and `nodes`. The runtime enforces shared admission counters under the same owner/workflow/authorization. See the budget section for allocation and historical ledger constraints; provider invoice settlement remains pending.

节点指定 `id`、`pluginId`、`dependsOn`、`projectKey`、`expectedRevision`（新建为 null；源工程修订为登记的 nativeProjectRef.sha256）、`payload`。`providedAssets` 指定通过 `--asset` 提供的现有素材名称；只使用到的素材可以登记。运行时拒绝环、未知插件、坏引用和摘要变化。

Nodes declare `id`, `pluginId`, `dependsOn`, `projectKey`, `expectedRevision` (null for creation; registered nativeProjectRef.sha256 for source revisions) and `payload`. `providedAssets` binds explicitly supplied `--asset` files. Cycles, unknown plugins, invalid references and changed digests fail before consumption.

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

实际 argv 为 `[nodeExecutable, entryPoint, ...]`，不拼接 shell。取消后核查真实状态；未知运行结果不能自动重启。调度器退出后独立 worker 可继续监督；同一冻结计划可沿用原 attempt 核对停止证据。worker 崩溃或未知提交窗口不自动重放，详见 recovery.md。

The actual argv is `[nodeExecutable, entryPoint, ...]`; no shell command is constructed. Cancellation needs confirmed process stop. A detached worker can continue after scheduler exit; the same frozen plan adopts the original attempt only with verified stop evidence. Worker death and unknown submission windows are never replayed; see recovery.md.

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

上例是字段示意，artifact 必须为真实完整对象，摘要为 64 位真实值，不可把示意字符串直接执行。同一项目的新修订仍消耗共享修订预算；不能改授权绕过。继承素材由领域技能收集，旧工程保留在 sourceRefs 血缘，不假称打包了旧工程。开发版本 4 的安装锁竞争修复后，技术回归并行通过；运行时 dev.7 已具备技术交付打包与调度器退出后的原 attempt 恢复；完整创作审核、未知提交窗口恢复和跨宿主验收仍未完成。

The example describes fields, not an executable fixture; artifact must be the real full object and the digest the real 64-character SHA. New revisions remain under shared budgets. Inherited media are collected; the prior project stays in source lineage. Development version 4 fixes installer lock contention and passes parallel native regression; runtime dev.7 supports technical packaging and original-attempt recovery after scheduler exit; full creative review, unknown submission windows and cross-host acceptance remain open.


## 蒙版局部返工 / Local mask revision

首次安装固定 EffectCraft 技能 dev.6，原生 CLI 保持 0.2.0。片头创建时可用公开 `mask.new`，以 `as` 保存蒙版 UID；路径使用图层坐标，闭合 Add 遮罩与实际 RGBA 输出一起检查。

Source suite dev.13 pins EffectCraft skills dev.6 and native CLI 0.2.0. Save the `mask.new` return UID with an alias; closed Add paths use layer coordinates and need actual RGBA evidence.

修订时，登记上一版片头产物作为 `externalInputs`，`sourceProject.assetId` 指向它，`expectedRevision` 使用其 `nativeProjectRef.sha256`。去掉新建 `document`；`mask.setVertex` 的 `layer`、`mask` 从原生回执绑定读取，另存工程。只改已有蒙版而不消费新 Logo 时，不保留未使用的 Logo 输入依赖。引用 Logo 的原工程素材仍随子交付保存。

Register the prior intro as an external source artifact, bind its native hash and revise vertices using saved layer/mask IDs. Remove creation settings and unused new-media dependencies; packaged native dependencies remain in the source delivery.

下游成片以新片头替换原镜头；继续保留已有音轨、字幕与无关图层。保留原工程摘要与透明度关键帧，比较 RGBA 蒙版边界；图形与海报任务应复用，只有片头和成片改变。重复同一修订时，任务和预算身份应复用。独立技能运行默认安装依赖，不需要读取其他技能目录。

Replace only the consuming video clip with the new intro. Verify original hashes, opacity keys, audio and captions; compare RGBA boundaries and reuse Logo/poster tasks. Repeating the same revision must reuse task and budget identity. The isolated skill installs its own pinned dependencies.

## 按需安装执行器

workflow.py 在依赖下载前读取节点 pluginId 或 runtimeIdentity.pluginId，拒绝冲突或未知执行器。只下载本次任务图所需领域的固定技能源和 CLI；安装回执 skills 与 bundleHashes 仅列实际安装内容。只含 Logo 节点时不安装剪辑、合成与图片领域；追加海报节点时增量安装 PhotoCraft，已验证 Logo 任务可复用。原生交付格式由领域节点决定，不能用 FilmCraft 静默替代未登记的剪映执行器。

bootstrap.py 显式调用保持完整安装的兼容默认；可重复 --plugin vectorcraft --plugin photocraft 指定领域，或用 --runtime-only 仅安装编排运行时。四领域混合示例仍自动安装全部四个领域。手动 --node-only 仅证明 Node，不能代表 ArtCraft 已安装。

CLI 发现、状态查询、打包和移动验包仅安装编排运行时，不额外下载领域工具。直接 CLI run 的 registry 必须登记已有领域运行身份；领域首次安装与登记由 workflow.py 按计划完成。

## PhotoCraft 尺寸变体的混合交付

当前依赖锁为 PhotoCraft skills dev.8。源工程节点仍通过 `sourceProject.assetId` 和 `expectedRevision` 绑定实际已登记的原生工程。节点 `payload.plan` 可声明 PhotoCraft `variant`：目标 width/height、最终画布坐标的 safeArea `[x,y,width,height]`、源 background/product/text 三个图层角色。角色可用实际 ID 或源 manifest 中的绑定引用，例如 `{"$ref":"title.layer"}`。背景 ID 必须来自源 native.json，不从名称猜测或照抄。

尺寸操作使用受支持的 `image.canvasSize` 或 `image.imageSize`；保存重开后由独立 PhotoCraft 工作流核验目标尺寸、原图层身份、可见性和文字/产品边界。海报源 Logo 图层可以作为功能样例的前景角色，但真实产品项目应绑定真实产品图层。角色无法核验或越出安全区时，该节点失败且不发布子交付。

成功子交付包含 manifest 绑定摘要的 `layout-variant.json`。ArtCraft 打包保留完整记录，包迁移后继续按可信打包回执摘要验证；记录被修改会拒绝验收。几何安全区不能代替品牌、排版审美或人工接受。

## 尺寸变体复用门禁

ArtCraft runtime dev.41 在新交付登记、历史就绪预检、跨修订缓存复用和下游交接时核验声明 variant 的 PhotoCraft 产物；没有 Brief 也必须通过。要求 layout-variant.json、native.json、plan.json、operations.json 均由子 manifest 绑定摘要，尺寸、安全区、可编辑角色和实际尺寸回执一致。保持源角色别名稳定，或使用已核验的源图层数字 ID，避免用新对象覆盖角色绑定。

旧技能曾忽略 variant、缺少记录的结果不得复用；记录陈旧或矛盾会阻止本次运行，不自动重放原生写入。恢复完全相同的已核验记录后可以复用原任务；需要实际重新设计时创建显式新修订和新交付，不修改旧缓存的验收字段来伪造通过。

## 成片静态音轨增益返工 / Static film audio gain revisions

固定 FilmCraft 技能源 dev.8 支持 `mixer.setStrip`，参数严格为 `{"strip":"A1","volumeDb":-6.0}`。修订 film 节点时提供前次原生产物的 externalInputs、expectedRevision 与 payload.sourceProject；保留 intro 的 assetBindings 并标记 retained，providedAssets 清空，配音继续从原交付包内保留。其余三个节点保持原计划与依赖，不能为了音量变化重建 Logo、海报或片头。

复验必须解码新成片的音频幅度，核对原工程、镜头、字幕与预览保全，并检查其他节点 taskId 复用。同一修订重复执行应复用任务和预算。此入口仅支持明确 A 音轨的静态有限分贝增益，不包含录音、总线、路由和自动化。

Pinned FilmCraft source dev.8 accepts `mixer.setStrip` with exactly `{"strip":"A1","volumeDb":-6.0}`. Bind the previous film artifact through externalInputs, expectedRevision and payload.sourceProject; retain the intro asset binding and clear providedAssets so packaged audio remains in the source delivery. Keep the other three plans unchanged. Verify decoded audio amplitude, preserved project/clip/caption/preview content, reused upstream task IDs and repeat budget/task identity. Recording, buses, routing and automation are outside this entry.

## 必需源音轨 / Required source audio

要求音频的 Film 节点缺少真实时间线源音轨时返回 `export_audio_missing`；自动静音 AAC 不代表成功。失败保留工程、预览、成片、audio-check.json、export-probe.json 与 failure.json，不发布成功输出。依赖该节点的任务阻断；同一冻结计划重复执行保留原尝试与预算。明确 audioRequired=false 或真实静音源仍按领域契约处理。

A required-audio Film node without a timeline audio source reports `export_audio_missing`. Generated silent AAC is insufficient. Retain native project, preview, film and diagnostic JSON without success outputs; block consumers and preserve attempt/budget identity on replay. Explicit optional audio and intentional silent sources follow the domain contract.

## PCM WAV 配音登记 / PCM WAV narration

首次使用已有标准 PCM WAV 配音时，workflow.py 按 RIFF/WAVE 内容登记 audio/wav、采样率、声道、位深、十进制样本帧数和 timeBase=1/sampleRate；运行时核对实际文件、块边界、帧对齐及声明。假 .wav、截断与非 PCM 格式在安装或领域执行前明确拒绝，不转码替换。其他未知输入维持二进制类型，不推断为已识别音频。独立技能不依赖兄弟目录；原配音及技能文件保留。

Standard PCM WAV narration is identified from content, carries exact sample-based facts, and is verified again by the runtime. Invalid WAV files and unsupported compression are rejected explicitly; no replacement voice is generated. Native FilmCraft export/decode and creative/audio review remain separate checks.

## PNG 固定合同 / PNG pinned contract

运行时 dev.56 与技能源 dev.40 按内容登记静态 PNG 的 width、height、bitDepth、alpha，检查 CRC、块结构、有限解压扫描数据及过滤字节。Alpha 仅表示通道或 tRNS，不证明实际像素透明。支持标准位深／颜色类型及 Adam7，限制输入 64 MiB、扫描数据 128 MiB，明确拒绝 APNG。错误 PNG 在安装前拒绝，声明属性不匹配由候选运行时在领域执行前拒绝。

原生 Photo 导入按扩展名路由。识别为 PNG 的非 .png 输入在项目身份与修订绑定通过后原样复制到 provided-assets/<sha>.png；两份摘要须一致，不改写原输入。副本进入登记和可迁移交付包。

Runtime dev.56 and skill source dev.40 recognize static PNG by content and records width, height, bitDepth and alpha representation. It checks CRC, chunk structure, bounded decompressed scan data and filter bytes, including standard depths/colors and Adam7. Limits: 64 MiB input, 128 MiB scan data; APNG is explicitly unsupported. Alpha representation does not prove visually transparent pixels. A non-.png input recognized as PNG is copied byte-for-byte to project-owned provided-assets/<sha>.png only after owner/revision binding; both hashes must match. The original is preserved and the copy enters portable packaging.

Fixed installed-host verification remains open; JPEG/video identification, ICC/visual fidelity and creative acceptance are not implied.
