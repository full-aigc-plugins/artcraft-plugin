# ArtCraft 领域技术设计

> **文档说明**：将专业场景落实为可编译计划、fixture 与产物检查。
>
> **版本**：1.0.0
> **最后更新**：2026-10-05
> **状态**：目标设计；尚未实现。事实依据与验收结果单独标注。

## 1. 计划边界

以下字段是拟建领域计划的设计草案，属于实现指南，不是已发布 CLI 参数。最终 JSON Schema 需在对应 OpenSpec 任务中实现并通过消费测试；公共任务信封保持 ArtCraft 规范权威。

| Field | Shape | 语义 |
| :--- | :--- | :--- |
| brief | id, revision, goal, identities, styleRefs, nativeDeliverables | 保存创作目标和不可替代的原生格式要求 |
| nodes[] | id, adapterId, operation, payloadRef, inputRefs, outputSlots | 节点通过公开协议调用，不嵌入兄弟仓库私有实现 |
| edges[] | fromOutput, toInput, invalidationPolicy | 边表达数据依赖；调度先检测循环 |
| resources | projectWriteKeys, cpuSlots, renderSlots, budgetRef | 工程单写；计算资源与财务预算分别管理 |
| delivery | requiredArtifacts, variants, reviewTargets, acceptanceRefs | 聚合交付要求可逐项验证，禁止只靠子任务 ACK |

## 2. 编译与执行步骤

1. 验证源素材与原生工程版本，保留修改前检查点。
2. 在实际会话中发现命令 schema、对象 ID、单位与可用能力。
3. 校验领域计划，拒绝未支持映射并给出字段级错误。
4. 生成带稳定对象映射的操作序列，绑定计划摘要与运行身份。
5. 在单写租约内执行；持久化每个已确认步骤。
6. 保存工程，关闭并重开检查，再导出并收集证据。
7. 局部修订使用输入与对象差异，保留不变部分。

ArtCraft 的第 2–6 步通过子适配器完成；父级只维护任务图、输入版本和公开回执，不直接保存或修改四款应用的内部工程对象。

## 3. 已发现入口与能力门禁

ArtCraft 没有在本次安装一个同名上游 CLI。拟建本地编排运行时通过 capabilities/submit/status/reconcile/collect/verify 调用子适配器。它们是公开协议操作，不是现有插件已经统一实现的命令。

## 4. 首个验收 fixture

输入一套自有产品图与配音，输出 Logo、海报、5 秒片头、30 秒主片及横竖屏变体。Logo v1→v2 后只重做传递依赖节点；对无 Logo 依赖的配音比较 taskId 与哈希，确认复用。

测试数据和参考画面须可再分发，记录固定种子或固定输入。技术阈值必须在运行前写入 fixture；不能观察失败后偷偷放宽。视觉判断记录参考版本、评估者和定位证据。

## 5. 局部修订与失效

操作缓存键覆盖输入哈希、对象选择、编辑参数、运行时身份与输出规格。对象 ID 不是跨工程全局唯一标识，必须与工程修订绑定。用户修改后重新 inspect，无法匹配时拒绝自动覆盖并保留两个版本。工程层局部修改与渲染器局部缓存是不同能力：前者保持未修改对象，后者只有上游实际支持并通过测试时才声明。

## 6. 交付清单与下游消费

| 文件或记录 | 检查 | 失败行为 |
| :--- | :--- | :--- |
| project-manifest.json | 重开并检查对象与依赖 | 不得标为可编辑交付 |
| 预览与正式导出 | 识别格式、尺寸、时长及颜色/alpha | 保留诊断，重新执行受影响步骤 |
| 素材依赖 | 摘要、许可、字体与相对引用 | 明确缺失项并阻止不完整交付 |
| 验收记录 | 绑定当前产物、计划与运行身份 | 旧记录失效，不自动继承接受 |

## 7. 关联规范与执行任务

[Domain OpenSpec](../openspec/changes/establish-v1-plugin/specs/domain-workflow/spec.md) · [Tasks](../openspec/changes/establish-v1-plugin/tasks.md) · [Traceability](traceability.json)

---

**文档版本**：1.0.0
**创建日期**：2026-10-05
**最后更新**：2026-10-05
**文档状态**：待评审；实现以 OpenSpec 任务和证据为准。
