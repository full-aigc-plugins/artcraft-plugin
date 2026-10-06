# ArtCraft — craft-artifact-protocol

## Purpose

本能力定义 ArtCraft 在 craft-artifact-protocol 范围内对用户、宿主与下游系统承诺的可观察行为、失败语义和验收证据，确保规划、执行与实际交付之间保持可验证的边界。本文件定义目标合同；PCM WAV 登记与核验已有固定首次使用证据，完整协议验收以 tasks 和绑定证据为准。

## ADDED Requirements

### Requirement: AC-CP-002 公共素材协议与失效规则

ArtCraft SHALL 维护 craft-artifact/v1 的唯一规范事实源；清单包含 assetId、version、sha256、bytes、mediaType、producerTaskId、sourceRefs、nativeProjectRef、renditions、dependencies、technicalMetadata、lossReportRef、evidenceRefs；依赖图仅在输入版本或影响输出的参数改变时失效。

#### Scenario: AC-CP-002-P 合同条件满足

- **WHEN** 请求满足本需求的来源、输入、状态和证据条件
- **THEN** 系统按本需求完成公共素材协议与失效规则并返回可核对的结果
- **AND** 结果绑定当前版本与执行身份，不提升未验证能力状态

#### Scenario: AC-CP-002-N 边界条件

- **WHEN** 仅修改 Logo 版本，配音无依赖边
- **THEN** 使 Logo 的传递下游失效，配音节点保持有效；拒绝循环派生边

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
