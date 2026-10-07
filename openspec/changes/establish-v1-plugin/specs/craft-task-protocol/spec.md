# ArtCraft — craft-task-protocol

## Purpose

本能力定义 ArtCraft 在 craft-task-protocol 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范，尚未实现。

## ADDED Requirements

### Requirement: AC-CP-001 公共任务协议所有权

ArtCraft SHALL 维护 craft-task/v1 的唯一规范事实源；请求包含 protocolVersion、taskId、idempotencyKey、planHash、inputRefs、expectedRevision、runtimeIdentity、authorizationRef、budget、deadline；响应区分 accepted、running 与 verified，领域插件通过固定版本引用本规范。

#### Scenario: AC-CP-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成公共任务协议所有权并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-CP-001-N 边界条件

- **WHEN** 同一幂等键收到不同 planHash
- **THEN** 返回 idempotency_conflict；相同输入返回原任务身份

请求字段约束（本需求的组成部分）：

| 字段 | 类型与规则 |
| :--- | :--- |
| protocolVersion | 常量 `craft-task/v1`；未知主版本执行前拒绝 |
| taskId / idempotencyKey | 1–256 字符标识；身份在恢复中保持；键按调用方与目标插件分区 |
| planHash | 64 位小写十六进制 SHA-256，覆盖规范化计划 |
| inputRefs | 非空版本引用的数组；每项含 assetId、version、sha256；允许明确声明的空输入创作 |
| expectedRevision | 工程存在时为必填稳定版本；创建时显式为 null |
| runtimeIdentity | 包含插件/CLI 版本、摘要、执行模式、能力快照摘要 |
| authorizationRef | 当前任务已有授权的引用；不包含凭据或访问令牌 |
| budget | 外部计费货币与最小单位上限、修订次数、外部调用次数；无限额须显式表达，默认不隐含授权 |
| deadline | UTC ISO 8601；到期启动核对或取消，不直接推断失败 |
| payload | 领域插件自己定义的版本化 schema，公共层不能随意解释 |

响应 SHALL 包含 taskId、attemptId、state、runtimeIdentity、outputRefs、evidenceRefs 和结构化 error（若有）。accepted 仅表示已登记；completed 需要当前版本的交付验收。允许状态为 planned、blocked、ready、running、reconciling、cancel_requested、cancelled、verifying、review_ready、completed、failed。错误须区分 runtime_missing、capability_missing、revision_conflict、idempotency_conflict、outcome_unknown、artifact_invalid、budget_exhausted 和 authorization_required。

#### Scenario: AC-CP-001-V 协议升级

- **WHEN** 请求使用未知主版本或核心字段出现不支持的字段
- **THEN** 适配器在副作用前拒绝并返回协议错误；领域扩展只允许进入版本化 payload

#### Scenario: AC-CP-001-A 已有授权

- **WHEN** authorizationRef 覆盖当前动作、目标文件和预算，且计划未超出该范围
- **THEN** 系统继续执行，不因每个工具调用重复请求确认

#### Scenario: AC-CP-001-OWN-FIELDS 未声明的原型同名字段

- **WHEN** 请求根对象、运行时身份、预算或输入引用包含 schema 未声明的 `constructor`、`toString` 或 `__proto__` 自有 JSON 字段
- **THEN** 协议校验 SHALL 报 protocol_invalid，账本 SHALL 不登记任务、不分配预算或写入占用
- **AND** 字段判定 SHALL 只查询 schema 的自有 properties；允许附加字段的版本化 payload 与领域 plan 保留这些合法 JSON 数据，不扩大核心字段范围
- **AND** 共享校验器应用于严格素材对象与引用，不把来源候选测试提升为固定发行安装验收或完整公共协议完成

#### Scenario: AC-CP-001-WORKFLOW-RECEIPT 工作流公开任务回执

- **WHEN** 公开工作流返回已登记、执行结束、恢复等待或复用的节点
- **THEN** 节点 SHALL 在 `taskReceipt` 中公开当前持久账本的 taskId、attemptId、state、runtimeIdentity、outputRefs、evidenceRefs 和结构化 error；节点摘要不替代该回执，不把准备阶段提升为真实执行
- **AND** 准备或授权阶段的拒绝 SHALL 提供结构化 `errorDetail`，保留现有字符串 error 以兼容调用者；未登记的节点不得伪造 taskReceipt，拒绝不新增原生启动、预算分配或工程占用
- **AND** 重开或复用 SHALL 保留原 taskId 与 attemptId，并重新读取当前账本状态；候选源码回归不替代固定发行安装或本需求整体验收
