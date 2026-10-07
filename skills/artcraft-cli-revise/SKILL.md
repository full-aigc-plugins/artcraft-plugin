---
name: artcraft-cli-revise
description: 当需要替换 Logo 或指定资产，修改原生子工程并更新下游时使用 ArtCraft；本技能自带首次安装与公开 CLI 入口。
license: Apache-2.0
---

# ArtCraft 局部返工

本技能负责替换 Logo 或指定资产，修改原生子工程并更新下游。与同包技能按名称交接，单独安装即可使用，不读取兄弟目录。使用本项目的本地编排 CLI；上游 ArtCraft 是 Tauri 应用，不安装或冒充同名官方 CLI。

## 输入与交付

输入为用户已确认的任务、素材、工程或对象、输出目录与修改范围；需要现有工程时先核对摘要。返回实际 CLI 结果、保存后的原生工程、需要的派生输出与核验记录。安装成功、命令目录存在与创作任务完成分别报告。

## 首次使用与公共入口

定位当前 SKILL.md 的真实目录。当前支持 macOS arm64、Python 3.11+；基础入口安装固定 Node 与编排包；workflow.py 按任务图安装所需领域技能源和原生 CLI，不要求全局 Node。已有任务授权覆盖必要依赖时直接执行本技能安装器，不另造批准流程。

将 `SKILL_DIR` 设置为宿主实际加载的本 `SKILL.md` 所在目录（绝对路径）。用户级安装可能位于 `~/.agents/skills/artcraft-cli-revise`，项目级可能位于 `.agents/skills/artcraft-cli-revise`，插件可能位于其 `skills/artcraft-cli-revise` 或宿主缓存目录；以实际加载路径为准，不按当前工作目录猜测，也不搜索后随意选择重复版本。技能目录与 CLI 的用户数据安装目录是两个独立位置。

```bash
: "${SKILL_DIR:?请先设置为本 SKILL.md 的实际所在目录}"
python3 -I -B "$SKILL_DIR/scripts/bootstrap.py" --runtime-only
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- --version
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- --help
```

CLI argv 在 `--` 后，原生子命令必须放首位。安装参数放分隔符前；`--runtime-home` 可隔离缓存。锁定制品摘要失败、损坏安装或不支持平台时停止；不改 PATH、不执行浮动升级。原生帮助入口是 `--help`；launcher 自身 `--help` 只说明启动参数。

## 场景操作

核对本场景输入、原生工程、目标对象、版本和输出边界。按 [场景指南](references/scenario.md) 选择当前命令，保存独立检查点后执行；完成后重开原生工程并检查实际输出与非目标内容。

本项目 `--help` 定义 run/status/cancel/package/verify-package；语义计划走 workflow.py，不能将上游 Tauri 的账号/供应商方法当编排 CLI 命令。

使用新 revision 和登记源工程摘要；旧交付与无关节点保留，不提高原授权预算。

原生组合与源工程修订使用本技能自带 `scripts/workflow.py`；读取 [工作流合同](references/workflow.md)，模板在本技能 examples 内。只修改授权对象，原生工程和依赖素材保留，派生格式损失读取 [交换报告](references/exchange-loss.md)。

## 核验与恢复

命令非零退出不算完成；需要查看真实保存工程、导出、尺寸及媒体解码。超时结果标 unknown，先检查原任务/工程，不能自动重放编辑。恢复与打包分别按本技能 references/recovery.md 与 references/project-package.md 操作，review_ready 只表示技术就绪。

## 按需参考与交接

- [实际命令证据](references/commands.json)：固定版本观察，仅作为路由与参数参考；实时结果优先，禁用项不执行。
- [工作流合同](references/workflow.md)：组合操作、原生保存、依赖收集与修订。
- 安装/诊断需要时交给 **artcraft-cli-setup**，完整任务路由交给 **artcraft-use**；缺少技能时使用 `npx skills add full-aigc-skills/artcraft-skills --skill <skill-name>`。不通过相邻文件路径加载其他技能。

本技能不提供虚构的登录接口；本地 headless 不要求云账户。完整 GUI、跨编辑器保真与创作质量按实际证据陈述。

需要通过既有 Video Factory 验证成片时，读取本技能 [公开验证交接](references/video-factory.md)。该适配保留 NOT_RUN，不替代创作审阅或原生工程。

## 审阅驱动的连续修订

需要按审阅问题连续返工时，读取 [受控修订指南](references/revision.md)，使用本技能 `revision.py` 冻结目标／授权与节点命令范围，再执行明确补丁。当前包、审阅和策略摘要都使用此前可信回执；不编造人工接受或观察。入口自动保留原工程、更新受影响节点并打包，轮数／预算／停滞时停止。结果未知先核对原任务，仅显式恢复同一步骤。

```bash
python3 -I -B "$SKILL_DIR/scripts/revision.py" step --project "$PROJECT_ROOT" --package "$PACKAGE_ROOT" --package-sha "$PACKAGE_SHA" --review "$REVIEW_ROOT" --review-sha "$REVIEW_SHA" --policy "$REVISION_POLICY" --policy-sha "$POLICY_SHA" --request "$REVISION_REQUEST"
python3 -I -B "$SKILL_DIR/scripts/revision.py" status --project "$PROJECT_ROOT"
```

## 品牌色板混合返工

本技能自带品牌图形／海报／片头／成片和独立图标的五节点示例。按本技能 [品牌色板指南](references/brand-token-workflow.md) 执行并核对受影响产物；首次安装所需领域由固定依赖锁决定。

## 动态透明序列交接

混合任务需要透明动画、完整帧交接或 Logo 更换后的下游更新时，使用本技能[动态序列指南](references/dynamic-sequence.md)及 `examples/dynamic-brand-campaign.json`。按实际回执验证全部帧、时间基、原生引用和局部返工，不以首帧或普通 JSON 代替序列。

保存后结果未知时，按本技能 `references/recovery.md` 核验 `failure.json`、原始暂存工程与停止证据；同一任务不重放，失败暂存不是成功交付。

## 完整领域命令交接

需要模板之外的原生操作时，读取本技能[完整领域命令组件](references/domain-commands.md)，使用自带domain_commands.py查询2639条命令、实际MCP参数及交接选定领域。每个技能都包含四领域创建／返工示例；unknown不重放，组件回执不代替DAG原生交付与验收。

原生渐变、多重填充及源工程改色返工：使用当前技能的 [Vector外观指南](references/vector-appearance.md)。

原生父级、透明度表达式与源工程返工：使用当前技能的 [Effect表达式指南](references/effect-expression.md)。

Photo原生调整层、选区蒙版与可信源返工见 [局部调整指南](references/photo-adjustment.md)。

需要独立启动领域 GUI 命令时见 [自有桌面交接](references/desktop-handoff.md)。

混合任务参考 [业务场景手册](references/business-scenes.md)，先确认依赖与输入版本，再执行子工程、局部返工和交付核验。
