# ArtCraft 仓库规则

当前为文档与规格阶段，禁止把 planned、NOT_RUN 或 OpenSpec 通过写成产品可用。

- 行为规范唯一事实源：`openspec/changes/establish-v1-plugin/specs/`。实现与验证完成前不归档、不同步为已交付主规格。
- 中英文 README、产品文档、架构与技术方案同时维护，字段、ID、路径和版本一致。
- 技能源码属于独立 `artcraft-skills` 仓库；插件只接收已锁定的发布快照。当前该技能包尚未发布。
- 公共 craft-task/v1 与 craft-artifact/v1 由 artcraft-plugin 的 OpenSpec 持有；领域仓定义消费与映射。
- 根 plugin.json 是文档阶段的身份元数据；缺少运行时与技能时不得加入可安装市场。
- 不提交用户媒体、个人绝对路径、凭据、安装缓存、二进制或本地会话数据。
- 代码实施遵循失败用例、最小实现、目标回归、真实交付验收；未执行任务不得勾选。
- 保留用户修改；不绕过审查、权限、签名或发布门禁。新操作前检查 git status。
- 文档校验：`python3 scripts/validate_docs.py`；规范校验：`openspec validate establish-v1-plugin --strict --no-interactive`。
