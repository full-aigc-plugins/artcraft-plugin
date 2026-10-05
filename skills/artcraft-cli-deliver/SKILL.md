---
name: artcraft-cli-deliver
description: 当需要收集原生子工程、素材、计划和证据，移动包后核验时使用 ArtCraft；本技能自带首次安装与公开 CLI 入口。
license: Apache-2.0
---

# ArtCraft 交付打包

本技能负责收集原生子工程、素材、计划和证据，移动包后核验。与同包技能按名称交接，单独安装即可使用，不读取兄弟目录。使用本项目的本地编排 CLI；上游 ArtCraft 是 Tauri 应用，不安装或冒充同名官方 CLI。

## 输入与交付

输入为用户已确认的任务、素材、工程或对象、输出目录与修改范围；需要现有工程时先核对摘要。返回实际 CLI 结果、保存后的原生工程、需要的派生输出与核验记录。安装成功、命令目录存在与创作任务完成分别报告。

## 首次使用与公共入口

定位当前 SKILL.md 的真实目录。当前支持 macOS arm64、Python 3.11+；自动安装固定 Node、编排包、领域技能源和原生 CLI，不要求全局 Node。已有任务授权覆盖必要依赖时直接执行本技能安装器，不另造批准流程。

```bash
python3 -I -B /mnt/skills/user/artcraft-cli-deliver/scripts/bootstrap.py
python3 -I -B /mnt/skills/user/artcraft-cli-deliver/scripts/cli.py -- --version
python3 -I -B /mnt/skills/user/artcraft-cli-deliver/scripts/cli.py -- --help
```

`/mnt/skills/user/artcraft-cli-deliver` 是挂载示例，替换为实际加载目录；CLI argv 在 `--` 后，原生子命令必须放首位。安装参数放分隔符前；`--runtime-home` 可隔离缓存。锁定制品摘要失败、损坏安装或不支持平台时停止；不改 PATH、不执行浮动升级。原生帮助入口是 `--help`；launcher 自身 `--help` 只说明启动参数。

## 场景操作

核对本场景输入、原生工程、目标对象、版本和输出边界。按 [场景指南](references/scenario.md) 选择当前命令，保存独立检查点后执行；完成后重开原生工程并检查实际输出与非目标内容。

本项目 `--help` 定义 run/status/cancel/package/verify-package；语义计划走 workflow.py，不能将上游 Tauri 的账号/供应商方法当编排 CLI 命令。

使用 package.py create/verify；保存外部 manifest SHA，review_ready 不等于创作审核完成。

原生组合与源工程修订使用本技能自带 `scripts/workflow.py`；读取 [工作流合同](references/workflow.md)，模板在本技能 examples 内。只修改授权对象，原生工程和依赖素材保留，派生格式损失读取 [交换报告](references/exchange-loss.md)。

## 核验与恢复

命令非零退出不算完成；需要查看真实保存工程、导出、尺寸及媒体解码。超时结果标 unknown，先检查原任务/工程，不能自动重放编辑。恢复与打包分别按本技能 references/recovery.md 与 references/project-package.md 操作，review_ready 只表示技术就绪。

## 按需参考与交接

- [实际命令证据](references/commands.json)：固定版本观察，仅作为路由与参数参考；实时结果优先，禁用项不执行。
- [工作流合同](references/workflow.md)：组合操作、原生保存、依赖收集与修订。
- 安装/诊断需要时交给 **artcraft-cli-setup**，完整任务路由交给 **artcraft-use**；缺少技能时使用 `npx skills add full-aigc-skills/artcraft-skills --skill <skill-name>`。不通过相邻文件路径加载其他技能。

本技能不提供虚构的登录接口；本地 headless 不要求云账户。完整 GUI、跨编辑器保真与创作质量按实际证据陈述。
