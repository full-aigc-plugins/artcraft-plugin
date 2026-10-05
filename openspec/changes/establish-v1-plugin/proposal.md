## Why

ArtCraft 需要将“跨插件创作编排、素材依赖与局部返工”落为可独立安装、可追溯、可恢复的 Agent 插件。已安装的上游 CLI 仅证明运行时可用，不能替代技能、Harness 与原生交付验收。

## What Changes

- 建立独立 `artcraft-skills` 的发布与插件锁定引用规范；本变更不把技能源码改成插件私有内容。
- 定义运行时安装、能力探测、任务执行、工程与素材交付、质量修订和宿主发布门禁。
- 固化代表性验收：完成品牌图形、海报、动态片头与宣传片；替换 Logo 后仅更新依赖它的产物；中断恢复不重复提交已发生的生成任务。
- 交付中英文产品文档、架构、技术方案与 README；实现任务保持未完成。

## Capabilities

### New Capabilities

- `skills-distribution`: 独立技能与不可变分发。
- `runtime-distribution`: 运行时安装、能力与回退。
- `task-execution`: 任务状态、幂等、授权与恢复。
- `artifact-delivery`: 原生工程、素材和产物证据。
- `quality-review`: 技术门禁与受限创作修订。
- `release-compatibility`: 宿主、权限与发布验收。
- `domain-workflow`: 跨插件创作编排、素材依赖与局部返工。
- `craft-task-protocol`: 跨插件任务协议唯一事实源。
- `craft-artifact-protocol`: 跨插件素材协议唯一事实源。

### Modified Capabilities

无。新仓库没有已实现行为或既有主规格。

## Impact

目标模块为未来的 `src/harness/`、`src/adapters/`、`runtime/`、`schemas/` 与独立技能仓库。四款上游应用保留各自工程格式；现有插件通过公开接口适配。ArtCraft Services 仅作为架构参考，不复制其受限许可代码。

## Non-goals

本次不实现插件执行代码、不创建技能包发布、不分发 GUI 应用、不接入真实付费生成、不发布市场条目。协议内容属于目标设计，不能当作现有工具。
