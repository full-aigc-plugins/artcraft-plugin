# ArtCraft 失败暂存集成架构

> 集成设计；固定 Art77／源52／runtime76 仍内置旧领域客户端。更新：2026-10-07。

## 事实源与当前状态

增量分发升级由 OpenSpec AC-RT-002 任务4.9持有。独立领域插件 Film18、Effect／Photo／Vector17，以 Film技能源16、其他领域15修复原暂存保留。Art77源52仍固定 Film15、其他领域14。安装新的独立领域插件不会改变 Art77 自行下载的技能源捆绑包。

```mermaid
flowchart LR
    D[独立领域源16/15] --> P[领域插件18/17]
    D --> U[待实施的不可变 Art 分发升级]
    U --> H[绑定恢复模块身份]
    H --> T[安装后混合与故障验收]
    O[现有 Art77 领域包15/14] --> E[既有版本绑定证据]
```

## 必须实施与验收的内容

重建并发布新的不可变 Art 运行时／技能源／插件，保留旧锁。新增 preserved_stage.py 必须绑定受信适配器文件、能力快照及 launcher 身份。通过公开适配器与账本测试真实保存后响应未知：保留产品原暂存和依赖摘要、关闭进程、阻止消费者、保留 attempt／预算并禁止重放。测试代理捕获副本不能证明产品保全。

验证十个 Art 技能各自冷安装、四领域健康混合创作／返工／恢复／移动包、固定标签宿主发现及全部58项安装摘要。领域固定证据只是前置条件，不能关闭 Art4.9。全量命令、GUI、模型及完整 V1 验收仍独立开放。


## 本轮候选实现与身份

运行时 dev.78 已发布，强制要求包含 `preserved_stage.py` 的六文件身份。缺失恢复代码时配置失败；摘要变化时拒绝启动。技能源 dev.53 固定 Film16 与 Effect／Photo／Vector15 的不可变完整 Git ZIP，十项技能各自携带分发锁。安装能力快照与 launcherIdentity 同时绑定恢复模块摘要。运行时与四领域包已经从固定标签重建。

```mermaid
sequenceDiagram
    participant S as 技能安装器
    participant A as 可信适配器
    participant N as 原生 CLI
    participant P as 原始暂存工程
    participant L as 任务账本
    S->>A: 六文件摘要与能力快照
    A->>N: 已授权的有界计划
    N->>P: 保存原生工程
    N--xA: 保存响应未知
    A->>P: 保留文件与 failure.json
    A->>L: 失败回执、阻断下游、不重放
    L-->>S: 查询原 attempt
```

保存后故障驱动已改为重新打开产品保留的原始工程，核验全部保留文件摘要与字节数、submitted 调用记录、不存在成功 manifest，验证不会发生第二次 prepare／save。代理副本仅作为独立摘要见证。固定宿主、十技能冷安装与混合返工／恢复实际通过前，4.9 仍开放。
