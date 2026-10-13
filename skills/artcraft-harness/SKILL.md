---
name: artcraft-harness
description: ArtCraft 内置执行 harness——所有 artcraft 领域技能（artcraft-use、artcraft-cli 及各场景技能）的统一执行通道。执行 workflow 编排、公开 CLI 调用、领域命令交接、审阅、修订、打包或首次安装固定运行时时，经由本技能的入口脚本执行；领域技能只提供场景知识、计划与示例，不自带脚本。
license: Apache-2.0
---

# ArtCraft Harness（内置执行通道）

本技能是 ArtCraft 技能套件的**唯一执行实现**：Node 与编排运行时安装、领域技能源分发、语义计划 workflow、公开 CLI、领域命令交接、审阅与修订、打包验包都收敛在本目录 `scripts/` 内。`artcraft-use`、`artcraft-cli` 及各领域技能是薄文档技能——它们提供场景指引、计划示例与参考契约，实际执行一律经由本技能的入口。**执行任何 ArtCraft 脚本前，先把 `HARNESS_DIR` 设为本 `SKILL.md` 所在目录（宿主实际加载的绝对路径），不要假设当前工作目录就是技能目录。** 用户级安装可能位于 `~/.agents/skills/artcraft-harness`，项目级可能位于 `.agents/skills/artcraft-harness`，插件可能位于其 `skills/artcraft-harness` 或宿主缓存目录；以宿主实际加载路径为准。

## 八个入口

| 入口 | 用途 |
|---|---|
| `scripts/bootstrap.py` | 首次安装器：`--runtime-only` 安装锁定 Node 与编排包；`--plugin <domain>` 增量安装所选领域技能源与原生 CLI，返回 JSON 回执。 |
| `scripts/workflow.py` | 语义计划执行器：按任务图自动安装所需领域，保存并核验原生工程、派生输出与项目包。 |
| `scripts/cli.py` | 公开编排 CLI 直连通道：`--version` / `--help` / run/status/cancel/package/verify-package；原生子命令放 `--` 之后。 |
| `scripts/domain_commands.py` | 完整领域命令交接：`list` / `describe` / `check` / `run`，查询 2646 条命令、实际 MCP 参数并交接选定领域。 |
| `scripts/package.py` | 项目打包与移动验包：`create` / `verify`，从可信账本收集原生工程与工作流记录。 |
| `scripts/review.py` | 审阅记录：`record` / `verify`，绑定具名观察、责任插件与当前版本。 |
| `scripts/revision.py` | 受控修订：`step` / `status`，冻结策略并执行明确补丁，保存轮次与最佳包锚。 |
| `scripts/brief.py` | 版本化需求记录：`create` / `assess`，workflow.py 经 `--brief`/`--brief-sha` 消费。 |

`scripts/setup.py` 是 bootstrap.py 内部调用的领域技能源安装实现，不作为独立入口；`png_inspection.py`、`jpeg_inspection.py`、`consistency.py`、`mode_catalog.py`、`public_call.py`、`download.py`、`native_contract.py` 由上述入口按固定文件名动态加载或子进程调用，不单独执行。运行时版本与制品摘要以 `scripts/distribution.lock.json` 与 `scripts/node.lock.json` 为准。

## 用法

以 `artcraft-use` 等领域技能中的场景指引为准；计划与示例文件取自对应领域技能目录（`SKILL_DIR` 指领域技能自身目录）：

```bash
: "${HARNESS_DIR:?请先设置为 artcraft-harness SKILL.md 的实际所在目录}"
python3 -I -B "$HARNESS_DIR/scripts/bootstrap.py" --runtime-only
python3 -I -B "$HARNESS_DIR/scripts/workflow.py" \
  "$SKILL_DIR/examples/brand-campaign.json" \
  --output /absolute/path/brand-project \
  --authorization brand-project-authorized \
  --asset voice=/absolute/path/voice.wav
```

公开 CLI 与领域命令交接（cli.py 的原生子命令须放在 `--` 之后；domain_commands.py 输出恒为 JSON）：

```bash
python3 -I -B "$HARNESS_DIR/scripts/cli.py" -- --version
python3 -I -B "$HARNESS_DIR/scripts/domain_commands.py" list --domain effectcraft --filter expression
```

离线制品可用 `--node-archive`、`--bundle-dir`、`--native-archive-dir` 指定；这些参数不绕过摘要、路径或版本验证。`--runtime-home` 或 `CRAFT_RUNTIME_HOME` 指定隔离安装目录。安装范围仅用户数据目录，不需要 sudo，不修改 PATH。

## 领域技能与本 harness 的关系

- `artcraft-use`：完整任务路由与交付合同；执行仍走本 harness。
- `artcraft-cli`：公开 CLI、MCP 与诊断的场景知识；执行仍走本 harness。
- `artcraft-cli-setup`：首次安装、摘要校验与排障指引；执行仍走本 harness。
- `artcraft-cli-plan` / `execute` / `assets` / `revise` / `recover` / `deliver` / `review`：规划、执行、素材登记、修订、恢复、交付与审阅的场景知识与示例；执行仍走本 harness。
- 领域技能文档中的 `SKILL_DIR` 指领域技能自身目录（用于读取其 `examples/`、`references/`）；脚本执行路径一律换成本目录 `HARNESS_DIR/scripts/`。
- 执行合同（安装回执、任务回执、恢复、审阅、修订、打包、模式目录）见 `artcraft-use` 技能对应 `references/` 文档；本技能 `references/` 仅保存脚本经 `ROOT/references/` 读取的执行契约 JSON（`domain-command-index.json`、`mode-command-catalog.json`）。
