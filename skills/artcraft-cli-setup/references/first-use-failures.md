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

`runtime_lock_invalid` / `node_lock_invalid`：锁的 JSON 根对象、字段类型或当前平台制品结构损坏；在下载或创建运行时目录前拒绝。请从已确认固定发行重新安装完整当前技能，不修改锁来绕过校验，不寻找兄弟安装。

These errors reject structurally invalid runtime/Node locks before download or runtime-directory writes. Reinstall the complete current skill from its confirmed fixed release; do not edit locks to bypass verification or select a sibling installation.

`distribution_lock_invalid` / `bundle_lock_invalid`：分发根对象或制品字段结构损坏。完整分发锁在 Node 安装前检查；未选中的依赖身份也须有效。制品路径、来源地址和版本另保留各自明确的 invalid 错误。

Distribution and bundle shape failures are checked before Node installation, including identities of dependencies not selected for installation. Path, URL and version errors retain their specific invalid diagnostics.

## 场景入口 / Scenario entry points

`workflow.py` 与 `package.py` 安装失败时保留原 `error` 字符串，顶层同时返回 `dependencySetup` 与 `result`；原安装器的 JSON 对象保存在 `installationReceipt`。恢复路径始终指向当前技能自身，不能从另一副本借用脚本。仅 stderr 或非 JSON 诊断也会保留。安装器超时返回 `result=unknown`；其他安装失败返回 `failed`。零退出但安装身份回执不完整也会拒绝，不启动原生任务。

After a scenario installer fails, read top-level `dependencySetup` for the current skill's own recovery path and `installationReceipt` for the original structured installer error. Bootstrap timeouts are unknown; other installation failures are failed. A zero exit with an invalid setup receipt cannot start native work. Input refusal and errors after successful installation keep their own semantics without an installation diagnostic. No native task is replayed automatically.
