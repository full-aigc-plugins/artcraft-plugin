# ArtCraft — runtime-distribution

## Purpose

本能力定义 ArtCraft 在 runtime-distribution 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。当前为目标规范，尚未实现。

## ADDED Requirements

### Requirement: AC-RT-001 运行时来源与完整性

运行时安装 SHALL 固定制品来源、版本、平台及摘要；在暂存区验证后原子安装，保留许可与安装回执；不执行未经验证的下载内容。

#### Scenario: AC-RT-001-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成运行时来源与完整性并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-RT-001-N 边界条件

- **WHEN** 下载内容与锁定摘要不符
- **THEN** 拒绝安装且现有运行时仍可使用


#### Scenario: AC-RT-001 固定标签发行包重建

- **WHEN** 维护者依据已审核的发行锁重建运行时与四个领域技能源包
- **THEN** 打包器 SHALL 按每个包的版本读取固定 Git 标签解析后的提交，不读取工作树；所有逐文件摘要、ZIP 摘要、大小与来源核对成功后才输出
- **AND** 缺失标签、摘要不符、符号链接、路径逃逸或已有输出冲突 SHALL 拒绝，不覆盖已有发行包或锁，不自动回退 HEAD 或重新标记版本

#### Scenario: AC-RT-001-FILM-RECEIPT 混合复用的领域安装回执

- **WHEN** 单独安装的 ArtCraft 技能复用已完成混合交付，而固定 FilmCraft CLI 安装回执与锁定版本、平台或来源不符
- **THEN** 系统 SHALL 在编排任务执行前传播领域安装错误，不将已有产物复用报告为就绪，保留全部项目材料和领域安装
- **AND** 恢复原始有效回执后，同一修订 SHALL 复用原任务身份，不重放原生编辑或导出；该保证绑定实际安装的固定 FilmCraft 技能源，不自动推广到未验证领域

#### Scenario: AC-RT-001-ARCHIVE-PREFIX 固定技能归档布局

- **WHEN** 已验证的领域 Git ZIP 显式声明与来源仓库同名的单层 archivePrefix
- **THEN** 安装器 SHALL 核对归档大小和 SHA-256，严格移除该固定前缀，以锁定的根目录文件清单逐字节核验，安装后路径与根布局兼容
- **AND** 缺失或混合前缀、逃逸、重复条目、符号链接、未知文件、坏文件摘要 SHALL 在发布安装目录前拒绝；错误前缀锁须在目录创建及下载前拒绝
- **AND** 未声明前缀时保留既有行为，发行重建 SHALL 使用同一前缀取得固定标签 Git ZIP 原字节，不重新打包或弱化来源摘要

### Requirement: AC-RT-002 运行能力与隔离升级

适配器 SHALL 核对运行时版本和实际命令 schema，区分 headless 与 desktop bridge；升级必须排空任务、保留回退版本，禁止回退到不兼容状态 schema。

#### Scenario: AC-RT-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成运行能力与隔离升级并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-RT-002-N 边界条件

- **WHEN** 新运行时缺少计划要求的能力
- **THEN** 执行前报 capability_missing，禁止静默替换工具


#### Scenario: 领域 CLI 并行安装与复用
- **WHEN** 多个独立节点同时安装或复用同一锁定领域 CLI
- **THEN** 领域安装器有界等待安装互斥最多 120 秒，取得锁后核验已发布版本并复用；超时报 runtime_install_busy
- **AND** 安装协调不会重放原生编辑或渲染，已有工程和安装保持完整

#### Scenario: AC-RT-002-ART-INSTALL-LOCK Art 首次安装有界互斥

- **WHEN** Node 安装或 ArtCraft 组合安装的互斥被其他进程占用
- **THEN** 安装器 SHALL 非阻塞轮询并最多等待 120 秒，超时返回 runtime_install_busy；等待期间不下载、不发布暂存目录、不执行原生编辑
- **AND** 已有安装与用户工程保持不变；占锁进程退出后操作系统释放锁，后续显式调用 SHALL 可取得锁、核验并复用有效安装，不依靠残留锁文件或 PID 判断活动状态

#### Scenario: [AC-RT-002-DOWNLOAD] 有界只读下载恢复
- **GIVEN** Node或固定领域技能归档的公开下载发生临时TLS／连接中断、超时、408、429或5xx
- **WHEN** 首次安装器读取制品
- **THEN** 最多三次重新下载，每次丢弃半包，仍检查大小及固定摘要后才解压发布；403、磁盘错误、大小或摘要不符不重试，不重放任何原生编辑请求。

#### Scenario: [AC-RT-002-FAILED-STAGE] 失败暂存保全分发升级

- **WHEN** Art 接入包含失败暂存保全模块的领域技能源
- **THEN** 新模块绑定固定分发与受信调用身份；实际保存后响应未知仍保留原工程与依赖、阻止下游并不重放
- **AND** 新固定安装副本完成原生重开、混合修订／恢复与摘要验证后才关闭升级门禁，不改写旧锁或宣称全部首版完成


#### Scenario: [AC-RT-002-INNER-JSON] 完整命令响应修复的独立分发

- **GIVEN** 领域固定技能源已修复工具text内层JSON的非有限数值、溢出和重复键
- **WHEN** Art发布更新的领域捆绑包，且编排代码未变化
- **THEN** Art SHALL 固定领域各自版本与完整源ZIP摘要，可以复用相同不可变runtime制品，不改写旧分发锁／标签／安装目录
- **AND** 新固定安装副本 SHALL 复验真实保存后的unknown回执、原工程重开、十独立技能冷安装及混合返工恢复；不得用候选或旧发行替代

