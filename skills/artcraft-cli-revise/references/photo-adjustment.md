# Photo局部调整与蒙版 / Editable Photo adjustment and mask

本技能自身包含 photo-adjustment-workflow.json 与 photo-adjustment-revision-plan.json。公开入口首次按锁安装Node、runtime83、Photo源19及原生CLI；该计划仅安装Photo领域。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" "$SKILL_DIR/examples/photo-adjustment-workflow.json" --output "$PROJECT_DIR" --runtime-home "$RUNTIME_HOME" --owner local-user --authorization photo-adjustment-local
```

SKILL_DIR是当前技能真实加载目录；领域usageRecipes相对安装回执skillRoot解析，不能相对Art根目录解析。本例是完整DAG，不是craft-command-plan/v1。创建真实调整layer引用，再建立矩形选区和revealSelection蒙版，取消选区。brightness/contrast/legacy均明确给出，蒙版只覆盖产品左半部分；调整保持独立可编辑，不烘焙。

返工复制DAG，revision改v2。从公开回执取得poster.root和poster.outputs[0] artifact；expectedRevision使用nativeProjectRef.sha256，externalInputs为[{root,artifact}]，payload.sourceProject为{assetId:artifact.assetId}。payload.plan换为本技能返工计划，移除expectedProjectSha256占位，由可信适配器按原生引用填充。保存后重开验证调整值30→-30、hasMask、非目标图层和控制区像素、原交付完整摘要、移动包中的.pcraft。失败不盲目重放。

English: bind actual adjustment IDs and selection-mask state. Copy the DAG to revise; bind the previous native digest, artifact and root as external inputs. Replace the domain plan with the paired revision after removing its placeholder digest. The trusted adapter supplies the source hash. Preserve editable native layers and mask, control pixels and original delivery. Source candidate and fixed installed acceptance remain distinct; this does not prove exhaustive748 commands, PSD fidelity, GUI or fullV1.
