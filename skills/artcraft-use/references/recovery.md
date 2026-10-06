# 原任务恢复合同

当前运行时版本由本技能 scripts/distribution.lock.json 固定；领域技能源版本各自读取 bundles，不假设与运行时相同。下文恢复合同自运行时 dev.6 引入；当前行为以固定运行时及对应验证证据为准。

## 操作

调度器异常退出后，保留项目目录和 `tasks.sqlite`。再次运行相同 `scripts/workflow.py` 命令，使用同一计划、revision、owner 和 authorization。独立 worker 在调度器消失后继续监督原生子任务，读取账本取消意图和截止时间，持久化实际 close 与进程组停止证据。恢复不重新分配预算，也不提交第二次原生调用。

原任务仍在运行时返回 `waiting`（公开入口以失败退出码返回可读 JSON）；等待原任务完成后再次核对。不要修改 frozen plan、删除账本或以新项目规避未确认的副作用。

取消：先通过 bootstrap 返回的 `nodeExecutable` 和 `entryPoint` 使用公共 `cancel --database ABS --task TASK_ID` 或 `--workflow RUN_KEY`。取消后等待停止证据，再用相同 workflow 入口核对。仅传取消请求不等于已停止。

## 接管条件与限制

- 核对原任务 token、epoch、命令摘要、运行时和启动器文件身份，沿用原 attemptId。
- 执行已停止且退出码零时重新核验真实产物；验收中断可以重新核验，同一任务至多发布一个结果。
- 产物损坏不能发布引用；命令身份变化或授权失败保留占用并拒绝接管。
- worker 自身崩溃、启动窗口未知、后代进程停止未确认时保持等待与工程写锁，不能自动重放。PID 不存在和导出文件存在都不是充分停止证据。
- SQLite schema 仍为 v2；旧账本已运行但没有停止证据的任务不自动升级为已完成。
- 当前实测 macOS arm64 的 Node 24 与 EffectCraft 0.2.0；Linux 通用执行器未做本机实测，Windows 不支持。
- `review_ready` 是技术待审，仍需视觉、文案与音频审核。

## 已停止失败的诊断（运行时 dev.32 起）

使用本技能 cli.py 查询原任务：安装参数放在 `--` 前，CLI 参数放在其后。

```bash
: "${SKILL_DIR:?本技能实际加载目录}" "${DATABASE:?原账本绝对路径}" "${TASK_ID:?原任务 ID}"
python3 -I -B "$SKILL_DIR/scripts/cli.py" -- status --database "$DATABASE" --task "$TASK_ID"
```

failed 状态以非零退出码返回可读 JSON。error.code 仍为 native_execution_failed；error.diagnostics.domainCode 只表示子进程报告的已知错误，例如 protected_region_changed、missing_fonts、unsupported_command 或 revision_conflict。stdout/stderr 仅记录 bytes、sha256、truncated、complete，不保存原始文本。null 不能被猜测为某个领域原因。

同一工作流失败节点的 failure 保留上述诊断；再次查询或执行同一冻结计划保留原 taskId／attemptId，不重新启动子任务。修正输入后需要新的显式 revision，仍受授权与预算约束。不明确停止、监督器崩溃或后代尚存时，诊断不能代替停止证据。每条管道最多 16 KiB 用于 JSON 解析；不完整、超限、未知或冲突输出只保留摘要。


## 保存后结果未知与原始暂存工程（运行时 dev.78 起）

四领域固定技能源包含 `preserved_stage.py`；安装回执的 capabilitySnapshot.scriptHashes 与任务 launcherIdentity.files 都绑定该文件摘要。模块缺失或被替换会拒绝启动，不能以新的目录绕过身份检查。

原生保存成功后若响应损坏或缺失，任务仍失败并阻断消费者。同一冻结计划只查询原 attempt，不自动重放。领域交付目录内 `failure.json` 的 `stage` 指向保留在原位置的暂存目录；`files` 包含 SHA-256 和字节数，`lastAttempt` 记录未知调用，`replayAllowed` 为 false。这不是成功交付，不能作为 `--source` 的正常 manifest 使用。

恢复顺序：核对账本实际停止证据；按 failure.json 核验原始暂存文件；用对应领域的完整命令技能 `commands.py run`，在新会话中打开原始工程进行检查；确认真实状态后才制定显式新 revision。不要移动或删除暂存目录：部分工程引用绝对依赖路径。只看到导出、捕获副本或 PID 消失不足以恢复。强制终止进程、断电与文件系统崩溃的保全能力尚未验收。
