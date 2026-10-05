# ArtCraft — 术语表与词汇表

> **文档说明**：产品级边界与跨版本决策。
>
> **版本**：1.0.0
> **最后更新**：2026-10-05
> **状态**：目标设计；尚未实现。事实依据与验收结果单独标注。

关联文档：[品牌边界](1%E3%80%81ArtCraft-%E5%91%BD%E5%90%8D%E4%B8%8E%E5%93%81%E7%89%8C%E8%AF%B4%E6%98%8E.md) · [技术方案](5%E3%80%81ArtCraft-%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88%E4%B8%8E%E8%B7%AF%E7%BA%BF.md) · [详细架构](../../docs/ArtCraft-Runtime-Architecture.zh_CN.md) · [OpenSpec](../../openspec/changes/establish-v1-plugin/proposal.md) · [证据](../../docs/evidence/runtime-baseline.json)

## 1. 统一词汇

| Term | 定义 |
| :--- | :--- |
| CreativeBrief | 创作目标和约束，不持有执行状态 |
| DomainPlan | 针对专业工具的声明式编辑计划 |
| ProjectRevision | 原生工程内容及依赖的版本身份 |
| TaskReceipt | 执行身份、状态和结果引用 |
| ArtifactManifest | 素材逻辑身份、不可变版本、来源和依赖 |
| CapabilitySnapshot | 指定运行时与模式下探测的接口能力 |
| QualityVerdict | 绑定产物的技术、创作及接受结果 |
| reconciling | 核对不明确副作用，禁止盲目重试 |
| lossReport | 交换、烘焙或字体替代造成的损失 |
| WorkflowPlan | 专业计划内部对象，字段在 V1 领域规范中定义 |
| AssetVersion | 专业计划内部对象，字段在 V1 领域规范中定义 |


## 2. 状态词与证据词

| Term | 含义与限制 |
| :--- | :--- |
| planned | 已定义目标，未执行 |
| accepted | 请求已接收，不是任务完成 |
| verified | 特定检查通过，不自动代表创作接受 |
| completed | 当前版本满足验收条件 |
| NOT_RUN | 没有检查证据，不能当作 PASS |
| preview | 供审阅的表示，不证明原生可编辑 |


## 3. 单位与版本

协议版本、插件版本、技能版本与上游 CLI 版本分别记录。时间采用显式单位与有理数基准，颜色采用明确空间、位深和 alpha 解释。版本字符串不能替代内容哈希。文档中的“支持”只能用于有对应版本、模式及用例证据的行为。



---

**文档版本**：1.0.0
**创建日期**：2026-10-05
**最后更新**：2026-10-05
**文档状态**：待评审；实现以 OpenSpec 任务和证据为准。
