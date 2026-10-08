# 模式目录使用 / Mode catalogs

状态：候选源码；固定发行安装验收未完成。

在实际加载的技能目录调用自带 `scripts/domain_commands.py`。目录可以位于项目或用户的 `.agents/skills/<skill-name>`，也可以在插件内部；不要固定 `/mnt/skills/user`。以下命令中 `$ARTCRAFT_SKILL_DIR` 必须指向本次实际加载目录。

```sh
python3 -I -B "$ARTCRAFT_SKILL_DIR/scripts/domain_commands.py" list --domain photocraft --mode desktop --category paint
python3 -I -B "$ARTCRAFT_SKILL_DIR/scripts/domain_commands.py" describe filmcraft file.importImageSequence --mode desktop
python3 -I -B "$ARTCRAFT_SKILL_DIR/scripts/domain_commands.py" check photocraft PLAN.json --mode desktop
python3 -I -B "$ARTCRAFT_SKILL_DIR/scripts/domain_commands.py" run photocraft PLAN.json --mode desktop --output NEW_DIRECTORY
```

`list`／`describe` 不安装依赖；按 ID 前缀分类，也可用 `--filter` 查找。查询工具使用 `--tools`／`--tool`，工具查询不支持命令分类。`check` 只验证结构与目录成员，NOT_RUN 不代表原生执行通过。`run` 不覆盖已有目录。

| 模式 | Film | Effect | Photo | Vector |
|---|---:|---:|---:|---:|
| headless | 666 | 640 | 755 | 585 |
| bridge／desktop 记录 | 666 | 640 | 748 | 763（762个不同ID） |

必须先按所选模式查询完整参数说明；不可把 headless 参数用于桌面。Film 桌面 `file.importImageSequence` 不接受 headless目录中的 `frameRate` 参数；Photo桌面没有7个headless命令，缺失命令在安装前拒绝。目录说明不是完整参数 JSON Schema，实际参数合法性与当前上下文仍由原生工具验证。

Vector桌面重复的 `file.place` 对应引擎和UI两份不同参数描述，查询保留两个记录，描述该ID会拒绝歧义；整个desktop／bridge执行在安装前拒绝，直到完成无歧义路由设计和真实验收。不要挑选最后一个记录、删掉重复项或改用headless目录通过检查。新增UI记录也不代表在无文档或无人值守时必然可执行。

Art模式目录绑定源包／原生快照／桌面锁及二进制身份。实时目录与可信参数不一致会在编辑前拒绝；unknown不重放。命令回执保留基础领域目录摘要，外层回执另附模式目录摘要；它不代替DAG交付或逐命令验收。

English: Select the explicit mode before discovery, description, preflight and execution. Categories are ID prefixes. Desktop catalogs differ from headless. Queries preserve all records; Vector's conflicting duplicate ID currently prevents execution. Successful structure checks are not native acceptance. The public receipt binds both the base child catalog and Art's mode catalog; unknown edits are not replayed. Use the actual loaded skill directory, including granular `.agents/skills` or plugin installation.
