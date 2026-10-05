# ArtCraft — task-execution

## Purpose

本能力定义 ArtCraft 在 task-execution 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范，尚未实现。

## ADDED Requirements

### Requirement: AC-TX-001 版本绑定与单写

执行 SHALL 绑定 planHash、inputHashes、projectRevision、runtimeIdentity 和有效授权范围；同一工程只有一个写入者，冲突不得覆盖用户修改。

#### Scenario: AC-TX-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成版本绑定与单写并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-TX-001-N 边界条件

- **WHEN** 用户在 GUI 中修改工程后提交旧计划
- **THEN** 返回 revision_conflict 并重新检查工程，不覆盖新修改

### Requirement: AC-TX-002 幂等与不明确结果恢复

任务 SHALL 在副作用前登记幂等键；超时且执行结果未知时进入 reconciling；核对原任务或产物前不得重新提交。

#### Scenario: AC-TX-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成幂等与不明确结果恢复并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-TX-002-N 边界条件

- **WHEN** 提交后断线且无法确定是否执行
- **THEN** 保存任务身份并核对已有结果，不增加重复写入或付费提交

### Requirement: AC-TX-003 取消与预算边界

任务 SHALL 区分 cancel_requested 与 cancelled；父子调用共享预算和截止时间；只允许一个层级负责同一副作用的重试。

#### Scenario: AC-TX-003-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成取消与预算边界并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-TX-003-N 边界条件

- **WHEN** 父任务取消但子渲染仍在运行
- **THEN** 保留占用并停止新依赖调度，确认停止后才标记 cancelled
