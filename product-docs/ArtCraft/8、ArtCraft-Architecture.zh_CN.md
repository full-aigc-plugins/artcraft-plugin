# ArtCraft — Architecture.zh_CN

> **文档说明**：产品级边界与跨版本决策。
>
> **版本**：1.0.0
> **最后更新**：2026-10-05
> **状态**：目标设计；尚未实现。事实依据与验收结果单独标注。

关联文档：[品牌边界](1%E3%80%81ArtCraft-%E5%91%BD%E5%90%8D%E4%B8%8E%E5%93%81%E7%89%8C%E8%AF%B4%E6%98%8E.md) · [技术方案](5%E3%80%81ArtCraft-%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88%E4%B8%8E%E8%B7%AF%E7%BA%BF.md) · [详细架构](../../docs/ArtCraft-Runtime-Architecture.zh_CN.md) · [OpenSpec](../../openspec/changes/establish-v1-plugin/proposal.md) · [证据](../../docs/evidence/runtime-baseline.json)

## 1. 长期架构约束

架构采用 Skills → Harness → Runtime Adapter → Native CLI 的依赖方向。创作知识、执行状态、原生工程和跨插件项目分别有唯一所有者。上游命令返回、模型建议和用户素材都不直接推进验收状态。

## 2. 分层与边界

| 组件 | 权威数据 | 禁止承担 |
| :--- | :--- | :--- |
| Skills | 操作知识、触发条件、领域方法 | 任务状态和秘密 |
| Domain Harness | 领域计划、工程修订、子任务账本 | 其他插件内部状态 |
| Runtime Adapter | 命令映射与能力快照 | 自行改变创作目标 |
| Native CLI | 原生对象、编辑与渲染 | 跨插件项目真相 |
| ArtCraft | Brief、DAG、资产版本与聚合交付 | 伪造子任务成功 |


## 3. 部署与数据

V1 为本地单用户工作区；插件包只读，运行时按版本存储，项目状态和素材放在用户可管理目录。JSON 公共回执隔离运行语言与宿主差异。没有 SaaS、消息中间件或分布式事务依赖。

## 4. 详细设计的所有权

[运行时完整架构](../../docs/ArtCraft-Runtime-Architecture.zh_CN.md)

详细文档定义进程、状态机、接口、失败恢复、升级、资源预算和运维；V1 架构仅记录本版实施范围与增量。修改外部行为必须先修改 OpenSpec，不通过叙述性文档暗中改变契约。



---

**文档版本**：1.0.0
**创建日期**：2026-10-05
**最后更新**：2026-10-05
**文档状态**：待评审；实现以 OpenSpec 任务和证据为准。
