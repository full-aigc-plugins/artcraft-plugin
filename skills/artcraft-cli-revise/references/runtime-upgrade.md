# 旧账本升级使用指南

runtime `0.1.0-dev.128-runtime.1` 对 schema1 迁移先检查任务、租约和执行是否排空。`runtime_upgrade_busy` 是保护性拒绝；不要删除数据库、租约或执行记录来绕过。使用原来固定运行时完成、取消或恢复任务并确认可信停止。未知状态与无法证实停止的执行仍须保留等待处理。

先设置 `SKILL_DIR` 为当前加载技能目录，将 `DATABASE` 设置为原任务的 SQLite 账本绝对路径，保持账本身份。公开只读查询：

```bash
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- status --database "$DATABASE"
```

旧 schema 只读状态中的 `budgetTracking: untracked-legacy-schema` 表示历史额度未记录，不表示免费或新预算；旧任务查询不触发迁移。实际修改入口在排空后自动检查并迁移，不需要手工执行 SQL。

迁移前会生成带随机标识的 `.schema-v1-*.sqlite` 独立快照，权限0600；快照校验失败时拒绝迁移。保留快照与原固定运行时。快照不是自动原生工程回滚；高版本账本不能交给旧运行时强制降级。不得自动重放旧任务或放宽预算。

完整原生升级与回退矩阵尚待专项验收。本技能指南和 SQLite 单元测试不代替该验收。
