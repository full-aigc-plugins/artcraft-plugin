# 任务回执 / Task receipts

ArtCraft 工作流节点的 `status` 是调度摘要。实际登记与执行身份读取 `taskReceipt`：taskId、attemptId、state、runtimeIdentity、outputRefs、evidenceRefs 和 error。planned／ready 且 attemptId 为 null 不代表原生执行；review_ready 仅表示技术交付已核验，completed 需要交付验收。复用必须保留原 taskId／attemptId，不主动重新执行。

准备、登记或授权失败读取 `errorDetail.code` 与 message；现有字符串 error 保持兼容。未登记的节点不会提供伪造回执。账本中的持久失败以 taskReceipt.error 表达。未知结果或取消等待需要核对原任务的停止及交付证据，不能因收到拒绝或 waiting 就重放原生编辑。

Workflow node status is a scheduling summary. Read taskReceipt for durable task/attempt identity, state, runtime identity, output references, evidence references and error. Planned/ready with a null attempt does not mean native execution. Review-ready means technical verification; completion needs delivery acceptance. Reuse preserves the original identity.

Preparation, registration or authorization rejection supplies errorDetail code/message and retains the legacy error string. Unregistered nodes have no fabricated receipt. Durable failure stays in taskReceipt.error. Unknown results and cancellation waiting require reconciliation of the original task, never automatic native replay.

The independent skill pins runtime dev.122-runtime.1. Complete protocol, native creative and fixed full-plugin acceptance remain separate gates.

公开 workflow.py 的顶层失败也包含 errorDetail。输入／安装前置失败不伪造 workflowReceipt 或 taskReceipt；原生非零回执保留 workflowReceipt 和原 error 字符串，上游已有 errorDetail 则保留其 code/message，等待或其他未就绪回执以 workflow_not_ready 表达。读取嵌套节点 taskReceipt 判断实际状态，不能把 workflow_not_ready 当作任务失败或自动重试依据。

The public workflow.py launcher also returns top-level errorDetail. Input/setup refusal does not fabricate workflowReceipt or taskReceipt. Nonzero runtime replies retain workflowReceipt and the legacy error string; upstream structured rejection details are preserved, otherwise workflow_not_ready describes the envelope. Inspect nested durable receipts; this code does not declare task failure or authorize replay.

预算耗尽公开code为budget_exhausted，message与原CLI error保留budget_exceeded及具体维度。预算拒绝不新增attempt、不释放未知任务占用或授权重放，先查询原账本和产物。

Budget exhaustion exposes code budget_exhausted while message and legacy CLI error retain budget_exceeded and the dimension. Refusal does not create attempts, release unknown-task ownership or authorize replay; inspect the original ledger and artifacts.
