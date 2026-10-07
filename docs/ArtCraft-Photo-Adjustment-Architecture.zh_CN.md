# ArtCraft Photo可编辑调整蒙版分发方案

## 分发与原生合同

沿用runtime83，将Photo领域技能锁定为源19；Film19、Effect19、Vector19保持当前锁定。单个Art技能自带DAG计划、返工计划、安装器和完整命令索引。首次执行仅下载所选Photo领域，不能依赖兄弟技能目录，也不能把领域usageRecipes解析到Art根目录。原生运行时无改动，不引入剪映适配。

```mermaid
flowchart LR
    A[当前独立Art技能] --> B[公开DAG与Brief]
    B --> C[固定Node与runtime83]
    C --> D[Photo源19及原生CLI]
    D --> E[独立调整层与选区蒙版]
    E --> F[pcraft保存重开与像素检查]
    F --> G[可信源返工]
    G --> H[子工程引用与移动交付包]
```

128×64示例保留Product、Control、brightnessContrast独立图层；矩形蒙版只覆盖产品左半部分。调整值30→-30，contrast=0、legacy=false显式指定。原生保存重开后检查hasMask、调整参数、原生ID集合、控制区像素与原交付全部摘要；选择标记属于会话状态，不冒充图层内容变更。

## 可信返工接口

从上一轮公开workflow回执取得poster.root和poster.outputs[0]。expectedRevision绑定artifact.nativeProjectRef.sha256；externalInputs为[{root,artifact}]；payload.sourceProject为{assetId:artifact.assetId}。返工payload.plan使用技能自身photo-adjustment-revision-plan.json，移除expectedProjectSha256占位，由可信适配器提供源工程摘要。revision改v2并写入新任务产物；重复同计划复用已完成taskId，不重放编辑。

## 验证边界

测试为每个Art技能分别创建独立.agents/skills副本和空运行时，调用公开workflow.py、package.py，不使用开发归档注入。验证所选领域安装、实际pcraft重开、局部PNG像素、非目标图层、原交付保护及包移动核验。源候选、固定安装和四领域混合DAG分别记录。122项回归中91通过、31环境相关用例跳过，跳过不作为完成证据。

OpenSpec事实源仍为插件establish-v1-plugin；AC-DM-002任务6.58在固定分发和更新混合项目验收前保持开放。完整2639指令、PSD保真、GUI、模型分派、其他平台及完整V1不由此样例证明。

固定发行验证：Art88／源61／runtime83与Photo21／源19，十项Art及十二项Photo实际安装技能分别从空运行时公开安装并执行蒙版调整创建和源返工；58安装身份不变。额外一项四领域混合任务核验五子工程、Logo四消费者更新、独立图标复用、字幕音频与移动包。四项Art标签CI、两个公开源ZIP与五分发包重建通过。 [Evidence](evidence/codex-art88-photo-adjustment-first-use-20261007.json).
