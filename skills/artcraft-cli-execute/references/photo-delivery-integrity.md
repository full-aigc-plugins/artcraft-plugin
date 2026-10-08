# 混合项目的 PhotoCraft 完整交付

本版本固定PhotoCraft技能源34与其公开ZIP摘要；runtime固定为0.1.0-dev.122-runtime.1，其他领域固定版本不变。只接受仓库名/或仓库名-精确版本/两种ZIP目录布局；带版本前缀还需匹配URL标签。压缩包与每个文件的SHA256、路径拒绝、无符号链接规则继续生效。

独立Photo工作流提供delivery.py只读入口。Art混合工作流在Photo子任务中自动使用该版本：生成的清单全部文件、素材与交换报告保持相互绑定；返工检查完整源包，另存原生工程及导出，发布前重新校验。Art自己的素材摘要和项目包校验继续独立执行。安装了宿主Photo插件不等于Art内部依赖升级，以本技能分发锁与实际installation-receipt.json为准。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" "$SKILL_DIR/examples/brand-campaign.json" --asset voice=/absolute/voice.wav --output /absolute/new-project --runtime-home /absolute/empty-runtime --authorization LOCAL_SCOPE
```

海报/封面修订从实际子任务输出中的原生引用和清单构造sourceProject与expectedRevision，使用新workflow revision；勿重建原文档。需求记录、预算与授权沿用实际项目。包移动后执行本技能package.py verify并提供创建回执SHA；更换同名预览、缺失素材、交换记录错配均拒绝，不能重写旧清单摘要伪装原验收有效。完整命令与参数说明仍由本技能的domain_commands.py提供。

This source pins Photo34 within Art rather than relying on a separately installed Photo plugin. Exact root/versioned ZIP layouts preserve archive and per-file verification. The Photo child validates complete source and new deliveries around native revisions; Art artifact/package validation remains independent. Native project, manifest, task revision and authorization must bind the same actual outputs. A passing integrity check does not prove complete immutable lineage, all PSD fidelity, human creative approval or full V1. External recorded manifest hashes are needed to detect coordinated replacement of a manifest and its files.
