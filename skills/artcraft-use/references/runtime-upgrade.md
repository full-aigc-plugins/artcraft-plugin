# 旧账本升级使用指南

runtime `0.1.0-dev.136-runtime.1` 对 schema1 迁移先检查任务、租约和执行是否排空。`runtime_upgrade_busy` 是保护性拒绝；不要删除数据库、租约或执行记录来绕过。使用原来固定运行时完成、取消或恢复任务并确认可信停止。未知状态与无法证实停止的执行仍须保留等待处理。

先设置 `SKILL_DIR` 为当前加载技能目录，将 `DATABASE` 设置为原任务的 SQLite 账本绝对路径，保持账本身份。公开只读查询：

```bash
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- status --database "$DATABASE"
```

旧 schema 只读状态中的 `budgetTracking: untracked-legacy-schema` 表示历史额度未记录，不表示免费或新预算；旧任务查询不触发迁移。在旧版本排空任务后，显式调用公开升级入口，不需要手工执行 SQL：

```bash
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- upgrade --database "$DATABASE"
```

返回 `runtimeVersion`、`schemaVersion`、`migrated` 和 `snapshot`。实际迁移时 `snapshot` 包含旧schema版本、绝对路径与SHA-256；已是当前schema时 `migrated: false`、`snapshot: null`，不生成第二份快照。缺失账本返回错误，不创建空账本。

迁移前会生成带随机标识的 `.schema-v1-*.sqlite` 独立快照，权限0600；快照校验失败时拒绝迁移。保留快照与原固定运行时。快照不是自动原生工程回滚；高版本账本不能交给旧运行时强制降级。不得自动重放旧任务或放宽预算。

只在明确需要回退且已核对兼容性时，保留原快照并复制到单独的回退路径，由保留的兼容旧运行时显式读取复制件；不把schema2原账本交给只支持schema1的旧版。必须核对快照摘要与旧运行时来源，保留所有原生工程；不重放历史编辑，不自动迁移回旧schema。

完整固定安装升级与回退矩阵尚待专项验收。本技能指南和 SQLite 单元测试不代替该验收。

DAG领域工作流仅使用headless身份；声明bridge时返回capability_missing，不能静默降级。需要bridge／desktop命令时使用完整命令组件的显式模式和会话授权。
