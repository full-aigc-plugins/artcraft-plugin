# 自有桌面交接 / Owned desktop handoff

仅限 macOS arm64。Art 自身保存项目编排记录；需要 GUI 的领域命令可显式使用 desktop 模式。当前技能目录 SKILL_DIR 必须为实际加载目录，不依赖兄弟技能。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" run vectorcraft "$SKILL_DIR/examples/domain-vectorcraft-desktop.json" --mode desktop --output "$OUTPUT" --runtime-home "$RUNTIME_HOME"
```

其他领域使用各自 domain-filmcraft-desktop.json、domain-effectcraft-desktop.json、domain-photocraft-desktop.json。OUTPUT 尚不存在且父目录已存在。可用 --input NAME=PATH 明确导入素材。该入口仅安装所选领域的source21包、固定CLI和桌面，Node／Art运行时仍按自身锁安装。安装回执核验全部领域文件及原生CLI，子技能自身启动隔离GUI、核对PID监听归属、执行同会话工作流并关闭本次进程。Art核对完整命令回执及desktop-session.json的域、版本、二进制身份和退出状态。

不要为 desktop 传 --connect 或 --control-token-file；控制地址及Photo认证由子技能拥有。需要连接已有明确会话时仍使用 bridge 模式。未知结果和失败文件保留，不自动重放。领域命令成功不会冒充混合DAG交付成功；这份计划没有Art DAG验收。旧headless混合项目与本入口各有验收范围。

English: select desktop explicitly to delegate owned startup to the pinned domain skill. It is independent of sibling Art/domain installations. Existing headless/connected-bridge contracts remain. External connect/token options are rejected before setup; command and desktop lifecycle receipts must match the selected source bundle and native identities. Failed/unknown edits are preserved without replay. Native command success is not mixed-DAG acceptance.
