---
name: artcraft-use
description: 当品牌、海报、动态图形和视频需要跨工具组合、跟踪素材依赖与版本、恢复任务或更新受影响产物时使用 ArtCraft；首次使用安装锁定运行时和四个独立技能，保留所有原生工程与交付证据。
license: Apache-2.0
---

# ArtCraft 混合创作

本技能负责拆解、选择工具、依赖交接与交付核验。四个领域的独立技能负责各自原生工程。当前平台为 macOS arm64，需要 Python 3.11+；不依赖全局 Node，不使用插件私有路径。

## 安装与首次使用

定位本技能的真实目录。用户已要求完成创作或安装且授权覆盖必要依赖时，运行公开入口；安装固定版本和摘要的官方 Node、ArtCraft 运行时及领域技能快照，再由每个领域技能的公开安装器安装官方 CLI。安装范围仅用户数据目录，不需 sudo，不修改 PATH。

```bash
python3 /mnt/skills/user/artcraft-use/scripts/bootstrap.py
```

`/mnt/skills/user/artcraft-use` 是宿主挂载示例；实际加载位置不同时替换为该技能真实绝对路径。返回 JSON 包含 `nodeExecutable`、`entryPoint` 和四个领域运行时身份。当前锁文件指向固定开发发布制品；制品缺失或摘要不符会明确失败。各领域技能保持自身版本，不跟随 ArtCraft 运行时伪升级。

离线制品可用 `--node-archive`、`--bundle-dir`、`--native-archive-dir` 指定；这些参数不绕过摘要、路径或版本验证。`--runtime-home` 或 `CRAFT_RUNTIME_HOME` 指定隔离安装目录。复用版本时重新核验文件；损坏版本报错并保留，不覆盖、不静默升级。

## 计划与运行

先记录需求、尺寸、时长、帧率、素材、文案、交付格式和修改边界。选择满足原生交付要求的工具。图形→图层设计用 VectorCraft/PhotoCraft；动态图形→时间线用 EffectCraft/FilmCraft。已有剪映、Image Factory、Video Factory 的适配尚未接入本运行时，不假装可自动调用。

参见[计划合同](references/workflow.md)。示例 `examples/brand-campaign.json` 生成 Logo、分层海报、动态图形片头和带字幕、音频的短片。示例需要用户提供 `voice` WAV：

```bash
python3 /mnt/skills/user/artcraft-use/scripts/workflow.py \
  /mnt/skills/user/artcraft-use/examples/brand-campaign.json \
  --output /absolute/path/brand-project \
  --authorization brand-project-authorized \
  --asset voice=/absolute/path/voice.wav
```

`--authorization` 是已有任务授权的引用，不是凭据或额外批准流程。没有音频时，应明确修改计划并取消 `audioRequired`，不能生成伪配音来满足交付检查。

每个节点指定领域 `pluginId`、依赖、公共素材绑定和有界领域计划。运行时从锁定登记表加入真实身份；模型不能选择解释器、脚本或 shell。所有输入在消费前核对，缺失或变更立即停止。项目目录拥有者、计划修订和调用范围固定；重复运行同一修订复用已核验结果。

## 修改、恢复与交付

- 修改语义计划时使用新的 `revision`；同修订内容变化报冲突。仅受影响节点重建，无关节点复用；旧交付保留。相同工作流授权范围共享预算；首个计划不扣修订轮次，之后每个新修订扣一次 `maxRevisions`。示例允许一轮；不要在同一授权范围提高上限或更换货币。
- 开发版本 3 支持登记源工程修订：将上次结果的完整 artifact 与 root 登记为节点 externalInputs，payload.sourceProject.assetId 指向该输入，expectedRevision 使用 nativeProjectRef.sha256。领域 plan 不带 document；适配器填入 expectedProjectSha256，并调用公开 --source。另存新交付，核验旧交付不变；完整示例规则见计划合同。开发版本 4 已修复安装锁竞争；四并发执行器下 16 次 EffectCraft 技术样本和 ArtCraft 全量并行回归通过。此证据不代表生产并发容量。
- 运行中取消登记意图，等待真实子进程和进程组停止；不明确结果保留写占用，不重放任务。开发版本 6 在独立 worker 中监督原生子任务；调度器退出后重跑相同公开 workflow 命令，核对同一执行的停止证据并验收产物。worker 自身崩溃或提交窗口未知时继续等待且保留写占用，不凭 PID 消失重试。参见[恢复合同](references/recovery.md)。
- 交付 SQLite 账本、冻结计划、安装回执、结果清单，以及各子节点原生工程、收集素材、预览和导出。原生工程引用保持可核验；移动包时可能需要对应技能重新链接素材。
- `review_ready` 只表示技术核验。还需检查真实视觉、文字、音频与用户需求；共享预算上界已在原生副作用前控制；付费服务实际核销、创作最终审核尚未完成，不能据此声明生产发布通过。

四个独立技能通过名称交接，不使用兄弟技能相对链接。独立安装：`npx skills add full-aigc-skills/filmcraft-skills --skill filmcraft-use`；其他名称为 `effectcraft-use`、`photocraft-use`、`vectorcraft-use`，分别属于同名 `-skills` 包。插件中同步固定发布标签与摘要；独立安装与插件宿主安装是不同证据范围。

当前验证范围：四个原生公开工作流交接、Logo 语义改动后下游重建、源工程与已有音频保留、CLI 重开和状态核验。完整干净首次使用与在线发布状态以最新测试及仓库证据为准。

开发版本 5 提供项目打包与移动验包：使用 `scripts/package.py create/verify`，参见[交付包合同](references/project-package.md)。从可信账本收集原生工程、登记输入和工作流记录，保留技术待审状态；移动后核验并使用独立技能源工程入口重关联。

ArtCraft dev.7 消费四领域 dev.2 的[交换损失报告](references/exchange-loss.md)。报告引用写入每份公共素材并随项目打包；核验原生/导出/重开检查身份，拒绝未知保真冒充已验证或有损原生替代。
