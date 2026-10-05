# Evidence and source register / 证据与来源登记

Date / 日期：2026-10-05。来源仅证明其明确覆盖范围；推断与目标设计不得混为已经实现。

| Source | Observation | Confidence / boundary |
| :--- | :--- | :--- |
| [Agent Plugins specification](https://agent-plugins.org/specification) | Portable plugin manifest, skills directory and MCP component boundaries | Primary specification; host installation still requires actual acceptance |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Proposal, delta specifications, design and implementation task workflow | Primary documentation; local CLI used: 1.13.1 |
| [FilmCraft](https://github.com/storytold/filmcraft/tree/v0.2.0) | Native editing application and CLI/MCP interface | Pinned release; no blanket feature acceptance |
| [EffectCraft](https://github.com/storytold/effectcraft/tree/v0.2.0) | Compositing application and automation interface | Pinned release; effect mappings need individual verification |
| [PhotoCraft](https://github.com/storytold/photocraft/tree/v0.2.0) | Layered image editing and native/PSD formats | Pinned release; no universal PSD fidelity claim |
| [VectorCraft](https://github.com/storytold/vectorcraft/tree/v0.2.0) | Vector documents, artboards and export automation | Pinned release; export semantics need fixtures |
| [ArtCraft](https://github.com/storytold/artcraft) | Spatial/visual composition and mixed-asset interaction reference | Reference only; does not prove the four apps are orchestrated |
| [ArtCraft Services](https://github.com/storytold/artcraft-services) | Provider routing, asynchronous jobs and result registration | Reference only; hosted API access not exercised |
| [ArtCraft license](https://github.com/storytold/artcraft/blob/main/LICENSE.md) | Restricted source and branding conditions | Independently implement; distribution gate checks licensing |
| [Video Factory](https://github.com/full-aigc-plugins/video-factory-plugin) | Existing ecosystem pattern for deterministic composition and receipts | Pattern reference; its tests are not this plugin's tests |
| [Blender plugin](https://github.com/full-aigc-plugins/blender-design-plugin) | Separate skill sources and runtime locks | Packaging pattern reference |
| [Jianying CLI](https://github.com/full-aigc-plugins/jianying-cli) | Separate deterministic native-editing runtime | Runtime-boundary reference |
| [Content Factory](https://github.com/full-aigc-plugins/content-factory-plugin) | Revision, stage and delivery boundary patterns | Not assumed to be a universal DAG scheduler |
| [Runtime baseline](runtime-baseline.json) | Locally observed official CLI identities and read-only MCP probes | macOS arm64 only; no host/native creative acceptance |

## Template adaptation / 模板适配

Used full-stack-doc 3.0.2: all ten product baseline documents, all seven V1 documents, plugin README, complete architecture with plugin and AI/Agent profiles. Both Chinese and English carry substantive content. Root architecture owns cross-version boundaries; detailed runtime architecture owns execution design; V1 architecture owns release deltas.

采用 full-stack-doc 3.0.2 的产品 10 件套、V1 7 件套、插件 README、完整架构及插件/Agent 剖面。交付说明按运维与验收需要组织；未创建不适用的 SaaS、多租户、商业双轨、移动端、RAG 数据库或自有 UI 模块三件套。没有虚构市场规模、价格、排期或性能结果。

## Evidence gaps / 未验证项

Business skills and the plugin runtime are planned. Cross-platform compatibility, GUI bridges, native-project round trips, render fidelity, host installation and mixed workflows are NOT_RUN. Each gap maps to the active OpenSpec task list; no implementation task is checked off by a documentation validator.
