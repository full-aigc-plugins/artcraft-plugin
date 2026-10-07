# 版本绑定的历史发行记录

以下记录逐字移自 README 前部，描述各自版本，不作为当前安装合同。

固定Art101／源75验收通过：发现64技能且无加载错误；10个Art技能分别冷启动，按当前技能摘要汇总64项独立冷启动证据。已安装四领域混合流程及两个归档合同通过（190.068秒）；worker故障测试三次直接读取workflowReceipt等待回执，同时保持error兼容且原生只启动一次（54.537秒）。64个安装摘要不变。通用Skills CLI及完整V1仍开放。 [Evidence / 证据](docs/evidence/artcraft101-structured-workflow-receipt-fixed-first-use-20261007.json).

源75结构化回执候选通过106项源回归（34项显式环境测试跳过）、5项目标测试和1项公开冷安装原生worker故障测试。非零工作流返回保留error／退出码兼容并增加workflowReceipt，不解析任意异常文本。固定插件101安装尚待验收。 [Evidence / 证据](docs/evidence/artcraft75-structured-workflow-receipt-candidate-20261007.json).

固定Art100／源74监督worker崩溃验收通过：原生任务启动后SIGKILL本测试拥有的worker；两次恢复保持waiting／reconciling、原attempt、预算、写占用及产物字节，原生只启动一次。原工程／MP4存在和测试观察到进程消失，不被升级为账本可信停止证据。64个安装摘要保持。此证据验证拒绝不安全重放；启动前未知提交窗口及自动／人工收敛仍未验收。 [Evidence / 证据](docs/evidence/artcraft100-worker-crash-first-use-20261007.json).

固定Art100／源74角色验收通过8项测试（6项原生、1项规划、1项引用合同）：七个角色入口、PNG／JPEG／SVG替换和PCM登记、原生工程返工、无关任务复用、五子工程移动交付、审查证据拒绝及调度器SIGKILL恢复。64个安装技能摘要保持不变。PCM为测试信号；创作接受、worker故障／未知提交、通用Skills CLI及完整V1仍未验收。 [Evidence / 证据](docs/evidence/artcraft100-role-first-use-20261007.json).

固定 Art100／源74验收通过：当前64个技能哈希与独立空运行时首次使用证据逐项一致（汇总未变字节的Film13、独立领域41及新Art10三次运行）。Art10次独立冷启动通过（213.886秒）；固定安装副本的四领域原生混合工作流及两个归档契约通过（184.668秒）。8条创建／修订执行记录绑定有效计划、输入、原工程及运行时；复用保全记录字节，64个安装技能哈希均未改变。通用Skills CLI实际安装及完整V1仍未验收。 [Evidence / 证据](docs/evidence/artcraft100-domain-guards-fixed-first-use-20261007.json).

源74候选固定四领域输出保护，runtime83／Film29不变。104项源回归通过（33项显式环境跳过），1项冷原生混合流程与2项归档合同通过（181.575秒）；八条创建／返工记录绑定计划、输入、原工程和运行时，复用保持字节。固定插件100安装单独验收。[证据](docs/evidence/artcraft-domain-guards-candidate-20261007.json)。

固定Art99／源73验收通过：64项安装CLI探测（五个领域冷缓存后复用）、十个Art技能各自独立空缓存（176.942秒），以及1项冷混合四领域原生流程与2项归档合同（166.237秒）。Film29创建／返工记录绑定实际计划，复用不修改记录；全部64安装摘要保持不变。通用Skills CLI和完整V1仍开放。[证据](docs/evidence/artcraft99-film29-fixed-first-use-20261007.json)。

Art 源73候选通过104项源回归（33项需显式环境的测试跳过）及1项冷安装四领域原生流程、2项归档合同。Film29创建／返工记录绑定实际计划和运行时，复用保持记录字节；runtime83与其他三领域锁不变。固定插件安装尚待验收。[证据](docs/evidence/artcraft-film29-distribution-candidate-20261007.json)。

固定Art98／源72素材角色新增3项冷原生验收通过：登记并替换PNG／JPEG／SVG，更新依赖产物并保留无关图标和旧交付，拒绝SVG外部依赖；PCM音频登记、Film原生音轨及移动验包通过。保留输入／输出／包摘要，全部64安装技能摘要保持。PCM使用测试信号，不代表配音内容审核。其他素材类型、完整协议／首版及通用Skills CLI仍开放。 [Evidence / 证据](docs/evidence/artcraft98-assets-role-first-use-20261007.json).

