# ArtCraft 仓库规则

当前为实施阶段，禁止把 planned、NOT_RUN 或 OpenSpec 通过写成产品可用。

- 行为规范唯一事实源：`openspec/changes/establish-v1-plugin/specs/`。实现与验证完成前不归档、不同步为已交付主规格。
- 中英文 README、产品文档、架构与技术方案同时维护，字段、ID、路径和版本一致。
- 技能源码属于独立 `artcraft-skills` 仓库；插件只接收已锁定的发布快照。开发标签 v0.1.0-dev.1 已发布；内容以 skills.lock.json 校验。
- 公共 craft-task/v1 与 craft-artifact/v1 由 artcraft-plugin 的 OpenSpec 持有；领域仓定义消费与映射。
- 根 plugin.json 包含开发版身份与界面元数据；宿主验收完成前不得加入可安装市场。
- 不提交用户媒体、个人绝对路径、凭据、安装缓存、二进制或本地会话数据。
- 代码实施遵循失败用例、最小实现、目标回归、真实交付验收；未执行任务不得勾选。
- 保留用户修改；不绕过审查、权限、签名或发布门禁。新操作前检查 git status。
- 文档校验：`python3 scripts/validate_docs.py`；规范校验：`openspec validate establish-v1-plugin --strict --no-interactive`。

<!-- partme-agent-plugin-policy:v1 -->
## Partme Agent Plugin Architecture Rules v1

- 组织级架构规范（唯一事实源）：[Partme Agent Plugin Architecture Rules v1](https://github.com/full-aigc-plugins/.github/blob/main/docs/standards/partme-agent-plugin-architecture-rules-v1.md)。
- **Harness 可选**：默认直接使用 Skills + CLI/MCP；只有确有必要时才保留最多一个可发现的 `skills/*-harness/SKILL.md`，其 `scripts/harness.py` 也可选。
- 不复制宿主 Agent Runtime 或已有 CLI/MCP 的业务执行、任务数据库与权威状态；代码能力必须能追踪到真实 Agent → Skill/Command → Tool → 结果的调用链。
- 保留本仓库现有 OpenSpec、安全门禁、发布及验证要求。静态校验不代表真实宿主可执行性；所有上线宣称均需实际宿主验收。
- CI 统一使用组织级 [Partme Plugin Architecture 检查器](https://github.com/full-aigc-plugins/.github/blob/main/scripts/check_plugin_architecture.py)，不得复制实现或禁用检查。
<!-- /partme-agent-plugin-policy:v1 -->
