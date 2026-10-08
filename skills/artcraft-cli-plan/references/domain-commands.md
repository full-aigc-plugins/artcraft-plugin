# Art完整领域命令组件 / Complete domain command handoff

以当前宿主实际加载SKILL.md的目录设置SKILL_DIR；用户／项目.agents/skills、插件skills或缓存均按实际路径，不依赖兄弟技能。当前目录与原生身份来自本技能 `scripts/distribution.lock.json`，不得从历史指南中的版本号选择安装包。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" list --domain effectcraft --filter expression
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" describe effectcraft prop.setExpression
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" list --domain effectcraft --tools
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" describe effectcraft open_project --tool
```

list/describe离线查询全部2646条命令或实际MCP工具schema，不安装运行时。参数说明保持原文，命令文本不是JSON Schema。先核对工程、对象、素材及实时可执行状态。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" check effectcraft "$SKILL_DIR/examples/domain-effectcraft-create.json" --runtime-home /absolute/isolated-runtime
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run effectcraft "$SKILL_DIR/examples/domain-effectcraft-create.json" --output /absolute/new-original --runtime-home /absolute/isolated-runtime
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run effectcraft "$SKILL_DIR/examples/domain-effectcraft-revise.json" --input project=/absolute/new-original/project.ecproj --output /absolute/new-revision --runtime-home /absolute/isolated-runtime
```

check/run只安装指定领域及Art自身运行时，核对固定目录、全部领域技能文件和原生CLI摘要，通过领域公开commands.py交接。check只检查结构、目录及引用，nativeExecution=NOT_RUN，不证明实际参数或创作成功。run使用同会话真实对象引用；每个独立Art技能都有四领域create/revise实例。实际用户工程必须只读检查实际对象，不照搬实例数组下标。

原生扩展名：Film.fcproj、Effect.ecproj、Photo.pcraft、Vector.vectorcraft。计划必须恰好包含schema=craft-command-plan/v1与operations；每步恰好有command或tool及params对象，as保存实际回执，$ref引用之前的返回值或登记输入，$output解析新输出内路径。--input NAME=FILE复制并校验输入。GUI需明确--mode bridge --connect 127.0.0.1:PORT；Photo按实际服务要求添加--control-token-file FILE，不把令牌放计划。

成功保存artcraft-command-call.json及领域success.json/journal.json；失败或unknown保留原生文件与failure.json。读取所有回执并在新会话只读重开；不要删除失败目录或重放原计划。新修订必须另建计划和目录。超时、畸形JSON、身份不符或输入改变不产生Art技术就绪。

组件回执的 `dagDeliveryAcceptance` 始终为 `NOT_RUN`；`domain_commands.py` 单独调用不注册 DAG 任务或共享预算。需要依赖调度、预算／取消、源工程返工及可迁移包时，使用本技能 `workflow.py`：领域计划中的 `native.command` 已接入公开工作流与原生交付合同。OpenSpec 6.51 的固定版本联合验收已有证据；它不等于全部命令在所有上下文中均已验收。

English: list/describe are offline. check/run install the selected fixed domain and invoke its public commands.py; every Art skill contains all four paired examples. Actual references and live native prerequisites apply. Preserve unknown outcomes and use a new revision rather than replaying. Native call acceptance is distinct from DAG native delivery; the workflow.py DAG route supports native.command under the pinned delivery contract, with version-bound joint acceptance. A standalone component receipt does not establish DAG acceptance. Complete per-command and GUI acceptance are separate.

`usageRecipes` 路径相对于安装回执的领域 `skillRoot`，不能相对于 Art 技能根目录解析。高级外观DAG用法见当前技能内 [Vector外观](vector-appearance.md)；使用领域本身技能可安装 `npx skills add full-aigc-skills/vectorcraft-skills --skill vectorcraft-cli-appearance`。

父级与表达式DAG见本技能的 [Effect表达式指南](effect-expression.md)。使用领域独立技能可安装 `npx skills add full-aigc-skills/effectcraft-skills --skill effectcraft-cli-expressions`。usageRecipes仍属于领域安装回执skillRoot。

## Effect 跟踪输入与结果 / Effect tracking input and result

本技能分发锁中的 Effect 技能源包含 `motion-tracking.md`；当前实际版本及原生身份以锁和安装回执为准。普通 H.264 High 位置跟踪已验收；无损 transform bypass 输入不受原生0.2.0解码器支持。检查原生源像素及 `track.status.tracker.points[].keys`，不能把计划帧数或 stopped 状态当作成功。应用后保存重开并核对目标位置和控制对象。领域专项交给 **effectcraft-cli-tracking**；独立安装命令：`npx skills add full-aigc-skills/effectcraft-skills --skill effectcraft-cli-tracking`。

Historical Effect source dev.29 supplied the [tracking guide](https://github.com/full-aigc-skills/effectcraft-skills/blob/444ed7fda07a7ea212010458a04502c2a52fb1f6/skills/effectcraft-use/references/motion-tracking.md). Use the source version and native identity in this skill’s distribution lock and install receipt. Inspect actual source pixels and point keys, then verify applied target positions after reopening. Planned frame count and stopped execution are insufficient. Lossless transform-bypass input remains unsupported; preserve the original asset and only create an authorized separate proxy.

## 选择执行入口 / Choose the execution route

| 需求 / Need | 入口 / Entry | 核验 / Verification |
| :--- | :--- | :--- |
| 查询命令、参数、分类归属 | `domain_commands.py list/describe` | 离线锁定目录，不执行原生编辑 |
| 单领域明确命令计划 | `domain_commands.py check/run` | `craft-command-plan/v1`、真实领域回执及原生结果；DAG 验收保持 NOT_RUN |
| 依赖、共享预算、局部返工及交付打包 | `workflow.py`，领域操作使用 `native.command` | DAG 账本、原生工程、导出、交换损失及移动包；创作接受另行记录 |

例如，当前技能自带的 `examples/effect-expression-workflow.json` 在 `nodes[].payload.plan.operations[]` 中使用 `native.command`：

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" \
  "$SKILL_DIR/examples/effect-expression-workflow.json" \
  --output /absolute/new-expression-project \
  --runtime-home /absolute/isolated-runtime \
  --authorization effect-expression-local
```

更多已提供场景见 [Effect 表达式](effect-expression.md)、[Vector 外观](vector-appearance.md)、[Photo 局部调整](photo-adjustment.md)及[工作流合同](workflow.md)。这些示例为完整工作流计划，不能直接传给 `domain_commands.py run`。命令目录的 `ownerSkill` 是领域分类入口，`usageRecipes` 相对领域安装回执中的 `skillRoot`；既不是 Art 技能路径，也不是逐项执行通过的证明。

English: use offline queries for command discovery, the standalone component for an explicit single-domain call, and workflow.py for native.command operations that need DAG accounting and editable delivery. The expression example above is a workflow plan, not a craft-command-plan/v1. Category ownership and usage recipes route to the selected domain; they do not assert exhaustive execution acceptance.