Art 源73候选在十个独立技能中锁定 Film29 执行保护，runtime83及其他领域包保持不变。候选与固定安装验收分别记录。[架构说明](docs/ArtCraft-Film-Execution-Architecture.zh_CN.md)。

固定 Art98／源72 的七个角色入口限定验收通过：覆盖Brief规划、原生执行／源返工、既有账本查询、移动打包、观察记录，以及调度器崩溃后的同attempt恢复。每次角色交接使用不存在的运行时目录；全部64安装摘要保持。账本查询之外的素材登记、worker崩溃、创作／人工审核、通用Skills CLI和完整首版仍开放。 [Evidence / 证据](docs/evidence/artcraft98-role-first-use-20261007.json) · [Architecture / 架构](docs/ArtCraft-Role-FirstUse-Architecture.zh_CN.md).

固定 ArtCraft98／技能源72 首用通过：五个公开插件发现64技能，加载错误0；64个独立副本CLI探测通过，使用五个新领域缓存及后续复用。1项真实冷原生混合工作流和2项归档选项合同通过（154.62秒），覆盖源返工、恢复及移动交付。全部64安装摘要保持；Effect源29／runtime83身份及公开技能源归档字节已核验。通用Skills CLI、Art角色专项及完整首版仍开放。 [Evidence / 证据](docs/evidence/artcraft98-effect29-fixed-first-use-20261007.json).

领域场景验收现为 **43项原生测试通过／全部42个不同场景技能**。固定安装跟踪用例使用受支持H.264 High通过；此前无损输入不受原生解码器支持，失败证据保留。Art角色专项、实际Skills CLI及完整V1仍开放。 [Evidence / 证据](docs/evidence/craft-fixed-tracking-supported-input-20261007.json).

追加专项验收：**累计42项原生测试通过，覆盖41／42个领域场景技能**。多机位、带时间文本转录、滤镜及Puppet补验通过；Effect跟踪视频纹理未出现在预期像素，分析实际关键帧为0，尚未验收。64个安装摘要保持。Art角色专项、自动ASR、实际Skills CLI和完整V1继续开放。[证据](docs/evidence/craft-fixed-additional-task-scenes-20261007.json)。

已安装专项技能首用：**38项原生测试／37个不同领域场景技能通过**，各自使用独立空运行时。Film多机位／转录、Photo滤镜、Effect Puppet／跟踪五项尚未纳入本业务门禁；Art角色专项任务与通用Skills CLI另行验收。全部64安装摘要不变。[证据](docs/evidence/craft-fixed-installed-task-scenes-first-use-20261007.json)。

当前固定版本首版代表任务通过：四领域已安装技能各自使用新公开运行时缓存，验证可编辑原生工程、重开、局部返工及导出。覆盖短片字幕／配音同步与素材移动、片头改字保留动画、海报图层／蒙版／PSD／尺寸变体、矢量布尔／多画板／SVG-PDF-PNG／改色。全部64安装摘要不变。本证据仅覆盖四个代表任务，不等于完整首版或所有专项场景。[证据](docs/evidence/craft-fixed-v1-representative-native-baseline-20261007.json)。

逐技能独立冷启动：**64／64通过**（macOS arm64、Python3.13.5，620.155秒）。每个单技能分别使用独立空运行时与默认公开下载；锁定原生版本和命令发现通过，安装技能摘要不变。通用Skills CLI安装及完整首版仍开放。[证据](docs/evidence/craft-fixed64-every-skill-cold-first-use-20261007.json)。

固定 ArtCraft97／技能源71 验收：五个公开插件发现64技能，加载错误0；64个独立副本CLI探测通过（五个新领域缓存，后续复用）。已安装 Art 通过240次严格JSON拒绝，以及冷原生混合创作、返工、崩溃恢复和移动交付验证。全部安装摘要保持不变。通用Skills CLI及完整首版门禁仍开放。[证据](docs/evidence/artcraft97-strict-plan-fixed-first-use-20261007.json)。

此前已发布插件：**0.1.0-dev.98**，固定技能源 **0.1.0-dev.72**。十个 Art 技能固定 Film／Vector dev.28 和 Effect／Photo dev.29，保留 runtime dev.83 与 2,646 条分类命令。候选和固定安装冷启动混合流程通过，完整首版验收仍开放。