#### Scenario: [AC-RT-002-NATIVE-DOWNLOAD] 领域原生安装子进程的临时下载恢复
- **WHEN** 单个Art技能以空缓存安装固定领域CLI，原生下载出现临时SSL EOF或不完整响应
- **THEN** 分发SHALL绑定支持最多三次只读下载并丢弃半包的领域安装器；SHA、证书、权限及安全解压边界保留，原生编辑不得重放；此前失败证据与新固定安装验收分别记录

### Requirement: AC-DS-001 Owned desktop domain handoff
ArtCraft SHALL support explicit domain command `--mode desktop` using immutable pinned child skills. It SHALL verify the child bundle and native CLI, reject external connect/token options before installation, invoke the child's owned desktop launcher, validate the native bridge receipt and desktop lifecycle identity, and preserve unknown outcomes without replay. Headless and explicitly connected bridge modes SHALL retain their existing contracts.

#### Scenario: Desktop command first use
- **WHEN** a valid selected-domain plan runs in desktop mode with an empty runtime
- **THEN** ArtCraft installs only the selected domain bundle, delegates owned startup to that skill, and validates command plus desktop identity and stopped-process receipts

#### Scenario: Conflicting connection or untrusted receipt
- **WHEN** desktop mode supplies an external connection/token or returns a mismatched desktop receipt
- **THEN** ArtCraft rejects the call and does not replay edits

#### Scenario: Desktop handoff receipt or metadata conflict
- **WHEN** a desktop plan targets reserved desktop metadata, or a child receipt mismatches the pinned desktop identity, listener ownership or process cleanup
- **THEN** Art rejects the plan before setup or reports the actual handoff as unknown without replay or claiming mixed-project acceptance

#### Scenario: Mode-aware bridge-only tools
- **WHEN** the selected immutable domain bundle includes a bridge-only tool snapshot
- **THEN** Art verifies its locked file digest and CLI identity, exposes its actual schemas only in bridge or desktop queries and preflight, and refuses these tools in headless mode before installation
- **AND** the child validates live bridge schemas before editing; unlocked snapshot injection and schema drift cannot widen the allowed native tool set


#### Scenario: [AC-RT-002-PLAN-JSON] 严格命令计划的独立分发

- **GIVEN** FilmCraft / EffectCraft / VectorCraft 固定技能源为 dev.28，PhotoCraft 为 dev.29，公开命令计划拒绝根对象、操作对象及参数对象中的重复 JSON 键
- **WHEN** ArtCraft 更新十个独立技能的领域分发锁与完整命令索引
- **THEN** 每个包 SHALL 绑定不可变标签提交、公开 ZIP 摘要和所有文件摘要；保留 Art 原运行时身份及完整 2,646 命令目录
- **AND** 候选单技能公开下载安装、原生保存重开、混合返工和移动包 SHALL 与新固定发行安装复验证据分别记录；结构预检不得创建运行时或输出目录


#### Scenario: [AC-RT-002-BRAND-GUARD] 品牌依赖保护的独立分发

- **GIVEN** VectorCraft 固定技能源 dev.32 包含品牌消费者校验模块，公开 ZIP 使用与锁定 v 标签完全一致的单层仓库前缀
- **WHEN** ArtCraft 升级领域捆绑包
- **THEN** 分发 SHALL 绑定完整源 ZIP、不可变提交与逐文件摘要；安装器接受精确 repository-vVERSION 前缀，仅在 URL 标签、锁版本一致时生效，保留其他路径与完整性拒绝规则
- **AND** brand_variants.py SHALL 同时进入安装回执 files 与 capabilitySnapshot.scriptHashes；缺失受信脚本或摘要漂移不得执行，旧标签及安装保留
- **AND** 候选安装、固定发行独立首用及实际混合返工／错误阻断证据 SHALL 分开记录；不得以独立 VectorCraft 验收替代 ArtCraft 捆绑包验收


#### Scenario: [AC-RT-002-GATEWAY-EXPORT] 品牌网关变体继承的独立分发

- **GIVEN** VectorCraft 固定技能源 dev.33 已修复通用命令入口品牌返工省略 exports 时丢失变体及跳过原计划完整性核验
- **WHEN** ArtCraft 升级领域捆绑并使用 swatch.edit 或 native.command/swatch.edit 返工
- **THEN** 十个独立 Art 技能 SHALL 绑定不可变完整 ZIP、提交、逐文件摘要和对应命令目录，旧分发保留；显式空 exports 列表维持仅原生交付语义
- **AND** 两入口 SHALL 验证旧计划后继承全部九份 SVG／PNG／PDF 变体，关联颜色改变，无关画板和原交付保全，旧计划篡改须在原生编辑前拒绝；Vector 领域工作流自身安装调用前的校验不得宣称为 Art 外层 bootstrap 前校验
- **AND** 候选验收与固定发行的十技能独立冷安装、真实混合网关返工／局部复用／移动包验收 SHALL 分别记录；独立 VectorCraft 通过不能替代 Art 捆绑验收

#### Scenario: [AC-RT-002-SEGMENT-GUIDE] 分段首用说明与固定依赖一致

- **GIVEN** 既有固定分发已验证分段动画，但技能指南仍残留历史候选版本限制
- **WHEN** Art 更新指南和不可变 Film 技能源绑定
- **THEN** 十技能 SHALL 绑定新ZIP、源码提交、全部文件摘要及对应命令索引，读取当前锁与回执识别版本，旧发行保留
- **AND** 新固定安装 SHALL 独立验证十技能空运行时首用、1920×1080／24fps／120帧混合交付、Logo依赖返工、坏帧拒绝与原字节恢复、五子工程迁移及安装字节保全
- **AND** 既有Art117原生证据、通用CLI发现或独立Film验收 SHALL NOT 单独替代本分发验收；Effect未发布候选不进入锁
