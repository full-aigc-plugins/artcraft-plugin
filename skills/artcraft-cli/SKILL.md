---
name: artcraft-cli
description: 当需要查询实际命令参数和能力，调用公开 CLI、MCP 与诊断时使用 ArtCraft；本技能自带首次安装与公开 CLI 入口。
license: Apache-2.0
---

# ArtCraft CLI 公共操作

本技能负责查询实际命令参数和能力，调用公开 CLI、MCP 与诊断。与同包技能按名称交接，单独安装即可使用，不读取兄弟目录。使用本项目的本地编排 CLI；上游 ArtCraft 是 Tauri 应用，不安装或冒充同名官方 CLI。

## 输入与交付

输入为用户已确认的任务、素材、工程或对象、输出目录与修改范围；需要现有工程时先核对摘要。返回实际 CLI 结果、保存后的原生工程、需要的派生输出与核验记录。安装成功、命令目录存在与创作任务完成分别报告。

## 首次使用与公共入口

定位当前 SKILL.md 的真实目录。当前支持 macOS arm64、Python 3.11+；基础入口安装固定 Node 与编排包；workflow.py 按任务图安装所需领域技能源和原生 CLI，不要求全局 Node。已有任务授权覆盖必要依赖时直接执行本技能安装器，不另造批准流程。

将 `SKILL_DIR` 设置为宿主实际加载的本 `SKILL.md` 所在目录（绝对路径）。用户级安装可能位于 `~/.agents/skills/artcraft-cli`，项目级可能位于 `.agents/skills/artcraft-cli`，插件可能位于其 `skills/artcraft-cli` 或宿主缓存目录；以实际加载路径为准，不按当前工作目录猜测，也不搜索后随意选择重复版本。技能目录与 CLI 的用户数据安装目录是两个独立位置。

```bash
: "${SKILL_DIR:?请先设置为本 SKILL.md 的实际所在目录}"
python3 -I -B "$SKILL_DIR/scripts/bootstrap.py" --runtime-only
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- --version
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- --help
```

CLI argv 在 `--` 后，原生子命令必须放首位。安装参数放分隔符前；`--runtime-home` 可隔离缓存。锁定制品摘要失败、损坏安装或不支持平台时停止；不改 PATH、不执行浮动升级。原生帮助入口是 `--help`；launcher 自身 `--help` 只说明启动参数。

## 场景操作

先查询当前版本与命令目录；只读和编辑调用分别记录。读当前工程状态与命令 enabled/params 后构造 argv；需要创建对象的连续步骤在同会话执行，不能猜测返回 ID。

本项目 `--help` 定义 run/status/cancel/package/verify-package；语义计划走 workflow.py，不能将上游 Tauri 的账号/供应商方法当编排 CLI 命令。



原生组合与源工程修订使用本技能自带 `scripts/workflow.py`；读取 [工作流合同](references/workflow.md)，模板在本技能 examples 内。只修改授权对象，原生工程和依赖素材保留，派生格式损失读取 [交换报告](references/exchange-loss.md)。

## 核验与恢复

命令非零退出不算完成；需要查看真实保存工程、导出、尺寸及媒体解码。超时结果标 unknown，先检查原任务/工程，不能自动重放编辑。恢复与打包分别按本技能 references/recovery.md 与 references/project-package.md 操作，review_ready 只表示技术就绪。

## 按需参考与交接

- [实际命令证据](references/commands.json)：固定版本观察，仅作为路由与参数参考；实时结果优先，禁用项不执行。
- [工作流合同](references/workflow.md)：组合操作、原生保存、依赖收集与修订。
- 安装/诊断需要时交给 **artcraft-cli-setup**，完整任务路由交给 **artcraft-use**；缺少技能时使用 `npx skills add full-aigc-skills/artcraft-skills --skill <skill-name>`。不通过相邻文件路径加载其他技能。

本技能不提供虚构的登录接口；本地 headless 不要求云账户。完整 GUI、跨编辑器保真与创作质量按实际证据陈述。

需要通过既有 Video Factory 验证成片时，读取本技能 [公开验证交接](references/video-factory.md)。该适配保留 NOT_RUN，不替代创作审阅或原生工程。

保存后结果未知时，按本技能 `references/recovery.md` 核验 `failure.json`、原始暂存工程与停止证据；同一任务不重放，失败暂存不是成功交付。

## 完整领域命令交接

需要模板之外的原生操作时，读取本技能[完整领域命令组件](references/domain-commands.md)，使用自带domain_commands.py查询2646条命令、实际MCP参数及交接选定领域。每个技能都包含四领域创建／返工示例；unknown不重放，组件回执不代替DAG原生交付与验收。

原生渐变、多重填充及源工程改色返工：使用当前技能的 [Vector外观指南](references/vector-appearance.md)。

原生父级、透明度表达式与源工程返工：使用当前技能的 [Effect表达式指南](references/effect-expression.md)。

Photo原生调整层、选区蒙版与可信源返工见 [局部调整指南](references/photo-adjustment.md)。

需要独立启动领域 GUI 命令时见 [自有桌面交接](references/desktop-handoff.md)。

混合任务参考 [业务场景手册](references/business-scenes.md)，先确认依赖与输入版本，再执行子工程、局部返工和交付核验。

安装失败时读取 [首次使用诊断](references/first-use-failures.md)，按回执定位当前技能自身的 setup 入口；安装失败与原生调用失败分别处理。

真实配音识别与混合字幕任务，请读取本技能的 [混合 ASR 指南 / Mixed ASR guide](references/mixed-asr.md)，按固定领域分发和持久模型目录执行；规划、返工与验收分别保留依赖、原生工程和执行证据。

任务身份及拒绝详情按 [任务回执说明](references/task-receipts.md) 读取；节点摘要不代替实际执行回执。

混合海报、封面和源工程返工前阅读 [Photo完整交付](references/photo-delivery-integrity.md)，区分宿主独立插件与Art内部固定依赖。

固定品牌与主体参考的跨产物观察，见本技能 [一致性审阅合同](references/consistency.md)；源码候选与已发布固定版本的验收分别报告。

## 运行时升级与旧账本

遇到 `runtime_upgrade_busy` 时，保留旧运行时、原工程和账本，不删除租约或强行修改状态。先用旧版本完成或可信停止任务，再按新版本迁移；只读 `status` 的旧预算标记表示历史未跟踪。详见本技能的[升级指南](references/runtime-upgrade.md)。

Headless原生命令执行的校验和模式边界见 [命令合同边界](references/command-contract-boundary.md)。