以下为各历史版本的验收记录：

固定安装复验：五插件共62技能在隔离Codex宿主中加载成功，加载错误0；62技能完整命令查询与场景资源核对通过，248项安装失败诊断检查通过；四个新增专项技能的空运行时安装、版本与查询通过。原生创作、全量命令和完整V1按各自证据验收。[安装证据](docs/evidence/craft-fixed62-installation-20261007.json)。

固定发布安装验收：PhotoCraft 插件 dev.30／源 dev.28，ArtCraft 插件 dev.96／源 dev.70。隔离 Codex 0.147.0 发现五插件全部 64 技能，零加载错误；64 独立副本 CLI 探测通过，23 个 Photo／Art 独立技能的七条新增命令参数查询共 161 次通过。两个实际安装入口分别从空缓存执行新增命令并验证预设、原工程、图层及像素保全；安装后全部技能摘要不变。四领域分类目录共 2,646 条，逐命令全部上下文、通用 Skills CLI 和完整首版保持开放。 [Evidence](docs/evidence/craft-photo30-art96-fixed-first-use-20261007.json).

当前固定候选升级 PhotoCraft 源 dev.28，完整领域目录共 2,646 条。插件 dev.96 已固定 Art 源 dev.70；新版本实际安装与七条新增命令原生执行复验待完成。

固定发布安装验证：四领域插件 dev.29／ArtCraft dev.95，共 64 技能在隔离 Codex 0.147.0 中发现，零加载错误；64 独立副本 CLI 探测通过（五个新领域缓存），实际安装 Art 技能的四领域原生创建／返工／重开检查通过。发现 PhotoCraft 755 原生命令中有 7 条缺分类使用说明，待补齐；全量命令和完整首版保持开放。[证据](docs/evidence/craft-fixed64-first-use-20261007.json)。

当前插件：`0.1.0-dev.101`；技能源：`0.1.0-dev.75`；runtime83；Film29／Effect30／Photo30／Vector29。结构化工作流回执通过固定安装首次使用检查，完整V1仍开放。

历史发行记录：当前插件：`0.1.0-dev.93`；技能源：`0.1.0-dev.67`；runtime83；四领域source25分发及自有桌面交接。固定安装桌面首用待验收。[架构](docs/ArtCraft-Photo-Adjustment-Architecture.zh_CN.md)。

固定安装诊断检查：58技能发现通过，184项诊断检查通过；四领域固定副本仍缺失安装脚本本身不存在时的补充修复，当前验收为部分完成。Art插件dev.92锁定技能源dev.66。[证据](docs/evidence/craft-first-use-diagnostics-installed-20261007.json)。

历史发行记录：当前插件：`0.1.0-dev.92`；技能源：`0.1.0-dev.66`；runtime83；四领域source24分发及自有桌面交接。固定安装桌面首用待验收。[架构](docs/ArtCraft-Photo-Adjustment-Architecture.zh_CN.md)。

本次固定版本追加原生验收：Art十项冷启动、四领域四项GUI编辑与保存重开，以及品牌色局部返工、依赖更新和交付打包通过；全量命令、全部GUI和创作质量仍待验收。[证据](docs/evidence/craft-fixed-scene-guidance-20261007.json)。

固定安装场景指引验收：五插件58技能发现与内容摘要、示例引用及完整命令查询通过；四领域运行脚本与锁和示例保持原固定版本身份。Art新分发十项实际冷启动复验通过，全量命令和完整V1仍开放。[证据](docs/evidence/craft-fixed-scene-guidance-20261007.json)。

历史发行记录：当前插件：`0.1.0-dev.91`；技能源：`0.1.0-dev.64`；runtime83；四领域source23分发及自有桌面交接。固定安装桌面首用有界验收通过。[架构](docs/ArtCraft-Photo-Adjustment-Architecture.zh_CN.md)。

历史发行记录：当前插件：`0.1.0-dev.90`；技能源：`0.1.0-dev.63`。完整反射命令入口、独立CLI与桌面安装已提供；固定版本58项独立冷启动、四领域进阶GUI保存／重开／渲染及Art混合返工通过。逐条原生命令执行验收与完整V1保持开放。[固定验收记录](docs/evidence/craft-full-command-fixed-first-use-20261007.json)。

