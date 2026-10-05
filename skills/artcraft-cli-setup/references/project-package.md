# 项目交付包 / Project delivery package

开发版本 5 的 `scripts/package.py` 通过锁定安装器调用公开 ArtCraft package / verify-package CLI，不依赖全局 Node，也不执行编辑或渲染。

```bash
python3 /mnt/skills/user/artcraft-cli-setup/scripts/package.py create \
  --project /absolute/path/brand-project \
  --workflow WORKFLOW_RUN_KEY \
  --output /absolute/path/brand-delivery \
  --authorization brand-project-authorized

python3 /mnt/skills/user/artcraft-cli-setup/scripts/package.py verify \
  --package /absolute/path/moved-brand-delivery \
  --sha MANIFEST_SHA256_FROM_PACKAGE_RECEIPT
```

使用工作流结果中的 runKey；owner 和 authorization 必须与账本一致。自定义运行时目录加 --runtime-home。create 的 JSON 回执提供 sha256，需单独保存或传给验包，不能从可能被修改的包自身推导信任。已有输出目录拒绝覆盖，未核验任务、活跃工程写入、授权冲突、源摘要变动、路径外逃或缺依赖都会拒绝发布。

Use runKey from the workflow result, with its original owner and authorization. Add --runtime-home for a custom runtime directory. The create receipt provides sha256: retain it independently and pass it to verification. Existing directories are never overwritten; unfinished tasks, active writers, unauthorized scope, source changes, escaping paths or missing dependencies reject publication.

| 文件 / File | 用途 / Purpose |
| :--- | :--- |
| project.json | 相对路径、子任务、原生引用、所有收集文件的摘要与字节数 / Relative index, child tasks, native references and file digests |
| children/* | 各领域 manifest 声明的全部工程、素材、预览和导出 / All files declared by domain manifests |
| inputs/* | 登记外部素材及旧源交付 / Registered external assets and historical source deliveries |
| workflow-plan.json | 原始冻结执行计划，保留历史路径和摘要 / Original executed plan, preserving historical paths and digest |
| workflow-plan-portable.json | 外部输入改为包内相对路径的版本，不伪称与原计划摘要相同 / Relative input index, with its own digest |
| workflow-record.json | 子任务回执、请求绑定、事件、执行终止与预算快照 / Child receipts, request bindings, events, execution stops and budget snapshot |

验包核对清单摘要、所有文件与原生引用，并拒绝清单外文件和链接；返回的 children.root 是当前移动目录下的实际路径，可登记为 sourceProject 输入。原生文件内部的旧素材路径通过对应领域技能 --source 再打开和重关联。先使用验包返回的真实 root / artifact，不将相对计划直接作为可执行计划。

Verification checks the manifest digest, every file and native reference, rejecting unlisted files and symlinks. Returned children.root values resolve under the current package location and can be registered as sourceProject inputs. Reopen through each domain skill's public source interface to relink internal native media paths. Use verified root/artifact values rather than executing the relative index directly.

打包后状态仍为 review_ready，仅代表技术待审，不提升为创作通过。包不是运行时安装包，也不复制活跃 SQLite 账本或建立新预算授权。跨机器字体、效果与授权环境仍需按领域能力检查；交换损失报告仅保留已经生成的真实证据，不凭打包自动推定无损。

Packaging retains review_ready, without creative approval. It is a delivery bundle rather than an installed runtime or live SQLite database, and creates no new budget authorization. Domain capability checks remain necessary for fonts, effects and environment differences; existing exchange-loss evidence is retained, never inferred as lossless by packaging.
