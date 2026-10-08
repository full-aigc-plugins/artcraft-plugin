# 预算协议首次使用

技能源85固定runtime 0.1.0-dev.113-runtime.1。安装器接受受限的-dev.N-runtime.N版本后缀，继续核验来源、压缩包与每个文件的SHA256，不接受任意后缀或路径。版本校验测试先失败，修复后8项通过。

单独复制artcraft-cli-execute到项目.agents/skills，未提供离线运行时，公开入口自动安装依赖。36.701秒完成原生Vector工程创建及两次修订额度拒绝；公开错误码为budget_exhausted，兼容消息保留budget_exceeded: revisions。8张账本表、原任务attempt与工程文件保持不变。源码回归155项，117通过38条件跳过。未证明固定插件113宿主安装、全部预算时序或完整V1。

```mermaid
flowchart LR
  S[Single skill] --> I[Verified public install]
  I --> N[Native Vector create]
  N --> R[Two revision refusals]
  R --> P[Ledger and native files preserved]
```

[Evidence](evidence/craft-budget-source-first-use-20261008.json).