历史发行记录：当前插件：`0.1.0-dev.89`；技能源：`0.1.0-dev.62`；runtime83；四领域source21分发及自有桌面交接。固定安装桌面首用有界验收通过。[架构](docs/ArtCraft-Photo-Adjustment-Architecture.zh_CN.md)。

历史发行记录：当前插件：`0.1.0-dev.88`；技能源：`0.1.0-dev.61`；runtime83；Photo19蒙版调整分发。十项实际安装蒙版调整及更新混合工作流通过。[架构](docs/ArtCraft-Photo-Adjustment-Architecture.zh_CN.md)。

ArtCraft 的十项独立技能源候选通过 Photo19 可编辑蒙版调整、可信源返工与移动包验收。固定发布版本和更新四领域混合项目尚待复验，6.58保持开放。 [Evidence](docs/evidence/artcraft-photo-adjustment-candidate-20261007.json). [Architecture](docs/ArtCraft-Photo-Adjustment-Architecture.md).

当前固定版本的 58 个技能全部通过独立冷启动：单技能目录、空运行环境、公开安装、版本查询及完整命令发现。此证据不代表 2639 条命令全部执行通过或完整场景验收。 [Evidence](docs/evidence/codex-current58-cold-cli-first-use-20261007.json).

当前首次使用入口：插件 `0.1.0-dev.87`，技能源 `0.1.0-dev.60`。中英文安装与命令指南按当前固定发行核验；历史样例证据保留原版本范围。 [Guide](docs/Craft-Native-Gateway-Usage.zh_CN.md).

历史发行记录：当前插件：`0.1.0-dev.87`；技能源：`0.1.0-dev.60`；runtime83；Effect19表达式分发。十项实际安装表达式及更新混合工作流通过。[架构](docs/ArtCraft-Effect-Expression-Architecture.zh_CN.md)。

历史发行记录：当前插件：`0.1.0-dev.86`；技能源：`0.1.0-dev.59`；runtime83；Vector19外观分发。十项实际安装外观及更新混合工作流通过。[架构](docs/ArtCraft-Vector-Appearance-Architecture.zh_CN.md)。

固定原生命令网关首用通过：48项领域安装技能与十项 Art85／技能源58 的公开入口独立冷安装、创建／重开／导出、返工并保全原交付。公开 Brief、四领域网关、五子工程、Logo选择性更新／无关图标复用、移动包、真实取消和六类未知回复故障通过；58项安装摘要不变。全2639命令／GUI／模型／通用Skills CLI／完整V1门禁保持开放。[使用指南](docs/Craft-Native-Gateway-Usage.zh_CN.md) · [固定证据](docs/evidence/codex-native-gateway-first-use-20261007.json)。

历史发行记录：当前插件 dev.85 固定技能源58／runtime83，公开 Brief 网关首用通过；全量逐命令／GUI／模型／完整V1仍开放。

历史预发布记录：原生命令网关插件 dev.84／技能源57／runtime83 固定 Film19 与 Effect／Photo／Vector18。固定安装完整 DAG 复验待执行；历史证据保持原版本范围。

历史候选记录：完整网关DAG源候选实测通过：四领域联动、五子工程及独立图标复用、源工程返工、移动包重开、预算拒绝、损坏恢复、真实取消及六类unknown保全。固定发行和安装副本复验待完成；6.51仍开放。 [Evidence](docs/evidence/native-gateway-joint-candidate-20261007.json).

Historical source-candidate note: Source candidate: complete native workflow gateway; immutable installed acceptance and full DAG gate6.51 remain pending. [Architecture](docs/Craft-Native-Workflow-Gateway-Architecture.md).

固定 ArtCraft82／技能源56 的组件首次使用通过：5插件、58技能、零加载错误；十个Art技能各自查询2639条目录，并独立从空缓存安装、调用四领域（40项原生用例，920次操作）。实际工程保存与返工后重开、目标状态及像素、非目标对象保留均通过；58个安装技能摘要不变。两个公开源包与固定标签逐字节一致，4项插件CI通过。仅关闭组件门禁6.50；完整DAG门禁6.51、2639条逐项命令、GUI／模型、通用Skills CLI及完整V1仍开放。[版本绑定证据](docs/evidence/codex-art82-complete-domain-component-first-use-20261007.json)。

