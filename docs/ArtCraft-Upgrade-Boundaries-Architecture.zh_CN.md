# ArtCraft 固定升级边界验收架构

任务4.6继续开放。本次新增的是固定插件130／独立源102／runtime129的公开入口边界证据，没有改变运行时或技能发行字节。

测试使用保留的真实schema1运行时构建数据库，再显式设置待验状态、租约或执行记录。通过宿主已安装的artcraft-use公开Python入口，执行24次调用：11次旧账本只读status、12次upgrade拒绝和1次不存在账本拒绝。12类边界包括planned、ready、running、reconciling、cancel_requested、verifying、未知任务状态、残留租约、prepared执行、未可信停止、高版本schema，以及实际目录写权限拒绝。快照失败使用操作系统权限拒绝，未替换生产方法。每次核验完整schema及所有表数据、既有快照和无半快照；64个固定宿主技能树重新核验通过。

这些状态是受控SQLite边界输入，不是12次原生任务执行。真实原生任务排空、迁移及旧版兼容复制件证据由[固定分发验收](ArtCraft-Runtime-Upgrade-Distribution-Architecture.zh_CN.md)单独持有。

```mermaid
flowchart LR
 A[保留schema1构造器] --> B[明确设置边界输入]
 B --> C[已发布技能102公开入口]
 C --> D[固定runtime129]
 D --> E[status只读 / upgrade明确拒绝]
 E --> F[全部表及schema相等]
 F --> G[既有快照保全 / 无半快照]
 G --> H[64安装树摘要复核]
```

[边界证据](evidence/fixed-upgrade-boundaries130-20261009.json)记录测试与原始回执摘要；原始调用参数和输出留在本地隔离验收目录，发布证据不包含个人绝对路径。测试脚本通过显式环境启用，普通CI仅发现并跳过该真实安装专项。

[14场景审计](evidence/runtime-upgrade-scenario-audit130-20261009.json)列出当前规范中的全部AC-RT-002命名场景及未完成核对。历史证据只作定位，须确认相关当前字节未变化且原证据覆盖对应条款后才能复用；有变化或证据不足时补验。该清单没有自动关闭场景。缺失原生命令schema、运行模式、并行安装与各历史分发边界仍需逐条完成覆盖审计。4.6不勾选，完整V1和其他平台均不宣称完成。

镜像矩阵的历史reference路径归属插件仓库，各行附不可变提交的完整URL。
