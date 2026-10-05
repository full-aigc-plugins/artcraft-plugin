# 原生品牌色板混合工作流

本技能携带 `examples/brand-token-campaign.json`，首次按图安装固定四领域依赖。VectorCraft 技能包锁定 dev.6，原生 CLI 保持 0.2.0；ArtCraft 编排运行时保持 dev.16。不是上游 ArtCraft 应用 CLI。

沿用当前实际加载的 `SKILL.md` 所在目录作为 `SKILL_DIR`：

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" \
  "$SKILL_DIR/examples/brand-token-campaign.json" \
  --output "$PROJECT_DIR" --authorization "$AUTHORIZATION" \
  --asset "voice=$VOICE_FILE"
```

输入 voice 为已存在音频文件；图形、海报、片头和短片是示例设计，独立 badge 没有品牌依赖。首先保存返回的 runKey、各节点 root、outputs 和 nativeProjectRef 摘要。首次运行得到 review_ready 表示等待审阅，不表示创意或人工验收通过。

## 基于原生图形工程修改品牌色

复制已执行的图为新 revision，保留原预算、授权和节点依赖。修改 logo 节点：

- expectedRevision 使用原 logo 输出的 nativeProjectRef.sha256。
- externalInputs 登记原 logo 输出 artifact 和实际 root；sourceProject.assetId 使用原输出 assetId。
- payload.plan 改为 swatch.edit，name 使用 `$ref: primary.name`，color 为新 RGB 色值。省略 exports 会核验并继承原图形计划清单。
- 其余节点沿用原计划。调度器依据输入版本更新 poster、intro、film，独立 badge 复用。

消费者在该示例中按原计划生成新的原生工程；不宣称会保留用户在这些消费者工程内另做、但没有纳入计划的手工编辑。保留这些编辑的任务应明确登记各源工程，并使用对应领域支持的局部修改操作。

旧交付和 voice 必须保持摘要不变；关联图形、海报、片头、成片需检查真实输出，而非仅任务 ID。重复相同 revision 应复用已有任务和预算。打包仍使用本技能自己的 package.py create/verify。

本案例只证明原生已登记 RGB 色板与显式 DAG 依赖，不推断模型自动设计、跨文件依赖发现、其他颜色模型、外部编辑器 token 保真、声音创意质量或人工创作接受。
