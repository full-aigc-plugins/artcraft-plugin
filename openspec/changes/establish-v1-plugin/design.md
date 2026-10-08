# ArtCraft V1 Design

## Context

动机和边界见 [proposal.md](proposal.md)。当前已实现独立技能源安装、公开四领域交接、账本/DAG、源工程修订、项目打包和独立监督接管；完整专业能力、创作审核及宿主验收仍按任务与证据推进。ArtCraft 的代表任务是：完成品牌图形、海报、动态片头与宣传片；替换 Logo 后仅更新依赖它的产物；中断恢复不重复提交已发生的生成任务。

## Goals / Non-Goals

**Goals:** 独立技能分发、可信运行时、声明式计划编译、可恢复任务、原生工程与导出双重交付，以及可追溯质量结论。

**Non-Goals:** 不重写上游应用，不实现 SaaS，不把原生交付降为只有图片/视频；不实现剪映适配、不自动安装或调用剪映，剪映由其独立插件负责。

## Decisions

1. 独立 `artcraft-skills` 是知识事实源，插件同步不可变发布副本；替代方案“插件内手工维护一套技能”会形成漂移，予以拒绝。
2. 官方 CLI/MCP 是执行端，适配器编译声明式计划并核对能力；替代方案“LLM 直接拼接任意 shell”无法保证接口和副作用边界。
3. 拟采用 TypeScript/Node.js 24 LTS、SQLite 与内容寻址文件。替代方案云数据库/队列对本地单用户 V1 没有必要，出现跨机器需求后另提变更。
4. 副作用先写意图和幂等键；不明确结果保留工程占用并 reconcile。替代方案超时自动重试会产生重复编辑或重复计费。
5. 公共协议由 ArtCraft 规范持有，领域仓只拥有自己的 payload 与映射。替代方案每个插件独立定义公共 JSON 将导致不兼容。
6. 技术验证与创作评估分离，已有有效用户授权持续生效；只在超范围动作或修改授权约束时要求新的授权。

## Component design

完整中英文运行时设计位于 [中文架构](../../../docs/ArtCraft-Runtime-Architecture.zh_CN.md) 和 [English architecture](../../../docs/ArtCraft-Runtime-Architecture.md)。领域计划对象包括 CreativeBrief, WorkflowPlan, ProjectRevision, AssetVersion, TaskReceipt，以下能力逐项编译：

| 能力 | 行为边界 | 状态 |
| :--- | :--- | :--- |
| 混合需求与交付约束 | 将用户需求转为可版本化 Brief，记录画幅、品牌、角色、字体、预算与原生交付要求；歧义阻止依赖它的步骤，不阻塞独立检查。 | 计划中 |
| 能力与交付驱动路由 | 按能力快照与用户原生格式选工具；剪映由独立插件负责，不纳入 ArtCraft 适配；原生格式不匹配时不得静默替换；不要求每次安装或调用全部插件。 | 计划中 |
| 依赖调度与并发隔离 | 执行前检查 DAG 循环、缺失节点与输入版本；独立节点可并行，同一原生工程单写；下游只消费已验证产物。 | 计划中 |
| 素材版本与选择性失效 | 区分逻辑资产 ID 与内容哈希；显式记录派生边；修改 Logo 只使传递依赖失效，已审阅旧版本仍可追溯。 | 计划中 |
| 跨产物一致性 | 以固定品牌与主体参考评估海报、片头和成片，问题绑定资产版本及帧或区域；单一提示词不是一致性证据。 | 计划中 |
| 交付与外部生态接入 | 汇总子工程、素材、输出、损失报告和验收记录；现有插件需经过公开适配接口，禁止导入兄弟仓库私有模块或伪造完成。 | 计划中 |

## State and recovery

核心状态为 planned、blocked、ready、running、reconciling、verifying、review_ready、completed、failed、cancel_requested、cancelled。同一原生工程单写；状态写入采用 epoch 防止过期执行者提交。原生应用不是账本事务的一部分，需要用检查点、文件核验和 reconciliation 收敛。父编排器不能将 accepted 当 completed，也不重复承担子插件的副作用重试。

## Risks / Trade-offs

| 风险 | 发现方式 | 处理与责任人 |
| :--- | :--- | :--- |
| R1 | 上游命令或格式变化 | Runtime owner：固定版本，比较 schema，重跑 fixture；未通过保持旧版 |
| R2 | 文字、透明或颜色交接损失 | Domain owner：保存源工程，生成 loss report，使用像素与对象检查 |
| R3 | 断线导致重复提交 | Harness owner：持久化意图与幂等键，先 reconcile，再决定重试 |
| R4 | 文档被误读为已实现 | Release owner：功能状态为 planned；无技能和运行时入口不得进市场 |
| R5 | ArtCraft 商标和受限许可代码边界 | Maintainer：独立实现；不复制上游 ArtCraft/Services 代码；品牌授权在发行前核对 |

## Migration Plan

新仓库无历史插件状态迁移。按 M1 运行时与技能 → M2 专业闭环 → M3 跨插件 → M4 宿主发布推进；ArtCraft 公共协议先定义，真实跨插件验收在领域端就绪后执行。升级采用版本目录与排空，保留旧组合；涉及状态 schema 时先备份，禁止不兼容回退。文档基线不进入可安装市场。

## Validation strategy

每条规范通过正向和失败场景验收；任务表关联需求 ID、测试与产物。验收覆盖清洁安装、原生重开、输出解码/像素检查、局部修改、中断恢复、重复调用与宿主加载。元数据检查、MCP 握手与单次调用不能替代完整创作验收。

## Deferred measurements

具体渲染吞吐、峰值内存、macOS x64/Windows/Linux 和各宿主版本兼容性必须通过 M2/M4 测量后填写，不影响当前本地优先架构与任务分解。名称与品牌资源使用由维护者在发行门禁核对。

