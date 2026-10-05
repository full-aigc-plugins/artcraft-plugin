# Video Factory 成片验证交接

本技能 workflow.py 支持可选 Video Factory 节点；四领域新建/修订仍保持原合同。仅支持已安装 Video Factory 0.4.0 的公开 probe、validate-plan、evaluate；不执行其 run、accept 或云调用，不导入私有模块。

## 节点和首次使用

在已有品牌计划的 nodes 末尾追加依赖 film 的节点；assetId 使用 film 输出中真实声明的 ID。expected 为明确验收目标，不从实际文件探测后反填成总能通过的数值。

```json
{"id":"external-review","pluginId":"video-factory","dependsOn":["film"],"projectKey":"video-review","expectedRevision":null,"payload":{"schemaVersion":"craft-video-evaluation/v1","assetId":"film-video","expected":{"width":320,"height":180,"fps":12,"durationSeconds":1,"requireAudio":true}}}
```

上例 assetId 是字段示意，执行前核对实际 film 输出。仅一个输入，固定 MP4；报告原生工程为空，源 FilmCraft 工程由原 film 子节点保留。

```bash
python3 -I -B "$SKILL_DIR/scripts/workflow.py" "$PLAN" \
  --output "$PROJECT" --authorization "$AUTHORIZATION" \
  --asset "voice=$VOICE" \
  --video-factory-root "$VIDEO_FACTORY_ROOT" \
  --ffmpeg "$FFMPEG" --ffprobe "$FFPROBE"
```

Agent 从实际已加载的 Video Factory 插件确认 VIDEO_FACTORY_ROOT，再确定本机媒体工具绝对路径，不猜缓存目录或自行选择重复版本。未安装外部插件或缺工具时停止并说明前置；此入口自动安装 ArtCraft 固定 Node/运行时与四领域 CLI，不全局安装或升级 FFmpeg/外部插件。未选择外部节点时不登记外部工具。

注册公开 CLI、源文件、Node、FFmpeg 与 ffprobe 摘要，项目 registry 冻结该身份。工具变更需要明确的新修订，不能静默替换旧任务身份。未知结果沿用原任务恢复，不重放验证。

## 结果与范围

结果节点为 JSON 报告，包含输入摘要、原验收计划摘要与 Video Factory 原始 gates。缺少 Video Factory 渲染账本时 provenance 保持 NOT_RUN；ArtCraft 自身源血缘另行保留，不能伪造外部账本。CLI 退出零或 accepted 不算通过。必需 FAIL 拒绝技术交付；review 表示技术待审，仍需创作审核。

项目打包保存报告与原验收计划，源成片及原生工程保留在 film 子交付。验证不修改源视频或工程。此适配不覆盖 Video Factory 渲染、语义评审、剪映工程转换或其他外部插件。
