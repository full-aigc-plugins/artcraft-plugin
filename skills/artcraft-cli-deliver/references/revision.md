# 当前审阅驱动的受控修订

`scripts/revision.py step/status` 是本技能自带的辅助入口。每个独立技能都包含此脚本、审阅与打包入口和固定安装器；按当前实际加载的 SKILL.md 定位 SKILL_DIR。当前平台为 macOS arm64；首次调用按任务图安装需要的领域，状态查询不安装运行时。

## 输入与授权

先通过 `package.py create` 保存当前交付回执，再按 `review.py record` 保存真实具名观察。PACKAGE_SHA、REVIEW_SHA 都来自单独保存的回执。修订策略由用户任务范围确定，保存 JSON 后另存其文件 SHA，作为 POLICY_SHA；不能从陌生策略文件自行读取摘要并据此扩权。

策略结构如下，值按实际项目填写：

```json
{
  "schema": "craft-revision-policy/v1",
  "workflowId": "当前包的 workflow.workflowId",
  "ownerId": "local-user",
  "authorizationRef": "原已授权范围",
  "targetSha256": "已确认目标或 Brief 文件的 SHA-256",
  "maxRounds": 3,
  "maxStagnantRounds": 1,
  "allowedCommands": {
    "logo": ["paint.setFill"],
    "poster": ["layer.select", "layer.layerMask.hideAll", "asset.place"]
  }
}
```

策略冻结节点与命令范围，不是通用的参数权限系统。targetSha256 是调用者对目标身份的声明，入口不自动推断自然语言目标是否变化；修改目标时必须提交新的策略及授权，旧循环拒绝沿用。最大轮数与停滞阈值必须是 1–100 的整数。原工作流的预算、deadline、图、工具和输出约束由可信包继承，补丁不能修改它们。

## 补丁请求

请求只包含新 revision 和明确操作，不传入新工作流图、预算或任意可执行脚本：

```json
{
  "schema": "craft-revision-request/v1",
  "revision": "v2",
  "patches": [
    {
      "nodeId": "logo",
      "operations": [
        {"command": "paint.setFill", "params": {"ids": [{"$ref": "logo.ids.0"}, {"$ref": "wordmark.id"}], "color": "#d63b42"}}
      ]
    },
    {
      "nodeId": "poster",
      "operations": [
        {"command": "layer.select", "params": {"layer": {"$ref": "logo.layer"}}},
        {"command": "layer.layerMask.hideAll", "params": {}},
        {"command": "asset.place", "params": {"asset": "replacement", "center": [160, 210], "name": "Revised Logo"}}
      ],
      "assetBindings": [{"name": "replacement", "assetId": "logo-png"}]
    }
  ]
}
```

示例绑定来自 brand-campaign 示例，不能套用到其他工程。实际对象引用须来自保存工程的绑定。失败节点与传递依赖中的每个原生领域节点都必须提供补丁；未受影响节点不能添加补丁。修改 Logo 后显式替换海报／片头／视频依赖，避免从旧模板重建时丢失已有修改。可选外部技术验证节点沿用原计划并随输入变化重新验证。

协调器以当前包中的原生工程和摘要生成 sourceProject／expectedRevision，保留旧交付，移除创建文档操作并继承导出选项。未另行声明的上游素材绑定使用 retained 检查；已保存在源工程中的配音、产品图等不重复注入。

## 执行与继续

```bash
python3 -I -B "$SKILL_DIR/scripts/revision.py" step \
  --project "$PROJECT_ROOT" \
  --package "$PACKAGE_ROOT" --package-sha "$PACKAGE_SHA" \
  --review "$REVIEW_ROOT" --review-sha "$REVIEW_SHA" \
  --policy "$REVISION_POLICY" --policy-sha "$POLICY_SHA" \
  --request "$REVISION_REQUEST"

python3 -I -B "$SKILL_DIR/scripts/revision.py" status --project "$PROJECT_ROOT"
```

成功步骤自动执行公开 workflow.py 并打包新版本，返回 `review_required` 和新包回执。先核验、审阅这个新包，再提交下一步骤。不得以旧包审阅继续新步骤。技术和创作观察必须覆盖全部当前输出；缺项或 NOT_RUN 保持待审，不能自动修订。真实人工拒绝可以形成问题，人工接受保持独立记录。

## 停止、最佳包与恢复

- 策略轮数按提交步骤计数；共享预算仍由实际执行器限制，策略不会扩大原预算。
- 停滞指标是具名观察中声明的 FAIL 检查数量，不是自动审美评分。新审阅没有减少失败数量时累计停滞；达到阈值即停止。
- 保存技术通过且技术／创作观察完整的最低失败数包；同分保留较早版本。无符合者时保留首次工程完整性已核验的包锚。停止回执中的 bestVerification 分别报告 PASS、FAIL 或 NOT_RUN，不能把保存的历史锚当当前验证。
- 达到轮数、预算、停滞或已有接受记录后，循环保持 stopped，旧授权不自动重启。
- 相同步骤复用回执前重新核验输入审阅及已生成包，不重放原生修改或再次分配预算。
- 超时或公共回执缺失返回 `outcome_unknown`，阻止所有新步骤。先按 recovery.md 核对原任务；需要继续同一步骤时显式增加 `--resume`。恢复必须与冻结策略、原包、审阅、补丁和已保存计划一致，沿用原任务／版本身份。

循环状态写入当前项目 `.artcraft-revision-cycle.json`，每个提交前保存 pending，使用项目锁串行化并原子更新。计数与步骤记录不一致或 pending 计划被改动时拒绝。不要删除或手工重写状态来绕过停滞、预算或未知结果。

本入口执行明确补丁与声明的政策，补丁规划、实际视觉／音频观察和模型评价由调用者完成；不执行额外模型会话，不认证评价者身份，不提升任务账本为 completed。模型自动规划与完整创作接受仍有独立验收。

## 停止后的未解决问题

停止回执携带 `unresolvedIssues`，保存最近已核验审阅中的 FAIL 检查 ID、维度、对象／帧／区域目标、责任插件、运行身份、观察说明与证据摘要。`issueSource` 绑定该观察所属交付包、runKey 和审阅回执摘要。它可能与 `bestPackage` 属于不同版本，不能把最佳包的核验结果当作最新失败已经解决。

`issueEvidence: recorded_observation` 表示保存了观察快照，不表示重新执行模型或人工评价。旧日志没有该快照时返回 `NOT_RUN`，不能从空问题数组推断无问题。新的接受记录清除旧失败快照，但账本仍保持 `review_ready`，完整创作接受仍由独立审阅合同管理。
