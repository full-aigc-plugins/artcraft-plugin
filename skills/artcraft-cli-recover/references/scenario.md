# 取消与恢复操作指南

## 目标与前置

检查任务状态、取消原任务并在调度器退出后恢复。先查询原账本和 attempt；unknown/worker 崩溃保留写占用，不凭 PID 消失重新提交。

先检查需求中的工程格式、目标对象、素材摘要、字体与输出约束。输入不完整时继续只读调查，但不猜测依赖它的参数。

## 当前版本命令入口

本项目 `--help` 定义 run/status/cancel/package/verify-package；语义计划走 workflow.py，不能将上游 Tauri 的账号/供应商方法当编排 CLI 命令。

| 命令 ID | 目录标签 |
| :--- | :--- |
| `status` | 本项目编排操作 |
| `cancel` | 本项目编排操作 |
| `run` | 本项目编排操作 |

完整候选参数见本技能 commands.json；enabled 是空会话观察，打开目标工程后必须重查。命令参数 schema 存在不证明它在全部素材与平台有效。

## 执行与验收

1. 保存原生检查点、读取对象 ID 和参数值；已有素材先核验引用。
2. 构造当前版本命令参数；一次只改变请求的属性或对象。连续创建 ID 使用实际回执或同一会话。
3. 保存新原生工程、重新打开，比较目标参数和未修改对象。需要输出时检查帧、像素、音频或矢量结构。
4. 原生工程、素材清单、预览/导出及交换报告交付；技术核验和视觉审核分开记录。

首次组合实例采用本技能 examples 与 references/workflow.md。此实例验证组合能力，不替代所有候选命令的逐项验收。失败保留检查点，不将无损原生交付替换成扁平结果。

## 已停止任务的取消与查询

从原回执取得 TASK_ID 和 PROJECT_DATABASE，沿用原账本；这里取消一个已确认停止的任务，不重新执行原生操作。

```bash
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- status --database "$PROJECT_DATABASE" --task "$TASK_ID"
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- cancel --database "$PROJECT_DATABASE" --task "$TASK_ID"
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- status --database "$PROJECT_DATABASE" --task "$TASK_ID"
```

重复取消返回同一终态。运行中的取消先登记意图，必须继续查询停止证据；cancel_requested 不表示已停止。调度器异常后的恢复按本技能 recovery.md 使用同一冻结计划；worker 死亡或未知提交窗口仍保留占用，不能借换目录或新授权绕过。
