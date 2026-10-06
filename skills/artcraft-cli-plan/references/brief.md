# 版本化 Brief（开发中）

本技能自带 `scripts/brief.py`，仅使用 Python 标准库。它记录需求、检查声明计划，不安装运行时，也不替代原生和创作验收。

```bash
python3 -I -B "$SKILL_DIR/scripts/brief.py" create --input /absolute/brief.json --output /absolute/brief-v1
python3 -I -B "$SKILL_DIR/scripts/brief.py" assess --brief /absolute/brief-v1 --sha <回执sha256> --plan /absolute/plan.json --owner local-user --authorization authorized-scope
python3 -I -B "$SKILL_DIR/scripts/workflow.py" /absolute/plan.json --output /absolute/project --owner local-user --authorization authorized-scope --brief /absolute/brief-v1 --brief-sha <回执sha256>
```

`craft-brief/v1` 必须包含 workflowId、revision、ownerId、authorizationRef、budget、brand（可为空）、subjects、deliverables、dataPolicy 和 ambiguities。每项交付填写 id、nativeFormat、width、height、dependsOn、execution；按需填写 frameRate（num/den）和 durationSeconds。品牌包含 name、colors、fonts、appliesTo、referenceAssets；主体包含 id、role、description、appliesTo、referenceAssets；歧义包含 id、question、affects。参考素材只使用 assetId/version/sha256，必须对应真实登记输入。

create 保留原始输入、规范化需求与摘要清单，拒绝覆盖。verify 移动后重新检查清单、输入及文件摘要，并拒绝符号链接。assess 报告阻塞节点及受影响消费者，同时列出独立节点的检查结果；报告 ready 仅表示声明计划符合约束。

Python 工作流在安装前执行检查，将规范化需求存入冻结计划的 projectBrief。已有无 Brief 计划仍可使用。同一工作流修订改变 Brief 会被拒绝，需另建计划修订；旧工程保持原样。当前源工程修改缺少显式 document 时返回 source_inspection_required；云节点无执行器时阻塞，不用本地工具静默代替。

Node 源实现已完成等价校验与按节点约束计算复用指纹，并通过复用本机领域 CLI 的原生工作流及移动交付包验证。源技能以分发锁固定运行时与领域技能源版本，最新验收见对应发布记录。源工程 Brief 元数据检查、完整时长判断及创作接受仍独立验收。
