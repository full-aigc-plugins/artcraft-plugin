# ArtCraft 安装后的调度器崩溃接管验收

固定插件 dev.44、技能源 dev.33、运行时 dev.41。安装后的 `artcraft-cli-recover` 单独复制到 `.agents/skills`，使用空运行目录公开安装 Node、ArtCraft 和 EffectCraft，排除全部离线归档／缓存覆盖。

通过正常工作流入口调度四秒、640×360、24 fps 片头。测试使用只读 SQLite 观察运行任务，按测试自己启动的工作流父子关系和同一数据库参数精确识别调度器，仅向该调度器发送 SIGKILL。等待独立 worker 保存 `stopped`、`group_stopped=1`、零退出码的持久化停止证据；不把 PID 消失当作成功。

随后公开工作流入口重开原项目。任务 ID、attempt ID、token、epoch 和命令身份保持绑定；只有一次原生启动事件，预算账户不变。结果为技术 `review_ready`。现有 ffprobe 确认视频实际 96 帧；再次执行复用同一任务，全部交付摘要不变。技能副本与原安装字节保留，十项已安装 ArtCraft 技能摘要符合固定宿主锁。

真实 1 项通过，用时 22.932 秒；技能源回归 66 项通过、14 项跳过，插件回归 53 项通过、4 项跳过。[证据](evidence/codex-artcraft44-scheduler-crash-first-use-20261006.json)。复现时在技能源仓设置 `CRAFT_SCHEDULER_CRASH_FIRST_USE=1`、实际恢复技能目录 `CRAFT_INSTALLED_RECOVER_SKILL`，可选新证据文件 `CRAFT_SCHEDULER_CRASH_EVIDENCE`，使用现有 ffprobe 执行 `python3 -B -m unittest discover -s tests -p test_scheduler_crash_first_use.py`。

本用例覆盖调度器崩溃、独立 worker 存活的接管。worker 崩溃、提交窗口未知、并发恢复、模型派发、GUI 与创作验收未由本次验证证明，也不宣称整套规范完成。
