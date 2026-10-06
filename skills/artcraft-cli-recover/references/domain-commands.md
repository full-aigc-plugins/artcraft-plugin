# Art完整领域命令组件 / Complete domain command handoff

以当前宿主实际加载SKILL.md的目录设置SKILL_DIR；用户／项目.agents/skills、插件skills或缓存均按实际路径，不依赖兄弟技能。目录固定Film18／Effect、Photo、Vector17，后续版本按分发锁核对。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" list --domain effectcraft --filter expression
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" describe effectcraft prop.setExpression
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" list --domain effectcraft --tools
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" describe effectcraft open_project --tool
```

list/describe离线查询全部2639条命令或实际MCP工具schema，不安装运行时。参数说明保持原文，命令文本不是JSON Schema。先核对工程、对象、素材及实时可执行状态。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" check effectcraft "$SKILL_DIR/examples/domain-effectcraft-create.json" --runtime-home /absolute/isolated-runtime
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run effectcraft "$SKILL_DIR/examples/domain-effectcraft-create.json" --output /absolute/new-original --runtime-home /absolute/isolated-runtime
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run effectcraft "$SKILL_DIR/examples/domain-effectcraft-revise.json" --input project=/absolute/new-original/project.ecproj --output /absolute/new-revision --runtime-home /absolute/isolated-runtime
```

check/run只安装指定领域及Art自身运行时，核对固定目录、全部领域技能文件和原生CLI摘要，通过领域公开commands.py交接。check只检查结构、目录及引用，nativeExecution=NOT_RUN，不证明实际参数或创作成功。run使用同会话真实对象引用；每个独立Art技能都有四领域create/revise实例。实际用户工程必须只读检查实际对象，不照搬实例数组下标。

原生扩展名：Film.fcproj、Effect.ecproj、Photo.pcraft、Vector.vectorcraft。计划必须恰好包含schema=craft-command-plan/v1与operations；每步恰好有command或tool及params对象，as保存实际回执，$ref引用之前的返回值或登记输入，$output解析新输出内路径。--input NAME=FILE复制并校验输入。GUI需明确--mode bridge --connect 127.0.0.1:PORT；Photo按实际服务要求添加--control-token-file FILE，不把令牌放计划。

成功保存artcraft-command-call.json及领域success.json/journal.json；失败或unknown保留原生文件与failure.json。读取所有回执并在新会话只读重开；不要删除失败目录或重放原计划。新修订必须另建计划和目录。超时、畸形JSON、身份不符或输入改变不产生Art技术就绪。

组件回执的dagDeliveryAcceptance始终NOT_RUN。该入口不注册DAG任务、计预算或创建可迁移craft-artifact包；预算／取消、原生依赖／交换报告、完整DAG失效／恢复／移动包由OpenSpec6.51继续实现。原有workflow.py仍负责已支持的混合交付。

English: list/describe are offline. check/run install the selected fixed domain and invoke its public commands.py; every Art skill contains all four paired examples. Actual references and live native prerequisites apply. Preserve unknown outcomes and use a new revision rather than replaying. Native call acceptance is distinct from DAG native delivery; gateway DAG evidence is version-bound; the new appearance distribution requires its own fixed install proof. Complete per-command and GUI acceptance are separate.

`usageRecipes` 路径相对于安装回执的领域 `skillRoot`，不能相对于 Art 技能根目录解析。高级外观DAG用法见当前技能内 [Vector外观](vector-appearance.md)；使用领域本身技能可安装 `npx skills add full-aigc-skills/vectorcraft-skills --skill vectorcraft-cli-appearance`。
