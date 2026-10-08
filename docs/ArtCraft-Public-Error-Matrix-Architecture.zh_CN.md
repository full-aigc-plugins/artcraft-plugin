# ArtCraft 公共错误消费矩阵

状态：候选实现、AC-CP-001 部分验收，2026-10-09。任务1.3保持开放。

此前子任务输出解析与持久任务错误仅保留 `capability_missing`，其余规范已定义的公开错误被折叠为 `native_execution_failed`；独立技能也将旧 `budget_exceeded` 原样用作公开错误码。这与既有公共协议不一致。

协议现在导出8个已知错误码。有界完整且仅含单一error字段的输出可报告这些码或旧预算别名；账本在核对进程组停止后保留公开身份，将旧别名归一为 `budget_exhausted`，仅持久化诊断码及输出摘要。其他领域错误继续作为 `native_execution_failed` 的诊断；冲突、重复字段、超限、不完整和未知报告保留原拒绝规则。

| 子任务报告 | 公开错误码 | 证据 |
|---|---|---|
| runtime_missing | runtime_missing | 四领域子进程矩阵 |
| capability_missing | capability_missing | 四领域子进程矩阵 |
| revision_conflict | revision_conflict | 四领域子进程矩阵 |
| idempotency_conflict | idempotency_conflict | 四领域子进程矩阵 |
| outcome_unknown | outcome_unknown | 子进程矩阵及四项真实原生保存后故障 |
| artifact_invalid | artifact_invalid | 四领域子进程矩阵 |
| budget_exhausted | budget_exhausted | 四领域子进程矩阵 |
| authorization_required | authorization_required | 四领域子进程矩阵 |
| budget_exceeded | budget_exhausted | 诊断保留旧码，技能30项本地及10项上游别名用例 |

```mermaid
flowchart LR
 A[子任务输出] --> B[有界完整单错误解析]
 B --> C[协议已知码或兼容别名]
 C --> D[核对进程组停止]
 D --> E[持久任务回执及诊断摘要]
 E --> F[重开与核对不重放]
 G[技能本地或上游拒绝] --> H[规范顶层 errorDetail]
 H --> I[保留原消息及上游回执]
```

36项真实OS子进程用例修复前32失败，已有4项capability用例通过；修复后加既有诊断测试共48项通过。这是四种插件身份通过Art解析器的受控进程测试，工作进程并非专业应用。逐项检查attempt、运行时身份、空产物、停止证明、按既有终态规则释放占用、核对后的预算／事件不变、账本重开、不重放及不持久化私有原文；不将失败变成功，不授予重试，不改变额度及退款规则。

十个独立技能目录执行120组主入口用例：各3种旧预算维度、9种上游错误。保留原error字符串及完整上游回执，顶层错误详情规范化，不伪造任务身份或重试。修复前40组别名用例失败，修复后全部通过。

另以固定 FilmCraft、EffectCraft、PhotoCraft、VectorCraft 原生二进制执行4项保存后回复故障。受控钩子在实际保存后破坏回复；候选Art核心公开 `outcome_unknown`，保留并重开原暂存工程，阻断下游，保持attempt和预算且不重放。运行时模块明确取当前源码，保留安装回执中runtime132标签仅为来源信息，不代表固定runtime132或runtime134验收。

完整源码回归：Node共652项，627通过／25条件跳过；技能Python共214项，162通过／52跳过。[机器证据](evidence/public-error-matrix-candidate-20261009.json)。

固定运行时／技能源／插件发行及安装复验仍未完成。四领域协议引用仍固定owner109，早于预算规范增量；本矩阵不更新外部引用，也不证明完整消费者兼容。1.3及完整V1继续开放。
