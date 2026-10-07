# 自有桌面交接 / Owned desktop handoff

仅限 macOS arm64。Art 自身保存项目编排记录；需要 GUI 的领域命令可显式使用 desktop 模式。当前技能目录 SKILL_DIR 必须为实际加载目录，不依赖兄弟技能。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run vectorcraft "$SKILL_DIR/examples/domain-vectorcraft-desktop.json" --mode desktop --output "$OUTPUT" --runtime-home "$RUNTIME_HOME"
```

其他领域使用各自 domain-filmcraft-desktop.json、domain-effectcraft-desktop.json、domain-photocraft-desktop.json。OUTPUT 尚不存在且父目录已存在。可用 --input NAME=PATH 明确导入素材。该入口仅安装所选领域的source21包、固定CLI和桌面，Node／Art运行时仍按自身锁安装。安装回执核验全部领域文件及原生CLI，子技能自身启动隔离GUI、核对PID监听归属、执行同会话工作流并关闭本次进程。Art核对完整命令回执及desktop-session.json的域、版本、二进制身份和退出状态。

不要为 desktop 传 --connect 或 --control-token-file；控制地址及Photo认证由子技能拥有。需要连接已有明确会话时仍使用 bridge 模式。未知结果和失败文件保留，不自动重放。领域命令成功不会冒充混合DAG交付成功；这份计划没有Art DAG验收。旧headless混合项目与本入口各有验收范围。

English: select desktop explicitly to delegate owned startup to the pinned domain skill. It is independent of sibling Art/domain installations. Existing headless/connected-bridge contracts remain. External connect/token options are rejected before setup; command and desktop lifecycle receipts must match the selected source bundle and native identities. Failed/unknown edits are preserved without replay. Native command success is not mixed-DAG acceptance.

## 桥接工具与模式 / Bridge tools and modes

`domain_commands.py list --domain effectcraft --tools --mode desktop` 和 `describe effectcraft ui_inspect --tool --mode desktop` 按当前分发锁中的真实桥接快照查询。旧领域包未包含该资源时不会凭名称补入工具。

`check DOMAIN PLAN --mode desktop` 仅做结构与身份预检；不启动桌面。`run DOMAIN PLAN --mode desktop --output NEW_DIRECTORY` 委托子技能启动与退出。GUI工具不可在headless模式调用；工具schema与运行中的桥接端一致后才编辑。

Queries use only the actual bridge snapshot in the immutable distribution lock. Older bundles without that resource do not gain tools by name. Desktop checks perform preflight only. Desktop runs delegate owned startup and cleanup; bridge-only tools are refused in headless mode before installation. The child checks live schemas before editing.
