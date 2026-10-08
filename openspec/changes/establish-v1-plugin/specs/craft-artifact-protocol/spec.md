# ArtCraft — craft-artifact-protocol

## Purpose

本能力定义 ArtCraft 在 craft-artifact-protocol 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。本文件定义目标合同；PCM WAV 登记与核验已有固定首次使用证据，完整协议验收以 tasks 和绑定证据为准。

## ADDED Requirements

### Requirement: AC-CP-002 公共素材协议与失效规则

ArtCraft SHALL 维护 craft-artifact/v1 的唯一规范事实源；清单包含 assetId、version、sha256、bytes、mediaType、producerTaskId、sourceRefs、nativeProjectRef、renditions、dependencies、technicalMetadata、lossReportRef、evidenceRefs；依赖图仅在输入版本或影响输出的参数改变时失效。

#### Scenario: AC-CP-002-JPEG 产品图的内容登记与尺寸核验

- **WHEN** 独立技能首次使用 JPEG 素材，或公共素材声明 image/jpeg
- **THEN** 按内容检查 SOI、段边界、SOF、SOS、扫描转义与 EOI，登记编码栅格 width、height、bitDepth=8、alpha=false；支持 8 位 SOF0、SOF1、SOF2 和 1／3／4 分量，文件上限 64 MiB
- **AND** 非 JPEG 的 jpg/jpeg 文件、截断段、缺失扫描或 EOI、重复帧头、错误尺寸声明在领域启动前拒绝；其他编码过程与位深明确报告不支持
- **AND** 原文件保持不变；原生导入器需要扩展名时，仅在项目所有权与修订绑定通过后生成摘要相同的 jpg 副本，并纳入便携交付
- **AND** 标记结构检查不证明熵编码可解码、EXIF 方向已应用、ICC 保真或视觉质量；实际原生导入、工程重开和独立解码证据分别记录

#### Scenario: AC-CP-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成公共素材协议与失效规则并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-CP-002-N 边界条件

- **WHEN** 仅修改 Logo 版本，配音无依赖边
- **THEN** 使 Logo 的传递下游失效，配音节点保持有效；拒绝循环派生边

#### Scenario: AC-CP-002-VERSION 同版本内容不可改写

- **WHEN** 同一 owner 与逻辑 workflow 的新修订、授权范围或节点交付再次声明同一 assetId 与 version
- **THEN** 该身份及原生工程、表示、依赖与证据引用 SHALL 保持同一 sha256；冲突返回 artifact_version_conflict，不通过变更授权范围清除历史绑定
- **AND** 输入冲突在登记新工作流及分配修订预算前拒绝；输出冲突不得发布为就绪产物，不覆盖旧产物
- **AND** 新版本可以绑定新内容；不同 owner 或逻辑 workflow 独立命名；独立任务按 caller 与工程隔离

素材字段约束（本需求的组成部分）：

| 字段 | 类型与规则 |
| :--- | :--- |
| assetId / version | 逻辑身份与不可变版本分离；同版本禁止修改内容 |
| sha256 / bytes | 64 位小写十六进制摘要、非负整数字节数；以实际文件核验 |
| mediaType | MIME 类型；不以扩展名替代实际格式识别 |
| producerTaskId / sourceRefs | 执行来源及输入版本数组，不能只记录文件名 |
| nativeProjectRef / renditions | 原生工程引用与预览/正式导出表示分别记录 |
| dependencies | 必需素材、字体与 LUT 等依赖；包含打包状态与缺失原因 |
| technicalMetadata | 时间基准、帧率、时长、尺寸、颜色空间、位深、alpha、音频；不适用字段显式省略 |
| lossReportRef / evidenceRefs | 不可交换特性与验收证据的版本化引用 |
| location | 公共交付使用包内相对路径或受控 URI；解析后必须在允许根内 |

时间 ticks 超出 JSON 安全整数范围时 SHALL 使用十进制字符串，有理数基准分别记录分子分母；禁止只用浮点秒完成精确编辑交换。像素或渲染哈希不得自动证明语义等价；工程对象检查与创作审阅单独记录。

#### Scenario: AC-CP-002-PATH 交付包迁移

- **WHEN** 完整交付包移动到另一允许目录
- **THEN** 消费者根据相对引用及摘要重新关联；不依赖生产机器绝对路径

#### Scenario: AC-CP-002-TIME 精确时间交接

- **WHEN** FilmCraft 的大整数 ticks 经过 JSON 与下游适配器交换
- **THEN** 仍能精确还原帧边界；溢出或基准丢失时拒绝转换
- **AND** Film 成片的公共素材 SHALL 从摘要绑定的原生重开记录与导出探测报告映射十进制 durationTicks、原生 timeBase、frameRate、尺寸、alpha及适用的音频信息；禁止以空技术元数据交接成片，也不将精度转换为浮点秒

