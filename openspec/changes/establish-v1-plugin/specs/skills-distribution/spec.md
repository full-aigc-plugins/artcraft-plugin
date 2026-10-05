# ArtCraft — skills-distribution

## Purpose

本能力定义 ArtCraft 在 skills-distribution 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范，尚未实现。

## ADDED Requirements

### Requirement: AC-SK-001 独立技能事实源

技能 SHALL 在独立技能仓库维护；插件仅同步固定 tag、commit 和 SHA-256 的发布副本；不得使用 latest、分支浮动引用或包外符号链接。

#### Scenario: AC-SK-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成独立技能事实源并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-SK-001-N 边界条件

- **WHEN** 技能源码更新但插件锁文件未更新
- **THEN** 插件继续使用旧快照，漂移检查拒绝未经同步的发布

### Requirement: AC-SK-002 独立安装与依赖声明

专业技能 SHALL 通过公开 CLI 接口运行；单独安装时不得依赖插件私有路径；ArtCraft 技能 SHALL 明确声明编排运行时依赖。

#### Scenario: AC-SK-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成独立安装与依赖声明并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-SK-002-N 边界条件

- **WHEN** 只安装一个技能且其运行时缺失
- **THEN** 返回依赖缺失及正确的 setup 路径，不访问兄弟技能目录
