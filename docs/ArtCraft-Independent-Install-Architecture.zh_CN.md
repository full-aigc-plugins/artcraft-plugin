# 独立技能安装验收架构

## 1. 规范与边界

延续现有 OpenSpec AC-SK-002。插件安装、手动复制单技能与实际 Skills CLI 安装分别保留证据。当前仅完成验收脚本和计划／保护测试，Skills CLI 实际安装尚未执行；新工具安装需遵循工作区授权要求。本文不提升市场或宿主接受状态。

## 2. 两层安装

```mermaid
flowchart LR
 R[五套固定公开技能源] --> C[用户已安装的 Skills CLI]
 C --> S[隔离项目 .agents/skills]
 L[固定发行矩阵及技能摘要] --> V[核验全部 58 个目录]
 S --> V
 V --> P[各目录公开 cli.py]
 P --> B[首次安装固定领域 CLI 或编排运行时]
 B --> Q[原生版本探测与再次核验技能摘要]
```

Skills CLI 负责把技能文件放进项目目录；技能自己的 Python 入口负责安装原生 CLI／编排运行时。技能脚本以真实 SKILL.md 所在目录定位，不使用固定挂载路径，也不寻找兄弟技能。

## 3. 验收工具

`scripts/verify_independent_skill_install.py --plan` 只读取现有 host-acceptance.lock.json，生成五套固定技能源 GitHub tree URL 和安装参数。实际模式要求现成的 Node、Skills CLI 和 Python，缺失时拒绝，不下载工具。输出目录必须新建；不加 --global，不修改个人技能目录。安装使用明确 Codex 目标、copy 和 yes 参数。

安装后先核验 58 个目录的全部文件摘要，再从每个独立目录执行 `cli.py --runtime-home <隔离缓存> -- --version`。原生探测 PATH 限制为系统工具目录；文件摘要在执行后再次检查。失败或超时不产出成功回执，不自动重启流程，保留隔离目录用于定位。

## 4. 执行与状态

```bash
python3 -I -B scripts/verify_independent_skill_install.py --plan
python3 -I -B scripts/verify_independent_skill_install.py \
  --node <现有Node绝对路径> --cli <现有SkillsCLI的JS入口绝对路径> \
  --python <现有Python绝对路径> --output <新的隔离测试目录>
```

当前 npm 元数据为 skills@1.7.0，registry 完整性值记录在待执行证据中。工具授权后才执行安装；用户日常配置与全局目录不在本流程范围内。五项测试仅证明固定安装计划、工具缺失不创建目录、符号链接拒绝、错误原生版本拒绝和排除离线覆盖，不能证明 Skills CLI 实际安装或原生创作。

## 5. 已核对的外部合同

[官方 Skills CLI 文档](https://github.com/vercel-labs/skills) 给出项目级默认安装、按 skill／agent 选择、copy 与 yes 参数，以及 GitHub tree 源格式。核对日期：2026-10-06。README 当前分支与 npm 发行版仍需以真实运行结果确认一致，不能仅凭文档宣称通过。创作、模型派发与 GUI 验收继续使用各自证据。

## 6. 完整原生版本门禁

验收工具从每个摘要已核验的安装技能锁读取预期原生版本。退出码零但完整维护或预发布后缀不同，拒绝产出成功回执；通过后逐技能记录预期与实际版本。执行前移除继承的 CRAFT_RUNTIME_HOME、CRAFT_NODE_ARCHIVE、CRAFT_BUNDLE_DIRECTORY 和 CRAFT_NATIVE_ARCHIVE_DIRECTORY。修复前预期 craft.1 却接受 craft.10 的失败用例已复现；修复后五项单元测试通过。子进程均为模拟，因此实际公开 Skills CLI 安装仍为 NOT_RUN，任务 3.16 保持未完成。安装计划同步到当前 VectorCraft dev.7 与 ArtCraft dev.21 技能源。

## 原生身份验收

版本探测共用独立冷启动验收解析器：四领域 CLI 必须返回自身 `*-cli` 名称和完整锁定版本；ArtCraft 必须返回 `name=artcraft` 且 `version` 精确匹配的 JSON 对象。PhotoCraft 的构建信息仍受支持。退出码零、同号其他工具及包含预期版本的诊断文本均不能生成成功回执。

回归证据：[身份门禁](evidence/independent-install-identity-regression.json)。实际 Skills CLI 安装保持 NOT_RUN；重新解析历史输出仅证明兼容性。
