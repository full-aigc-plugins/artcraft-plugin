# ArtCraft 设计源工程 Brief 检查架构

状态：runtime dev.36／独立技能源 dev.30／插件 dev.38 已完成有界技术首次使用验收；任务 6.26、6.27、6.28 已完成，完整创作和整体验收仍开放。证据：evidence/codex-release38-native-brief-first-use-20261006.json。

## 读取与身份

公开技能适配器从登记输入解析源交付，并核对原生工程引用、manifest 摘要及其中所有文件。读取前后还核对固定原生 CLI 摘要，不接受模型提供的检查响应、本机工程路径或执行器路径。

| 领域 | 固定只读调用 | 提取字段 | 目标绑定 |
| --- | --- | --- | --- |
| PhotoCraft | `info <project.pcraft>` | width、height | 登记原生工程 |
| EffectCraft | `--project <project.ecproj> run comp.info <绑定 ID 的 JSON> --json` | 指定合成的尺寸、frameRate、duration | manifest.bindings.composition.comp 必须匹配响应合成 id |
| VectorCraft | `info <project.vectorcraft>` | artboards[index].rect 的 width、height | 主交付 artboard-N.png/svg/pdf 的 N−1 |

尺寸必须为 1 至 16384 的整数；画板矩形必须有四个有限数字，宽高不可为小数或零。Effect 帧率必须在 1 至 240 之间，时长必须为有限正数。目标缺失或不匹配时返回 `brief_source_inspection_invalid`，不回退到默认画板或其他合成。

```mermaid
flowchart LR
  A[登记源交付] --> B[核验工程及全文件摘要]
  B --> C[核验固定 CLI]
  C --> D[只读原生 info]
  D --> E[绑定目标画板或合成]
  E --> F[核验源及 CLI 未变]
  F --> G[响应摘要及标准化元数据]
  G --> H[保存后原生及实际导出门禁]
```

## 候选实现边界

`parseDesignSourceInspection` 只负责响应解析。实际文件和运行时身份由 `publicSkillFactory` 负责；响应中的 file/path 字段不会成为本机引用。执行超时为 30 秒，响应上限为 8 MiB。该阶段不申请写租约、不修改原始工程；准备的任务文件只写入任务自有输出根。

四领域源工程可延后仅由原生元数据未知造成的阻塞；必须存在可定位的登记源工程和有效 expectedRevision。授权、预算、品牌、歧义和依赖冲突不能延后。Photo／Vector 不支持视频帧率或时长要求，这类要求在依赖下载前报告 capability_missing。

`image.imageSize`／`image.canvasSize`、`comp.settings`、`artboard.new`／`artboard.setProps` 可能改变尺寸或时间属性，声明检查报告 native_output_inspection_required，实际保存后门禁决定结果。新建工程也采用同一后置门禁。新增画板时只读检查绑定原源交付画板，最终门禁绑定新交付画板，避免把不存在的画板默认为第一块。

`verifyNativeBriefOutput` 在 ledger 技术就绪前核验 manifest、原生工程及 native.json 的摘要链，检查保存后画幅、Effect 合成 ID／帧率／时长、Film 帧率及 Vector 主交付画板边界。主 PNG 交付还读取实际 IHDR 尺寸；该检查不等于完整像素或视觉评审。依赖交接和缓存复用都重新执行门禁，不用旧检查状态替代当前文件。

Effect 主视频使用固定原生 CLI 在空内存工程执行 file.import、project.summary 和不带设置变更的 file.interpretFootage，读取唯一视频的尺寸、时长和帧率。不打开或保存创作工程，也不依赖全局 FFprobe。导入返回 exit 0 但包含 errors 时仍失败。实际视频必须匹配画幅和帧率，时长允许最多一个导出帧的封装误差；原生合成时长必须在 1e-9 秒以内匹配需求。视频字节及 CLI 摘要在探测前后复核。

## 验收与待办

单元用例覆盖画板索引越界、合成身份不匹配、非法画幅与时长。真实原生混合用例对移动后的三种交付调用同一适配器，核对元数据、源文件摘要和零租约；它证明只读接口可用，不能证明新功能的冷安装或完整需求验收。

真实返工用例覆盖三领域源 Brief、重复复用、错误尺寸提前阻止、合法尺寸调整以及原生 exit 0 但保存结果不符时零产物失败；另外覆盖 Vector 新增画板和 Effect 实际视频时长拒绝。所有原源工程及依赖摘要保全，最终没有租约。

Python 策略已同步到十个自包含技能，独立技能源 dev.30 已经 vendor 到插件 dev.38 并绑定 runtime dev.36。固定宿主安装和在线首次使用已通过，包含三领域尺寸修改与四源返工。任务 6.28 的有界技术验收已完成；扩大边界、创作评审和整体验收仍开放。
