# Vector 原生渐变与多重外观 / Native Vector appearance

当前技能自带 `examples/vector-appearance-workflow.json` 和 `examples/vector-appearance-revision-plan.json`。首次执行公开工作流会按分发锁安装 Node、Art runtime83、Vector技能源19及原生CLI；该计划只需要Vector领域，无需其他领域下载。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" "$SKILL_DIR/examples/vector-appearance-workflow.json" --output "$PROJECT_DIR" --runtime-home "$RUNTIME_HOME" --owner local-user --authorization vector-appearance-local
```

`SKILL_DIR` 为实际安装的当前技能目录，`PROJECT_DIR` 为用户交付目录，`RUNTIME_HOME` 为用户运行时目录。原生参数文档及`usageRecipes`属于安装回执返回的Vector `skillRoot`，不是Art技能自身的目录。Art中的上述示例是完整DAG工作流；不能把它直接传给接受`craft-command-plan/v1`的`domain_commands.py run`。

`select.set`先建立活动对象，`appearance.setActiveItem`指定paint-order填充行，`gradient.selectStop`选择停止点；显式对象ID不会替代这些状态。全局色板使用原生返回名称链接到停止点，渐变几何必须成对提供start/end。创建交付保留`.vectorcraft`、依赖清单、native.json、SVG/PNG/PDF及交换损失。

源返工：复制创建计划到自己的路径，revision改为v2；从上次workflow回执取得badge节点的root和outputs[0]。设置expectedRevision为该artifact.nativeProjectRef.sha256，externalInputs为[{root,artifact}]，payload.sourceProject为{assetId:artifact.assetId}；payload.plan换成自带返工示例并去除示例expectedProjectSha256，由编排器从可信源引用填充。原交付不改写，绑定对象ID继承，brandEnd全局色板修改为紫色。

English: use the installed skill's public workflow entry. The supplied example downloads only the selected Vector domain at its immutable source19 lock. To revise, copy the plan, set v2, bind the previous node's root/artifact as externalInputs, use the nativeProjectRef digest as expectedRevision and set payload.sourceProject. Replace payload.plan with the local revision example, removing its placeholder expectedProjectSha256; the adapter supplies the actual trusted source digest. Preserve selection and active appearance context. Source revision keeps geometry, IDs, unrelated control and top fill. SVG gradient/decoded PNG checks and PDF header checks are separate from PDF visual equivalence, exhaustive commands, GUI and fullV1 acceptance.