### 公共技能脚本执行边界（实施补充）

四领域适配器使用独立技能公开 workflow.py argv，可信发布锁约束解释器、脚本及原生 CLI。执行器分别校验启动器和原生运行时，禁止模型 payload 选择执行路径。当前适配器先支持新建计划与公共素材绑定；原生源工程修订、完整媒体探测及四领域真实联调作为现有任务的未完成部分保留。技术 review_ready 不代表创作 completed。具体实施边界见 docs/ArtCraft-Public-Skill-Adapter.zh_CN.md。

### 独立首次使用安装（实施补充）

独立 artcraft-use 的公开 workflow.py 串联固定 Node、ArtCraft 运行时、四个独立技能源快照和四个官方 CLI。runtime ZIP 与技能 ZIP 由插件构建脚本从各自事实源生成，锁定压缩包及逐文件摘要；仅在暂存验证后原子安装，损坏的已有版本拒绝复用且保留。CLI 与命令能力快照通过各领域公开入口核验，不导入兄弟技能私有模块。项目入口串行化同目录调用，冻结计划、登记表与授权绑定。

12 项安装/技能测试与 48 项运行时回归已通过。4.1/4.2 对应失败测试和最小实现完成，4.3 在线制品及完整边界验收保持未完成。自有发布包当前通过本地锁定 ZIP 验证，不能据此声明在线或宿主安装成功。详情见 docs/ArtCraft-First-Use.zh_CN.md。

## Shared budget implementation

采用 SQLite 共享预算账户，范围为 ownerId/workflowId/authorizationRef，政策固定。原生执行的可信消耗上界与工程租约在同一写事务分配；新计划修订计轮次，未知执行保留额度，同修订重跑与复用不重复占用。账本 schema 2 保留旧历史读取，但无计量旧范围拒绝新执行。实施和边界见[预算架构](../../../docs/ArtCraft-Budget-Architecture.zh_CN.md)。付费适配器实际账单核销仍未实现。独立 revision.py 已实现基于具名审阅失败计数的轮次／停滞循环，自动审美评价和自动补丁生成未实现；当前机制验收见[质量架构](../../../docs/ArtCraft-Quality-Gates-Architecture.zh_CN.md)。

## dev.6 已实现恢复决策

原生监督由固定独立 worker 承担，调度器恢复只核对持久化停止证据并验收原任务，不新 claim、不重放、不重扣预算。父工作流取消由 worker 直接读取；停止前保留 cancel_requested。worker 本身崩溃或提交窗口未知保留写锁与待核对状态。verifying 可重新核验，并发接管至多发布一个 outcome。SQLite schema 保持 v2；旧任务没有停止证据时不假造恢复完成。细节与序列图见双语 Runtime Architecture 10.4；证据见 docs/evidence/crash-recovery.json。

## 交换报告实施决策

报告生成器属于各独立技能源，插件仅消费不可变快照。报告绑定原生、重开记录与导出摘要；lost/observed/unknown 不互相提升。ArtCraft 严格核验报告结构和实际文件，不允许 nativeSubstitute；历史无报告的交付不补造证据。实现与真实回归已验证，跨编辑器完整保真任务仍待验收。

## CLI 场景技能增量设计

参考 Dreamina 的 use / CLI / setup / 业务场景分层，但按真实命令划分任务。四原生 CLI 保持各自 argv 和工程保存语义；每个技能打包自己的最小运行资源，禁止跨技能文件路径。共有资源在仓库发布脚本中按摘要同步，避免手工维护多份逻辑。上游 ArtCraft 的 scene 保存、生成请求与异步轮询仅作为设计参考，不复制受限代码；本项目 ArtCraft CLI 的事实源为现有 src/cli.ts。原有 use 公开入口保持兼容。插件从新不可变技能源标签同步全部清单，宿主验收锁按新版本单独更新。

## 质量机制实施位置与验收

AC-QA-001、AC-QA-002 的实现位于独立 artcraft-skills 的 review.py、revision.py，插件消费固定快照。早期 src/evaluation/ 路径不再作为实际模块描述。公开验包先于具名审阅；四类状态分别保存，失败不被视觉声明覆盖，审阅不改任务账本。修订冻结策略、目标、授权和命令范围，限于失败节点与依赖；原交付保留，未知步骤不自动重放，停止时重验最佳包并报告未解决问题。任务8.1–8.6 的当前固定安装验收及独立创作门禁见[中文架构](../../../docs/ArtCraft-Quality-Gates-Architecture.zh_CN.md)和[English architecture](../../../docs/ArtCraft-Quality-Gates-Architecture.md)。

### AC-DM-005：固定参考的一致性观察合同

在现有 `craft-review-input/v1` 上增加可选 `consistency` 字段，旧输入和旧记录保持可验证。该字段使用 `craft-consistency/v1`，明确固定的品牌与主体资产引用，以及各 creative check 使用的完整参考 ID 集合。每条已执行的观察使用 `craft-consistency-observation/v1`，绑定检查 ID、当前目标版本与摘要、同一组参考、评价者、状态、方法和非空观察描述。读取已经通过摘要校验的证据字节，拒绝只含提示词、旧引用、替换评价者和不一致状态。

PhotoCraft 目标需要区域定位，EffectCraft 与 FilmCraft 目标需要帧定位；三个领域未全部提供观察时结果为 NOT_RUN。任一观察失败保留目标版本及定位并聚合为 FAIL。观察 PASS 仅表示具名评价者提供的证据满足合同，不能代替人工接受、完整创意质量或未覆盖领域验收。记录移动后重新验证同一合同与文件清单，不能只相信记录中的聚合状态。