#### Scenario: 外部 JSON 验收证据

- **WHEN** 登记外部工具返回的 application/json 报告
- **THEN** 系统 SHALL 核对完整文件摘要与 JSON 语法，超过 16 MiB 或语法损坏拒绝登记；领域适配器另行验证报告语义与任务绑定
- **AND** 报告不得通过未定义的 technicalMetadata 字段扩展公共协议，也不得将报告存在视为创作通过

#### Scenario: AC-CP-002-WAV 配音的真实 PCM WAV 登记

- **WHEN** 单独安装的 ArtCraft 技能首次使用已有标准 RIFF PCM WAV 配音，或公共素材声明 mediaType 为 audio/wav
- **THEN** 按内容识别 RIFF/WAVE、fmt 和 data 块，登记实际采样率、声道、位深及以样本帧计的十进制 durationTicks 和有理数 timeBase，不靠扩展名或通用二进制类型证明音频
- **AND** 分发运行时检查完整块边界、数据帧对齐及实际头字段与声明音频／时间元数据一致；假 WAV、截断或错误声明在领域副作用前拒绝
- **AND** 素材版本摘要、源配音文件、原生工程与可迁移交付包保持绑定；已有未知二进制类型行为不提升为已识别媒体
- **AND** 非 PCM、RF64、压缩 WAV 与 WAVE_FORMAT_EXTENSIBLE 不由本场景推断为支持；拒绝时明确报告格式边界，不生成替代配音

#### Scenario: AC-CP-002-PNG 图片的内容登记与属性核验

- **WHEN** 独立技能首次使用静态 PNG 素材，或公共素材声明 image/png
- **THEN** 按内容识别 PNG，核验块边界、CRC、IHDR、调色板／透明信息、IDAT 解压长度与扫描行过滤字节，登记实际 width、height、bitDepth、alpha；alpha 表示通道或 tRNS 表示，不等于存在可见透明像素
- **AND** PNG 属性声明不符、假 PNG、截断、非法压缩数据在领域副作用前拒绝，素材原文件保持不变
- **AND** 支持标准静态 PNG 的合法颜色类型、位深与 Adam7 扫描布局；文件上限 64 MiB、解压扫描数据上限 128 MiB，APNG 明确报告不支持
- **AND** 不由结构与扫描数据核验推断 ICC 色彩保真、视觉质量、JPEG 或视频已验收；既有未声明 PNG 属性的派生物仍核验内容，属性存在时逐项匹配

### Requirement: AC-AR-003 类型化动态 PNG 序列
系统 SHALL 使用 `application/vnd.craft.image-sequence+json` 标识 `craft-image-sequence/v1`，验证描述文件及全部连续 RGBA8 PNG 帧后才允许消费；不得以普通 JSON 或首帧静态图代替动态序列。系统 SHALL 核对帧文件与解码像素摘要、实际 Alpha 极值、尺寸、规范化有理帧率、帧数、时长和时间基，拒绝重复 JSON 键、缺帧、多余文件、符号链接及资源超限。首版限制描述文件 4 MiB、单帧编码 64 MiB、总编码与总 RGBA 解码各 512 MiB、帧数 10000、尺寸 16384、帧率 1–240 fps。

#### Scenario: 完整透明动画可验证
- **WHEN** 描述文件与全部 PNG 内容和技术元数据一致
- **THEN** 系统接受类型化素材，并将所有帧纳入交付与返工证据

#### Scenario: 中间帧损坏或元数据伪造
- **WHEN** 中间帧被修改、丢失，或像素摘要、Alpha 极值、帧率、时长声明与实际序列不符
- **THEN** 系统在领域调用之前拒绝输入，禁止降级为首帧或普通 JSON

#### Scenario: 不完整目录与解析歧义
- **WHEN** 目录存在额外文件、链接、重复 JSON 键或资源超限
- **THEN** 系统拒绝整个序列，不执行下游任务

#### Scenario: Effect 输出与 Film 入口的领域映射
- **WHEN** Effect 交付已登记的动态序列，且 Film 节点依赖该素材
- **THEN** 适配器 SHALL 将描述文件及全部帧纳入摘要证据，将实际技术元数据写入公共素材，并仅通过 Film 公开 `--sequence-asset` 参数交接
- **AND** 不支持序列的领域拒绝输入，Effect 描述文件不得声明为普通 JSON；调用前再次核对输入完整性

#### Scenario: 动态交付的交换损失记录
- **WHEN** 类型化序列附带交换损失报告
- **THEN** 系统 SHALL 验证原生工程绑定及每帧 PNG 与报告输出摘要一致，不把序列描述文件视为保留原生图层与动画参数的替代工程
