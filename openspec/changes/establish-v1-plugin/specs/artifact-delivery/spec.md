# ArtCraft — artifact-delivery

## Purpose

本能力定义 ArtCraft 在 artifact-delivery 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范，尚未实现。

## ADDED Requirements

### Requirement: AC-AR-001 产物血缘与包完整性

产物 SHALL 登记逻辑 ID、不可变版本、内容摘要、来源任务、原生工程和依赖；交付前重新校验文件，移动后可按清单重关联。

#### Scenario: AC-AR-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成产物血缘与包完整性并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-AR-001-N 边界条件

- **WHEN** 输出文件被替换但文件名未变
- **THEN** 哈希校验失败并使原验收失效

#### Scenario: 从可信账本生成可移动项目包
- **GIVEN** 同一授权范围下所有子任务已经核验且没有活跃写入者
- **WHEN** 用户请求打包工作流版本
- **THEN** 收集每个交付 manifest 声明的原生工程、素材、预览与导出，以及登记外部输入、冻结计划和任务记录；使用包内相对索引，独占发布新目录并返回项目清单摘要
- **AND** 技术待审状态不提升为创作完成；移动后按原清单摘要核对所有文件和原生引用；变更、路径外逃、缺文件、未就绪任务或授权冲突均拒绝，失败不覆盖已有交付

### Requirement: AC-AR-002 原生工程与交换损失

交付 SHALL 同时保留约定的原生工程与导出；工程需重新打开检查，交换中的扁平化、栅格化、字体和效果损失必须显式记录。

#### Scenario: AC-AR-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成原生工程与交换损失并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-AR-002-N 边界条件

- **WHEN** 交换格式不能保留所用效果
- **THEN** 保留原工程，报告损失并阻止未接受的有损替代交付

#### Scenario: 绑定原生工程的交换损失报告

- **WHEN** 生成当前版本原生工程和约定导出
- **THEN** 交付 exchange-loss.json 并由 manifest 文件摘要绑定，记录原生工程、重开检查及每个导出摘要；格式损失、实际结构观察与未验证保真分别使用 lost、observed、unknown
- **AND** 原生工程必须保留，导出仅作 derivative；未知字体和效果保真不得标记已验证，缺失、损坏、身份错配或有损 nativeSubstitute 拒绝技术交付

#### Scenario: PhotoCraft variant records survive package relocation
- **WHEN** a source-bound mixed workflow produces a PhotoCraft size variant with a manifest-bound layout-variant.json
- **THEN** ArtCraft SHALL retain that geometry record in the child delivery and validate its digest after package relocation

#### Scenario: A packaged variant record is altered
- **WHEN** a layout-variant.json in a previously verified mixed package is modified
- **THEN** package verification SHALL reject the modified delivery rather than reuse its earlier acceptance

#### Scenario: Legacy variant cache lacks required geometry evidence
- **WHEN** a cached PhotoCraft result is reused for a plan declaring variant geometry but lacks a manifest-bound layout record
- **THEN** ArtCraft SHALL block reuse without replaying native side effects

#### Scenario: Variant evidence is consistent before handoff
- **WHEN** a new, cached or dependent PhotoCraft delivery declares variant geometry
- **THEN** ArtCraft SHALL verify its layout record against the declared target and safe area, saved native layer identities/bounds and the hash-bound native resize operation receipts before reporting readiness

#### Scenario: AC-AR-001-SEGMENT 分段序列类型与收集来源

- **WHEN** 领域输出提供摘要绑定的分段生产检查点或 Film 连续收集清单
- **THEN** Art SHALL 在原有图像序列媒体类型下按明确 schema 区分原 v1、分段生产与领域收集，逐段验证连续有理帧范围、实际像素和资源边界；禁止仅提高旧 v1 限额
- **AND** Film 适配器显式转交分段输入，核对转换后的新摘要与原 sourceSequenceSha256，技术元数据来自实际帧；交付证据包含各段清单及帧，不丢失非目标依赖
- **AND** 坏帧、缺段、重叠、错位、虚假元数据或范围拒绝；恢复后不得重复执行已验证任务或重复收费
- **AND** 固定发布、完整长片头及首次技能安装须另行验收，不以静态协议测试替代
