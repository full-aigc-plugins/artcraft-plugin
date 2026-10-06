# ArtCraft 安装后截止时间验收

插件 dev.46／独立技能源 dev.34／运行时 dev.45。安装后的恢复技能单独复制到 `.agents/skills`，公开 bootstrap 从空运行目录安装 Node、ArtCraft 和选定的 EffectCraft，排除离线归档／缓存覆盖。之后工作流复用这个新运行目录；安装耗时明确不计入四秒执行期限。

两节点计划启动 1280×720、24 fps 原生渲染，合成时长足以保持任务运行。测试在期限前观察到实际 EffectCraft render，没有提交人工取消命令。到期后监督器终止进程组，记录 close 和确认组停止，再完成取消并释放占用；依赖消费者没有任务 ID，也没有原生启动。

账本仅记录一个任务、一次原生启动，不发布产物。attempt 和共享预算账户不变；同一冻结计划到期后重跑仍为已取消，不重放。原技能及副本字节保留，全部 58 项安装技能摘要符合固定宿主锁。

真实 1 项通过，用时 25.845 秒；技能源回归 66 项通过、16 项跳过。[证据](evidence/codex-artcraft46-deadline-first-use-20261006.json)。在独立技能源仓设置 `CRAFT_DEADLINE_FIRST_USE=1`、实际安装恢复目录 `CRAFT_INSTALLED_RECOVER_SKILL`，可选新证据文件 `CRAFT_DEADLINE_EVIDENCE`，执行 `python3 -B -m unittest discover -s tests -p test_deadline_first_use.py`。

合成时长用于取消夹具，不表示交付了小时级视频。只验证安装后的执行期限，不验证四秒内安装；未证明 worker 崩溃接管、模型／GUI 或创作接受。完整 AC-TX-003 任务 5.9 保持开放，只完成有界期限补充 5.15。
