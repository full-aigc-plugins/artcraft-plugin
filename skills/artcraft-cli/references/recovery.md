# 原任务恢复合同

开发版本 `0.1.0-dev.6`；运行时从锁定发布包安装，四领域技能保持 dev.1。

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
