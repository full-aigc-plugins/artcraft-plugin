# 任务回执 / Task receipts

ArtCraft 工作流节点的 `status` 是调度摘要。实际登记与执行身份读取 `taskReceipt`：taskId、attemptId、state、runtimeIdentity、outputRefs、evidenceRefs 和 error。planned／ready 且 attemptId 为 null 不代表原生执行；review_ready 仅表示技术交付已核验，completed 需要交付验收。复用必须保留原 taskId／attemptId，不主动重新执行。

准备、登记或授权失败读取 `errorDetail.code` 与 message；现有字符串 error 保持兼容。未登记的节点不会提供伪造回执。账本中的持久失败以 taskReceipt.error 表达。未知结果或取消等待需要核对原任务的停止及交付证据，不能因收到拒绝或 waiting 就重放原生编辑。

Workflow node status is a scheduling summary. Read taskReceipt for durable task/attempt identity, state, runtime identity, output references, evidence references and error. Planned/ready with a null attempt does not mean native execution. Review-ready means technical verification; completion needs delivery acceptance. Reuse preserves the original identity.

Preparation, registration or authorization rejection supplies errorDetail code/message and retains the legacy error string. Unregistered nodes have no fabricated receipt. Durable failure stays in taskReceipt.error. Unknown results and cancellation waiting require reconciliation of the original task, never automatic native replay.

The independent skill pins runtime dev.108. Complete protocol, native creative and fixed full-plugin acceptance remain separate gates.
