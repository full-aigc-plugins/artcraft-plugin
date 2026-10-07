# Craft桌面首次使用闭环

当前四个技能安装锁只包含CLI；完整命令入口的bridge模式要求已有运行中的桌面应用。这与“单技能首次安装即可完成GUI命令使用”之间存在缺口。headless原生创作验收保留，不用它证明桌面命令验收。

```mermaid
flowchart LR
    A[当前技能首次使用] --> B[固定CLI安装]
    B --> C{操作是否依赖GUI}
    C -->|否| D[现有headless工作流]
    C -->|是| E[缺少桌面安装与启动闭环]
    E --> F[固定官方DMG与隔离应用]
    F --> G[本地bridge及真实MCP UI工具]
    G --> H[原生编辑与保存重开验收]
```

已验证四个官方v0.2.0 DMG的GitHub制品摘要、实际下载摘要、版本、隔离.app副本、arm64 Mach-O和codesign严格检查。没有覆盖用户已有应用，也没有移除安全属性。Film桌面以独立数据目录、--control、--empty、--no-recover启动；CLI0.2.0-craft.2查询到666条实际目录，真实MCP ui_inspect与ui_elements通过，测试进程已退出。普通exec不接受ui.inspect；这是调用接口差异，不能归因于GUI不兼容。

其余三工具尚未验证live bridge；四工具尚未实现单技能桌面安装入口。后续bootstrap需要校验固定URL/制品摘要、用户自有或隔离应用路径、原生版本和二进制身份；启动使用独立数据目录，显式本地控制地址，不能绕过系统安全控制或盲目切换会话。command_run与UI工具属于不同接口，不得把UI工具伪装成领域命令。

沿用各插件OpenSpec PC/FC/EC/VC-CM-001；8.16实施单技能桌面闭环、8.17固定发布安装复验。8.3全量逐命令GUI/输出门禁保持开放。本轮PASS仅指下载安装及一个live bridge调查，不证明全部命令、GUI编辑保存重开或完整V1。
