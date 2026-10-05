# AC-TX-002 幂等与不明确结果恢复

- 规格：[task-execution](../../openspec/changes/establish-v1-plugin/specs/task-execution/spec.md)。
- 结果：[崩溃接管证据](../../docs/evidence/crash-recovery.json)。
- 失败阶段：两个真实 SIGKILL 测试在原实现中均保持 running，缺少 worker 持久停止证据。
- 当前：独立 worker 监督同一次原生执行，DAG 和相同公开 workflow 入口接管原任务；76 项并行回归通过，包含 EffectCraft 0.2.0 实际渲染与解码。
- writer/worker 本身退出或提交窗口未知仍保留工程占用。未确认停止不重试，未创作审核不标记 completed。
