# ArtCraft V1 — Architecture.zh_CN

> **文档说明**：V1 实施阅读视图；规范事实源为 OpenSpec。
>
> **版本**：1.0.0
> **最后更新**：2026-10-05
> **状态**：目标设计；尚未实现。事实依据与验收结果单独标注。

关联文档：[品牌边界](../1%E3%80%81ArtCraft-%E5%91%BD%E5%90%8D%E4%B8%8E%E5%93%81%E7%89%8C%E8%AF%B4%E6%98%8E.md) · [技术方案](../5%E3%80%81ArtCraft-%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88%E4%B8%8E%E8%B7%AF%E7%BA%BF.md) · [详细架构](../../../docs/ArtCraft-Runtime-Architecture.zh_CN.md) · [OpenSpec](../../../openspec/changes/establish-v1-plugin/proposal.md) · [证据](../../../docs/evidence/runtime-baseline.json)

## 1. 相对产品架构的 V1 增量

V1 落地本地单用户执行、独立技能分发和受验证 CLI 调用。持久化采用 SQLite 与文件产物；没有网络服务迁移。先支持经验证的 macOS arm64 headless 路径，其他平台与 bridge 模式必须分别验收。

## 2. 实施模块与顺序

| 阶段 | 交付 | 进入下一阶段条件 |
| :--- | :--- | :--- |
| D0 | 双语文档与 OpenSpec 基线 | 文档、链接、规范校验通过；实现任务仍未完成 |
| M1 | 独立技能与运行时适配 | 清洁环境安装、摘要检查、真实 MCP 调用 |
| M2 | 专业领域完整闭环 | 代表任务、工程重开、输出解码、局部修改 |
| M3 | ArtCraft 跨插件协作 | 版本传播、局部失效、断线恢复与幂等 |
| M4 | 宿主与发布验收 | 宿主实装与多平台证据；市场清单一致 |


## 3. 兼容与回退

新仓库没有历史插件状态需要迁移。上游原生工程仍需副本保护；新 schema 的未来升级遵循备份、迁移验证和拒绝不兼容回退。技能与 CLI 组合必须出现在经过测试的矩阵中。

## 4. 协议细节与证据

[运行时完整架构](../../../docs/ArtCraft-Runtime-Architecture.zh_CN.md)

[OpenSpec design](../../../openspec/changes/establish-v1-plugin/design.md)

完成品牌图形、海报、动态片头与宣传片；替换 Logo 后仅更新依赖它的产物；中断恢复不重复提交已发生的生成任务。



---

**文档版本**：1.0.0
**创建日期**：2026-10-05
**最后更新**：2026-10-05
**文档状态**：待评审；实现以 OpenSpec 任务和证据为准。
