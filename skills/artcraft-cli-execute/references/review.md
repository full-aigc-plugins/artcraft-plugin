# 当前交付的审阅记录

`scripts/review.py` 是技能内的公开辅助入口，原生 ArtCraft CLI 的命令目录保持不变。单独安装本技能即含本入口、安装器与验包器，不读取兄弟技能。支持当前 macOS arm64 运行时；首次调用通过固定发行包安装 Node 与 ArtCraft 编排包，不安装未使用领域工具。

## 信任与状态

工程完整性来自公开 `package.py verify`。技术、创作和接受来自**具名评价者已执行的观察**；输入中必须保存观察文件摘要。脚本核对引用与文件，不判断观察内容是否正确，不执行模型，也不代替用户审阅。不得把测试观察或模型声明写成人工接受。`accepted` 仅表示所提供的评价记录满足合同；账本状态仍为 `review_ready`。

每个当前子工程输出都必须有技术、创作和人工接受的 PASS 记录，才产生 `accepted` 记录。缺项或 NOT_RUN 是 `pending`；任一技术或创作 FAIL 是 `changes_requested`。技术 FAIL 不能被创作 PASS 覆盖。工程摘要失败直接拒绝记录。

## 输入 JSON

将 `review-input.json` 与实际观察文件放在同一目录。结构如下；实际绑定字段须来自当前验包回执，不能直接采用示例值：

```json
{
  "schema": "craft-review-input/v1",
  "packageSha256": "当前 create 回执的 sha256",
  "planSha256": "当前验包回执 workflow.planSha256",
  "ownerId": "local-user",
  "authorizationRef": "与包内 workflow.authorizationRef 一致",
  "brandReferences": [],
  "checks": []
}
```

`brandReferences` 每项为 `{nodeId, assetId, version, sha256}`，必须是当前包内子节点输出。品牌项目填入实际品牌参考；记录外部品牌参考前，先将其登记为项目资产。`checks` 每项必须有：

| 字段 | 合同 |
| --- | --- |
| id | 唯一、非空的检查 ID |
| dimension | technical、creative、acceptance |
| status | PASS、FAIL、NOT_RUN |
| evaluator | `{kind: human/tool/model, id, version}`；acceptance 的 PASS/FAIL 只能来自 human |
| target | `{nodeId, assetId, version, sha256}`；可另有 objectId、非负整数 frame、归一化 region |
| evidence | `{location, sha256}` 数组；相对输入目录普通文件，不允许逃逸或符号链接；PASS/FAIL 不得为空 |
| note | 实际观察与范围，不能仅写“已检查” |

`region` 是 `{x,y,width,height}`，范围在 `[0,1]` 且宽高为正。创作 FAIL 必须指明 objectId、frame 或 region 中至少一个，便于局部返工。系统根据节点补写责任插件和锁定运行身份。不会依据记录自动修改工程。

## 保存和重新核验

PACKAGE_SHA 必须来自此前单独保存的打包回执；REVIEW_SHA 来自本次记录回执。二者不能从待验证文件中自行读取作为信任锚。

```bash
python3 -I -B "$SKILL_DIR/scripts/review.py" record \
  --package "$PACKAGE_ROOT" --package-sha "$PACKAGE_SHA" \
  --input "$REVIEW_INPUT" --output "$REVIEW_ROOT"

python3 -I -B "$SKILL_DIR/scripts/review.py" verify \
  --package "$PACKAGE_ROOT" --package-sha "$PACKAGE_SHA" \
  --review "$REVIEW_ROOT" --review-sha "$REVIEW_SHA"
```

审阅目录必须位于交付包外，已有输出目录不会覆盖。记录保存原始输入、按摘要命名的观察证据、四类状态和责任绑定，可与交付包一起移动后核验。包或观察文件变化、旧版本引用、摘要错误均拒绝。替换 Logo 或重新导出后，使用新的交付包摘要重新审阅；旧记录仍可核验旧版本，但不能作为新版本验收。

输入 JSON 或单个观察文件上限 8 MiB，总复制文件上限 64 MiB。原始包与任务账本均不修改。自动修订次数、预算、停滞与目标变化控制仍属独立规范，不由本记录器宣称已实现。
