# ArtCraft 公共协议实现状态

本文件说明当前代码与验收边界。唯一行为规范仍为 `openspec/changes/establish-v1-plugin/specs/`。当前处于实施阶段，公共协议字段和图检查已实现；任务账本和本地监督器已有部分实现；完整调度、独立 ArtCraft 技能与宿主安装仍待完成。

## 文件与运行

| 组件 | 位置 | 当前行为 |
| :--- | :--- | :--- |
| 任务 Schema | [craft-task/v1](../schemas/craft-task-v1.json) | 严格核心字段、运行时身份、授权引用和显式预算 |
| 素材 Schema | [craft-artifact/v1](../schemas/craft-artifact-v1.json) | 不可变版本引用、相对位置、时间基准和打包状态字段 |
| 校验器 | [contracts.ts](../src/protocol/contracts.ts) | 字段校验、计划摘要、实际文件摘要与字节数、支持格式的签名 |
| 依赖图 | [dependency_graph.ts](../src/protocol/dependency_graph.ts) | 拓扑排序、循环和缺失节点拒绝、传递下游失效集合 |
| 测试 | [protocol.test.ts](../test/protocol.test.ts) | 正向和边界条件；没有启动领域渲染任务 |

运行需要 Node.js 24+；使用内建 TypeScript 类型擦除，不下载 npm 依赖。

```bash
npm test
```

## 字段决策

`runtimeIdentity` 当前使用 `pluginId`、`pluginVersion`、`cliVersion`、`sha256`、`mode`、`capabilitySnapshotSha256`。`mode` 仅为 `headless` 或 `bridge`。运行时身份通过字段校验不代表程序已探测成功，执行器仍须核验实际版本和能力摘要。

预算使用 `currency`、`maxMinorUnits`、`maxRevisions`、`maxExternalCalls`；上限是非负安全整数，显式 `null` 表示无限。没有省略字段的默认授权；协议校验不负责计费；执行账本已实施共享消耗上界准入，服务商实际核销仍未接入。

`payload.schemaVersion` 标识领域协议，公共层允许该对象的其他 JSON 字段，由领域适配器解释。核心字段和运行时字段不接受未知项。所有 JSON 中的不安全整数均拒绝；精确时间使用字符串。`durationTicks` 必须同时携带有理数 `timeBase`。

计划摘要使用按键排序的本地规范化 JSON 和 SHA-256，不宣称 RFC 8785 兼容。消费者应调用同版实现并固定版本；任务登记时仍需确认请求摘要覆盖实际计划。幂等登记已由[账本](ArtCraft-Task-Ledger.zh_CN.md)实现；完整恢复仍待原生结果核对与崩溃 adoption。

## 文件与依赖核验

公共位置目前只支持包内相对路径。真实路径解析后必须位于交付根中；路径穿越和外逃符号链接拒绝。文件内容以流方式计算摘要和字节数，并检查读取过程中文件变化。

支持文件签名：PNG、JPEG、PDF、SVG、MP4。`application/octet-stream` 表示未作格式声明的字节内容，不用它代替专业格式验收。其他 MIME 返回 `media_type_unsupported`。签名核对不代表文件完整可解码，原生工程和媒体解码仍由领域验证器完成。

`packaged=false` 的依赖必须给出缺失原因；`packaged=true` 不得携带缺失原因。当前校验器核对主文件，尚未逐个核对 rendition、原生工程和依赖文件的实际内容，也未实现素材版本注册表的不可变约束。

图函数返回 Logo 的传递消费者，保持无依赖边的配音有效。调用方负责比较版本、摘要及影响输出的参数，再提供真正改变的节点；当前没有执行队列、工程租约或跨插件素材交接。

## 当前证据

10 项 Node 测试通过，覆盖协议版本、未知字段、日历时间、安全整数、时间基准、文件摘要/大小/签名、路径穿越、外逃链接、打包状态、循环与缺失节点，以及 Logo 的传递失效。

完整公共协议验收还缺任务幂等与状态响应、实际授权覆盖、不可变版本注册、子产物全面核验和四领域真实消费。相关 OpenSpec 任务保持未完成；图测试不代替混合项目执行验收。
