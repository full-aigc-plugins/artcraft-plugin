# ArtCraft 命令模式合同架构

候选实现把既有headless合同校验覆盖到独立命令的所有run模式。domain_commands.py在headless／bridge下包装commands.py，在自有desktop模式下包装desktop.py。DesktopSession在同一进程中加载原生MCP Session，因此拦截保持现有监听归属、令牌管理和停止清理。领域文件不修改。

```mermaid
flowchart TD
  A[独立run] --> B{显式模式}
  B -->|headless或bridge| C[领域命令]
  B -->|desktop| D[自有桌面生命周期]
  D --> C
  C --> E[Art原生会话校验器]
  E --> F[受信工具及完整命令目录]
  F -->|一致| G[请求的操作]
  F -->|不符| H[持续拒绝且不重放]
  H --> I[既有清理与失败收据]
```

EffectCraft bridge从单独锁定快照补充9项工具，核对领域、bridge模式、原生runtime和desktop binary身份；工具schema必须有效，且不得与基础快照重名。快照缺失、畸形、非对象或摘要非十六进制时，在入口及原生模块执行前拒绝。headless不继承bridge工具。三模式均执行完整命令目录校验和拒绝后不可恢复编辑的规则。

证据分层保留：四领域／三模式180项受控命令用例；26项bridge身份拒绝；合计220项边界目标测试；当前206项技能源回归（154通过／52条件跳过）、551项运行时回归（526通过／25条件跳过）、123项插件Python回归（112通过／11条件跳过）；候选核心结合固定133依赖的36项真实headless原生保存后故障。十个独立启动器与DAG内嵌字节一致。[候选证据](evidence/command-mode-candidate-20261009.json)。

夹具不能证明实际bridge／GUI或新的固定分发验收。桌面自动化再次在初始化时报kernel assets文件系统错误。任务4.6、5.3以及全部12项未完成任务保持开放。此前134／106发行附件保持原行为和证据范围。
