# 首次使用失败诊断 / First-use failure diagnostics

公开 bootstrap 安装失败保留 `error`，并返回 `dependencySetup`：

| 字段 / Field | 含义 / Meaning |
| --- | --- |
| `skill` | 对应领域的 cli-setup 技能名称，按名称交接；无需读取兄弟技能目录 |
| `bootstrapScript` | 当前安装副本自身的绝对脚本路径，含空格时须加引号 |
| `runtimeHome` | 本次实际请求的绝对运行时目录，技能安装位置与运行时位置分别保留 |
| `automaticRetry` | 失败回执不会自动再次发起任务；固定下载器内部的有限只读重试另按其合同执行 |

The failure receipt preserves the original error and identifies the current skill's own bootstrap path and requested runtime home. Diagnostics do not replay tasks or select another installed version. Bounded read-only download retries are a separate installer contract.

## 按错误采取下一步

- `unsupported_platform`：核对锁和本技能的支持平台；不换用其他平台二进制。
- 下载失败：保留错误，核对网络与原固定地址；离线参数读取当前 bootstrap 的 `--help`，仍须校验摘要。
- `archive_checksum` / `installed_checksum`：停止使用该制品，保留被拒绝内容和身份记录；不得删除或覆盖已损坏安装来掩盖失败。需要隔离验证时显式选用新的 runtime-home。
- 缺少或损坏锁文件：从已确认的固定发行重新安装完整当前技能；bootstrap 自身不生成新锁或寻找兄弟副本。

原生 CLI 已成功安装后的调用错误不会附加依赖安装诊断。编辑超时、断开或 unknown 状态需读取任务日志及保存工程，先确认实际结果，不能直接重跑原计划。安装失败、安装成功、原生任务完成分别报告。

After successful installation, native call failures remain native failures. Reconcile editing timeouts against journals and saved projects before constructing a revision. Installation does not establish task completion.
