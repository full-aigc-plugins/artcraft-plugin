# 局部返工操作指南

## 目标与前置

替换 Logo 或指定资产，修改原生子工程并更新下游。使用新 revision 和登记源工程摘要；旧交付与无关节点保留，不提高原授权预算。

先检查需求中的工程格式、目标对象、素材摘要、字体与输出约束。输入不完整时继续只读调查，但不猜测依赖它的参数。

## 当前版本命令入口

本项目 `--help` 定义 run/status/cancel/package/verify-package；语义计划走 workflow.py，不能将上游 Tauri 的账号/供应商方法当编排 CLI 命令。

| 命令 ID | 目录标签 |
| :--- | :--- |
| `run` | 本项目编排操作 |
| `status` | 本项目编排操作 |

完整候选参数见本技能 commands.json；enabled 是空会话观察，打开目标工程后必须重查。命令参数 schema 存在不证明它在全部素材与平台有效。

## 执行与验收

1. 保存原生检查点、读取对象 ID 和参数值；已有素材先核验引用。
2. 构造当前版本命令参数；一次只改变请求的属性或对象。连续创建 ID 使用实际回执或同一会话。
3. 保存新原生工程、重新打开，比较目标参数和未修改对象。需要输出时检查帧、像素、音频或矢量结构。
4. 原生工程、素材清单、预览/导出及交换报告交付；技术核验和视觉审核分开记录。

首次组合实例采用本技能 examples 与 references/workflow.md。此实例验证组合能力，不替代所有候选命令的逐项验收。失败保留检查点，不将无损原生交付替换成扁平结果。

## 原生 Logo 返工步骤

1. 用本技能 workflow.py 保存初次工作流回执；从结果取各节点的完整 root、outputs[0] 和 nativeProjectRef.sha256，不自己构造 ID 或摘要。
2. 修改计划 revision，沿用原 owner、workflowId、authorization 与预算；对要修改的节点设置 payload.sourceProject.assetId、externalInputs 和 expectedRevision，删除领域 plan.document 与已继承的 providedAssets。
3. VectorCraft 从 manifest.bindings 获取 Logo 和文字对象，执行 paint.setFill；PhotoCraft 从旧 logo.layer 选中旧图层并用 layer.layerMask.hideAll 隐藏，再 asset.place 新 Logo，保留文字与其他图层；EffectCraft 用 asset.replace 替换 logo 资产，保留图层和关键帧。
4. FilmCraft 用 asset.import 导入新片头，并按旧 clip 创建回执中的 clips 执行 clip.replaceFromBin，保留音轨与字幕。初次 timeline.place 要用 as 保存绑定；已有包未保存时先核对原生 clip ID，不能猜测名字。
5. dependsOn 与 assetBindings 指向新 Logo/片头的真实 assetId；无关节点的计划、输入与 projectKey 不改。再次运行同一修订应复用原 taskId；旧工程各文件摘要不变。
6. package.py create/verify 保留五类资料：原生工程、素材、预览与导出、工作流记录、验收证据。包移动后用外部保存的 sha 验证，review_ready 仍需创作审阅。

以上使用本技能自带脚本；命令 argv 和 SKILL_DIR 按 SKILL.md。替换海报 Logo 的方法保留隐藏的旧图层与新增图层，不声称原生资源原位替换或无损跨编辑器转换。
