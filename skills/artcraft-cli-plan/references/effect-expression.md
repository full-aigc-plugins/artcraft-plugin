# Effect父级与表达式 / Native Effect parenting and expressions

本技能自身包含 `examples/effect-expression-workflow.json` 和 `examples/effect-expression-revision-plan.json`。首次执行公开工作流按锁安装本技能分发锁中的 Node、Art runtime、Effect 技能源与原生 CLI；此计划只安装Effect领域。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" "$SKILL_DIR/examples/effect-expression-workflow.json" --output "$PROJECT_DIR" --runtime-home "$RUNTIME_HOME" --owner local-user --authorization effect-expression-local
```

SKILL_DIR为实际.agents/skills或插件缓存中的当前技能；PROJECT_DIR与RUNTIME_HOME使用用户自己的目录。领域参数文档与usageRecipes相对于安装回执的Effect skillRoot解析，不能相对于Art根目录解析。这个示例是完整DAG计划，不是domain_commands.py run接受的craft-command-plan/v1。

明确当前合成并保留返回的layer引用；先layer.select选择目标，再layer.setParent设置Null父级。父级默认补偿变换保持位置，禁止父级循环；明确ID不能替代活动选择。prop.setExpression绑定transform/opacity与enabled，layer.expressions指定layers和布尔enabled。128×64、12fps、一秒；frames[0,0.5]单位为秒而不是帧号。透明度表达式50+time*50生成Alpha128/191；只修改为25+time*50生成64/128。

源返工：复制工作流计划，revision改v2；从此前workflow回执取得intro.root和intro.outputs[0]。expectedRevision设置为artifact.nativeProjectRef.sha256，externalInputs设置为[{root,artifact}]，payload.sourceProject为{assetId:artifact.assetId}；payload.plan换成本技能的返工示例，并去除示例expectedProjectSha256，由适配器按可信原生引用填充。保留父级、控制图层、合成、原交付和安装资源，不改安装技能中的示例。交付.ecproj、native.json、依赖与参数记录、两个RGBA预览、交换损失及移动交付包。

English: the public example installs only the Effect source and native CLI pinned by this skill’s distribution lock, alongside its pinned Node and Art runtime. Retain actual layer IDs, establish selection, then parent the target. Parenting compensates transforms by default and rejects cycles. Expression paths and enabled switches are native; preview times are seconds. Copy the workflow to revise, bind prior intro root/artifact as externalInputs and nativeProjectRef digest as expectedRevision, set payload.sourceProject and replace payload.plan with the local revision plan after removing its placeholder digest. The adapter supplies the trusted source hash. Verify actual alpha at both times and preserve parent/control/composition/original delivery. This does not establish all expressions, exhaustive640 commands, GUI or fullV1.
