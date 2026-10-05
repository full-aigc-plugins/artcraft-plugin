# ArtCraft — release-compatibility

## Purpose

本能力定义 ArtCraft 在 release-compatibility 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范；已有实现与限定范围证据不等于完整需求验收。

## ADDED Requirements

### Requirement: AC-RL-001 宿主与发布证据

发布 SHALL 分别验证插件结构、技能来源、运行时、宿主加载、真实任务和原生交付；文档阶段不得进入可安装市场或宣称功能完成。

#### Scenario: AC-RL-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成宿主与发布证据并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-RL-001-N 边界条件

- **WHEN** 只有 OpenSpec 校验与文档检查通过
- **THEN** 状态保持 documentation-baseline，所有实现任务仍未完成

#### Scenario: AC-RL-001-CURRENT 当前固定发布的隔离安装核验

- **WHEN** 指定五个不可变插件发行标签，生成宿主矩阵并在新的隔离配置中安装
- **THEN** 系统 SHALL 从发行标签而非工作树读取版本、技能源和全部技能摘要，实际安装结果与 app-server 启用技能清单逐项匹配
- **AND** 错误版本、技能内容漂移或已有输出冲突 SHALL 在发布矩阵写入前拒绝；本范围不提升模型派发、GUI 或创作验收状态

### Requirement: AC-RL-002 权限与秘密边界

运行 SHALL 限定素材读取与工程写入根目录；模型输出和素材元数据均为不可信输入；密钥通过宿主秘密引用传入，不进入日志、计划、包或技能。

#### Scenario: AC-RL-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成权限与秘密边界并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-RL-002-N 边界条件

- **WHEN** 素材元数据包含额外命令或路径越界请求
- **THEN** 作为数据处理并拒绝越权执行，日志不泄露秘密

## Implementation evidence (non-normative)

`docs/evidence/codex-current-release.json` binds current fixed releases to two actual Codex CLI/app-server versions, five enabled namespaced skills, installed public workflow outcomes and explicit exclusions. The corresponding bilingual Host-Verification-Architecture documents specify the repeatable check. RL-001 tasks remain unchecked until their full P0 prerequisites and scenarios pass.
