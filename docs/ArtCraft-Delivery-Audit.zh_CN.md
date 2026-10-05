# 五插件交付核对

核对日期：2026-10-06。事实源仍为五个仓库各自的 establish-v1-plugin OpenSpec。本表按用户首版范围核对，不把原生样例通过或任务勾选当作整个插件完成。

| 插件与固定技能 | 已有实现及代表性证据 | 必须保留的交付物 | 当前边界 |
| --- | --- | --- | --- |
| FilmCraft dev.6 / 技能 dev.5，11 技能 | 素材检查导入、时间线裁切、音轨与字幕、重开、预览与成片、单镜头修订；中文字幕与真实系统语音输入另有验证 | .fcproj、引用素材、预览、成片 | [原生固定安装证据](evidence/codex-release18-native-20261006.json) 中 FilmCraft 身份与当前版本相同；中文证据见 FilmCraft 仓库；不提升声音质量或人工接受 |
| EffectCraft dev.7 / 技能 dev.6，13 技能 | 合成、分层、文字／图形动画、关键帧、支持的模糊效果和可编辑蒙版、透明 PNG、视频与定点文字修订 | .ecproj、依赖素材、渲染结果、参数／操作记录 | [领域场景证据](https://github.com/full-aigc-plugins/effectcraft-plugin/blob/main/docs/evidence/task-skill-first-use.json)；支持的效果范围不代表所有效果或复杂自动抠像 |
| PhotoCraft dev.6 / 技能 dev.5，12 技能 | 产品分层、蒙版、文字、尺寸变体、原生重开、PNG／PSD、局部改字与保护区域；实际单文字技能中文冷启动 | .pcraft、适用 PSD、平面导出 | [中文原生／PSD 证据](https://github.com/full-aigc-plugins/photocraft-plugin/blob/main/docs/evidence/chinese-text-first-use.json)；合成产品 fixture 不代表真实产品视觉质量 |
| VectorCraft dev.8 / 技能 dev.7，12 技能 | 路径、形状、布尔、文字、颜色、画板、可复用资产、SVG／PDF／PNG、全局品牌色和中文定点修订；新版全套 42 测试零跳过 | .vectorcraft、适用 SVG／PDF／PNG | [当前全原生回归](https://github.com/full-aigc-plugins/vectorcraft-plugin/blob/main/docs/evidence/dev7-full-native-suite.json)；字体报告不代表全系统字体目录，交换格式不代替原生 |
| ArtCraft dev.24 / 技能 dev.22，10 技能 | 明确 DAG、选择适配器、依赖指纹、恢复、预算、版本绑定、局部返工、独立节点复用和移动交付包；实际普通／中文默认模板冷启动均通过 | 项目清单、工作流／账本记录、子工程引用、技术／创作审阅状态 | [当前安装与模板验收](evidence/default-campaign-font-first-use.json)；自然语言模型规划、完整一致性审阅和外部旧插件的所有能力不由此证明 |

## 首次使用链路

1. 每项技能自带脚本、指南和必要模板；按实际 SKILL.md 所在目录执行，运行时缓存与技能目录分离。
2. [固定宿主安装](evidence/codex-release26-default-campaign-20261006.json) 发现全部 58 技能，零加载错误；实际产物操作后全部安装摘要不变。
3. 领域原生 CLI 与 ArtCraft 编排运行时已有公开固定制品，校验归档／文件／版本后安装。各证据明确全新缓存与缓存复用范围。
4. 实际通用 Skills CLI 项目级安装仍为 NOT_RUN；不能用手工独立复制、宿主安装或模拟子进程替代该门禁。工具缺失，先前隔离安装确认尚未收到。[待执行状态](evidence/independent-install-readiness.json)。
5. 新模型会话派发、桌面 GUI、人工创作接受和其他平台仍未验证。它们与 native/headless、宿主发现、静态校验分别记录。

## 仍需完成

- 实际执行固定源 Skills CLI 安装与安装后 58 原生版本核对。
- 通过正式模型派发和产品／创作验收门禁，保留当前范围之外的缺口；不自动扩大 supportedPluginHosts 或加入市场。
- 对五仓完整 OpenSpec 逐项补齐实现、故障与验收证据；现有未勾选任务保持未完成，不能用本表整体勾选或归档。

本轮实际修复了 dev.7 字体检查后普通与中文 ArtCraft 默认矢量模板的首次执行失败。发布 dev.24／技能 dev.22 后，两个实际安装的独立冷启动测试分别 2 项通过、57.177 和 57.973 秒。完整目标仍未完成。
