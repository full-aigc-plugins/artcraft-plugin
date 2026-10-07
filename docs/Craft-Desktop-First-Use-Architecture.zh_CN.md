当前固定版本：四领域插件dev.24／技能源dev.22，Art插件dev.90／技能源dev.63／runtime83。58个单技能空运行时、四领域进阶桌面和品牌混合返工已通过。[绑定版本、技能与原生制品摘要的记录](evidence/craft-full-command-fixed-first-use-20261007.json)。下文较早的版本表和验收记录保留各自历史范围；不代表逐条命令、全部UI交互、模型调度或完整V1通过。

# Craft 桌面首次使用架构

> 2026-10-07。范围：四领域独立技能的桌面安装组件；候选源码实现，固定技能发布及 GUI 完整验收仍开放。

## 1. 入口与边界

四领域共 48 个技能均自带 `scripts/desktop.py`、`scripts/desktop.lock.json` 和 `references/desktop-install.md`。无需安装兄弟技能。设置 `SKILL_DIR` 为当前技能真实加载目录，然后执行：

```bash
python3 -I -B "$SKILL_DIR/scripts/desktop.py" install
```

返回实际应用路径、可执行文件路径、版本、二进制摘要和 `reused`。macOS arm64 桌面应用固定为官方 v0.2.0；维护 CLI 与桌面分别锁定，不能把相同版本号当作兼容性证明。默认缓存为用户数据目录下 `craft-runtimes/<domain>-desktop/<version>`；可用 `--runtime-home` 指定隔离目录。

ArtCraft 的编排技能沿用子领域技能安装回执；本次没有增加 ArtCraft GUI 调度接口，也没有增加剪映适配。

## 2. 安装过程与失败恢复

```mermaid
flowchart TD
    A[当前独立技能] --> B[校验领域 官方URL 平台与制品锁]
    B --> C[取得领域安装文件锁]
    C --> D{版本缓存存在}
    D -->|是| E[复核应用身份 签名与完整文件树]
    E -->|有效| F[返回 reused=true]
    E -->|损坏| G[拒绝安装 保留现有应用]
    D -->|否| H[私有临时目录下载DMG]
    H --> I[校验字节数与SHA256]
    I --> J[只读挂载 复制唯一应用]
    J --> K[核验版本 ID 二进制 架构 签名 内部链接]
    K --> L[生成安装树回执 原子发布]
    L --> M[返回应用身份 reused=false]
```

安装只下载锁定官方制品。`--archive` 可提供本地 DMG，但仍须匹配完整锁，不能绕过验证。对安装树中的文件、链接及回执进行复核；损坏版本不静默覆盖。跨进程共享缓存通过文件锁串行发布；失败只清理本次拥有的临时目录，卸载本次挂载点，不发布半成品。安装不修改 PATH、不覆盖 Applications 中的用户应用、不移除安全属性，也不启动应用。

## 3. 验证与后续门禁

`tests/test_desktop_install.py` 包含锁契约、错误官方 URL、错误平台不创建缓存、错误制品不发布版本测试。原生首次安装测试必须显式设置 `CRAFT_DESKTOP_FIRST_USE=1`，普通回归不会下载应用。每个原生案例只复制一个技能到 `.agents/skills`，以空缓存下载官方 DMG，验证重复安装不改变应用、损坏回执被拒绝且技能资源不变。

48 个源码技能测试的通过数量以 `docs/evidence/craft-desktop-source48-first-use-20261007.json` 为准；没有该报告或报告未通过时，不能声称批量通过。此证据不等于已发布技能安装验收。

已有调查验证四个官方 DMG，并验证 Film 的真实 MCP `ui_inspect`、`ui_elements` 和 666 条 live 目录。Effect 已通过独立 `EFFECTCRAFT_CONFIG_DIR`、签名桌面启动、固定 CLI bridge、640 条实际目录和真实 MCP `ui_inspect` 验证；测试应用已退出。Photo 与 Vector 的真实 bridge 已完成后续验证，见第 4 节；单技能自动启动仍待实施。UI MCP 工具与领域 `command_run` 接口不同，不能使用 `exec ui.inspect` 替代。`commands.py --mode bridge` 连接明确的活动会话，不自动启动或切换桌面。

沿用四领域 OpenSpec 的 8.16、8.17：源码自动启动及代表性保存重开已通过第 5 节验收；固定发布首用及完整 GUI 创作任务尚未完成；8.3 全量命令执行门禁开放。2639 条目录覆盖不代表 2639 条命令全部运行通过。

## 4. 四领域 live bridge 与 Vector 修复

[四领域运行证据](evidence/craft-four-desktop-live-bridge-20261007.json)记录签名桌面与固定 CLI 的真实连接。Photo 的认证 token 使用权限为 0600 的私有文件，测试结束删除；配置和读写根均隔离。Vector 使用 `VECTORCRAFT_NO_PREFS` 禁用偏好和恢复，测试仅操作隔离工程。所有测试拥有的应用进程均已退出。

| 领域 | GUI 检查工具 | CLI 连接 | 实际目录 |
| :--- | :--- | :--- | :--- |
| Film | `ui_inspect` | `mcp --bridge 127.0.0.1:PORT` | 666 |
| Effect | `ui_inspect` | `mcp --bridge PORT` | 640 |
| Photo | `ui_inspect` | `mcp --bridge 127.0.0.1:PORT`，token 文件及读写根 | 748 |
| Vector | `inspect_ui` | `mcp --connect 127.0.0.1:PORT` | 763 行；585 个反射命令需要一项明确别名映射 |

