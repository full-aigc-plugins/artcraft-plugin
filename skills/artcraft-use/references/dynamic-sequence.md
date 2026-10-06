# 动态透明序列混合指南

## 首次运行

使用本技能自带 `examples/dynamic-brand-campaign.json`：Vector Logo、Photo 分层海报、Effect 透明动画、Film 音画字幕成片与独立图标。需要已有一秒以上 PCM WAV 配音和 PNG 背景；不生成或购买素材。

```bash
: "${SKILL_DIR:?设置为本 SKILL.md 的实际目录}"
python3 -I -B "$SKILL_DIR/scripts/workflow.py" \
  "$SKILL_DIR/examples/dynamic-brand-campaign.json" \
  --output /absolute/path/dynamic-brand-project \
  --authorization dynamic-brand-authorized \
  --asset voice=/absolute/path/voice.wav \
  --asset background=/absolute/path/background.png
```

公开入口按任务图安装锁定 Node、Art runtime 和四领域技能源／CLI。技能可单独安装到 `.agents/skills` 或从插件加载，以实际目录为准。当前分发锁固定 Art runtime dev.64、Film 技能源 dev.9／native 0.2.0-craft.2、Effect 技能源 dev.8／native 0.2.0；版本与摘要从本技能 `scripts/distribution.lock.json` 及实际安装回执读取，不从上游主分支推断。

## 序列交接

Effect 导出只选择 `png-sequence`，公共输出为 `rgba-sequence/sequence.json`、`mediaType: application/vnd.craft.image-sequence+json`。描述 schema 是 `craft-image-sequence/v1`，帧数、RGBA8 尺寸、规范化帧率、倒数时间基、所有帧摘要和像素 Alpha 由实际文件核验。不要只交首帧、改成普通 JSON／PNG MIME 或将 MP4 当透明替代品。

Film 节点 `assetBindings` 绑定真实序列 assetId；公开适配器验证后传 `--sequence-asset`。背景放 V1，透明片头放 V2，已有配音放 A1；原生工程、全部序列帧、字幕、预览、成片及交换损失报告分别保留。RGBA 通道和技术通过不代表 ICC／视觉／创作保真。

## 替换、阻断与恢复

用新 revision 修改 Logo，引用上次 logo 输出的完整 root、artifact 和 nativeProjectRef.sha256；设置 sourceProject，领域 plan 去掉 document，只执行明确对象修改。对象 ID 取 manifest.bindings，不能猜测。原依赖图、无关节点、owner、authorization 与预算保持不变。海报、片头、成片按输入版本变化重建，独立图标复用旧 taskId；旧交付摘要不变。

如果选择直接修订 Film 源工程，传新序列并执行 `asset.import`、`clip.replaceFromBin`；clip ID 取首次 `timeline.place` 的 as 绑定。已有输入用 retained 前先证明摘要与原工程收集文件一致。类型化序列从完整收集目录读取，不能重新指向缺帧原路径。

中间帧损坏时先保留检查点；公开 workflow 返回非零退出和 JSON error，内含 blocked 回执。只恢复确证的原字节后重复同一冻结修订，核对 taskId 与预算不重扣。身份不明或副作用未知仍遵守本技能恢复合同，不自行删除缓存或重放。

使用本技能 `package.py create/verify` 打包并迁移核验；保存外部包摘要，检查每个原生工程及全部帧。技术 review_ready 之后仍需审核文字、音频、图形一致性与实际画面。
