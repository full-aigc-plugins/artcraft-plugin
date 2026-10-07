# 混合业务场景 / Mixed business scenes

## 品牌图形＋海报＋动态片头＋宣传片

先确认品牌文字、颜色、字体、尺寸、帧率、配音和各交付物。按产物选择 VectorCraft、PhotoCraft、EffectCraft、FilmCraft；无需全部启用，按实际依赖登记工具。四类原生工程分别保存，ArtCraft 保留工作流、素材版本、子交付引用及验收结果。

Use the four domain tools according to deliverables and actual dependencies. Preserve each editable native project and the orchestration records. Tool availability is not evidence of successful creation.

本技能 `examples/segmented-hd-brand-campaign.json` 提供四领域、五节点技术模板：品牌图形、海报、动态片头、宣传片及独立图标。示例需要五秒 WAV 和 1920×1080 PNG 背景，片头为 1920×1080、24 fps、五秒。复制模板到工作目录并适配用户规格，保留安装副本；首次执行会按固定锁安装运行时和计划所需领域。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" \
  "$SKILL_DIR/examples/segmented-hd-brand-campaign.json" \
  --output /absolute/new-campaign \
  --authorization brand-campaign \
  --asset voice=/absolute/input/voice.wav \
  --asset background=/absolute/input/background.png
```

`--authorization` 应记录用户已授权任务的实际范围引用，示例字符串不自动授予权限。输出目录必须为新的绝对路径。高分辨率模板需核对磁盘和资源；小尺寸设计应主动调整计划，不能将缩小后的产物当作原规格交付。

## 依赖与素材交接

1. Vector 产生品牌资产，登记文件摘要、画板及格式，消费者引用明确导出。
2. Photo 与 Effect 根据已登记产物创作；避免仅凭相同文件名识别素材版本。
3. Film 接收片头完整序列检查点和配音；保留帧率、透明、序列所有帧与音频引用。
4. 验证每个子交付的原生工程、引用素材和输出，再汇总项目交付；缺失节点不能标记全项目成功。

Consult `workflow.md`, `domain-commands.md` and the local example payloads for actual contracts. Domain command lookup, workflow operations and DAG nodes are separate interfaces; do not interchange their JSON plans.

## 更换 Logo 与局部返工

读取既有运行账本、输入摘要与子交付，建立新 revision；只让改变输入的节点及其真实依赖失效。替换 Logo 应更新引用 Logo 的海报、片头和宣传片，无依赖的独立图标保持缓存。不得修改旧交付文件或账本来伪造版本；相同修订重复执行应核验并复用已完成工作。

验收比较：新 Logo 摘要与消费者引用一致；海报和片头目标像素确实改变；宣传片消费新片头；无关图标、配音及原交付保持摘要；各原生工程可重开；失败恢复不得重复提交未知状态的编辑。

Revisions invalidate changed nodes and their consumers, preserve independent assets, and retain prior deliveries. Inspect real dependency edges and content hashes; successful scheduling alone does not prove downstream visual updates.

## 验收边界

固定版本首次使用、代表混合返工与完整 GUI/命令/创作质量分别报告。该文档连接现有可执行模板，不新增逐命令验收证据。ArtCraft 不提供剪映适配。