Vector 候选源码 bridge 模式把 `file.export` 映射到原生 `document.export`，并在回执同时保留 `command` 与 `backendCommand`。实时 enabled 检查使用实际命令，不绕过上下文。官方目录的 `file.place` 有引擎/UI 两个变体，只为这个已验证的组合选用引擎行；其他重复或缺失命令继续拒绝。headless 的别名和唯一性合同不变。

真实桌面案例完成新建、矩形、SVG 导出、原生保存、重开、检查六步；重开后的矩形仍为 x/y=8/8、宽高=24/24，工程无未保存修改，SVG 为有效 XML。Vector 回归通过 80 项，24 项环境测试跳过。这证明该案例及候选源码修复，不证明固定发布版已包含修复或全命令执行完成。单技能自动启动与生命周期管理已完成第 5 节源码验收，固定发布版仍待复验。

## 5. 独立技能自动启动与退出

48 个领域技能现均提供自有 `desktop_session.py`、`desktop.py run` 入口与 `examples/desktop-first-use.json`。设置当前技能真实目录 SKILL_DIR，执行：

```bash
python3 -I -B "$SKILL_DIR/scripts/desktop.py" run "$SKILL_DIR/examples/desktop-first-use.json" --output "$OUTPUT"
```

OUTPUT 必须尚不存在且父目录已存在；可用 `--runtime-home` 选择隔离缓存和 `--input NAME=PATH` 导入素材。结构、命令、引用、输入文件和平台先校验，然后由同一工作流安装固定桌面与 CLI。应用配置隔离在输出目录中，本地 listener 必须经 lsof 确认属于本次应用 PID 才连接 MCP。Photo 使用私有 0600 token 文件，GUI/CLI 读写根相同。工作流结束或失败，只关闭本次应用及 MCP；未知编辑不重试。

```mermaid
sequenceDiagram
    participant S as 当前独立技能
    participant I as 固定安装器
    participant G as 本次桌面进程
    participant C as 领域CLI MCP
    participant O as 输出与回执
    S->>S: 校验计划与新输出目录
    S->>I: 安装并核验桌面和CLI
    S->>G: 独立配置与控制端口启动
    S->>G: 核验本次PID拥有loopback listener
    S->>C: 连接明确的本次bridge
    C->>G: 实时前置检查与命令调用
    G->>O: 原生保存 导出 重开
    S->>C: 关闭本次MCP
    S->>G: 关闭本次桌面
    S->>O: desktop-session.json与命令回执
```

[48 技能源码冷启动证据](evidence/craft-owned-desktop-first-use-20261007.json)证明：每次仅复制一个技能到 .agents/skills、空公共缓存安装两类运行时、PID 归属检查、GUI 工作流、原生保存重开、技能文件不变和拥有的进程退出。各案例 5 步，Vector 为 6 步并验证导出别名。四领域回归通过 357 项，跳过 109 项环境依赖测试。规格 8.16 的源码组件已验证；8.17 固定发布安装、8.3 全量命令执行、Art GUI 编排及完整 V1 仍开放。

## 反射目录与运行时额外命令

PhotoCraft 的反射目录为748项，固定CLI实际注册755项；另外7项列在下方。原748项使用command字段。额外注册项可使用本技能已有的原生MCP工具command_list和command_run调用，不把它们冒充反射目录条目。先查询当前参数和enabled状态，建立工程、对象或画笔预设等前置条件，再调用；逐项原生执行验收仍为NOT_RUN。

```bash
python3 -I -B "$SKILL_DIR/scripts/domain_commands.py" describe photocraft command_run --tool
```

```json
{
  "schema": "craft-command-plan/v1",
  "operations": [
    {
      "tool": "command_list",
      "params": {
        "filter": "brush.presets"
      }
    }
  ]
}
```

上例仅查询，不执行预设修改。真实调用格式为`{"tool":"command_run","params":{"id":"真实命令ID","params":{原生命令参数}}}`；其中“真实命令ID”和“原生命令参数”必须替换，不能直接执行这个结构示意。沿用desktop计划入口以及逐步日志、失败停止和unknown不重放语义。

### brush.presets.rename

Rename Brush

```text
{"name":string,"newName":string} → {name}
```

### brush.presets.move

Move Brush

```text
{"name":string,"group":string?=its group ("" = ungrouped),"before":name? (preset to land before) | "index":n? (position in the group)=end} → {name, group, index}
```

### brush.presets.moveGroup

Move Brush Group

```text
{"group":string,"before":group? | "index":n? (group position)=end} → {group, index}
```

### brush.presets.renameGroup

Rename Brush Group

```text
{"group":string,"newName":string} → {group}
```

### brush.presets.deleteGroup

Delete Brush Group

```text
{"group":string} → {deleted, count}
```

### layer.setExpanded

Expand/Collapse Group

```text
{"layer":id?,"expanded":bool?,"all":bool?} (no expanded: toggle; all: every group; not an undo step)
```

### layer.setEffectsExpanded

Expand/Collapse Effects

```text
{"layer":id?,"expanded":bool?,"all":bool?} (no expanded: toggle; all: every layer with effects; view state, not an undo step)
```
