# Candidate structural runtime-lock diagnostics

A valid JSON document can still be an invalid runtime lock. Before this fix, null/list roots, missing keys or wrong field types could escape as internal exceptions. A wrong binary-digest type could also reach directory creation/download before rejection. Public first-use entries then lacked the promised local recovery diagnostic.

## Candidate behavior

Four domain installers validate the runtime root object, artifact mapping, artifact/version types and selected-platform artifact object before filesystem changes. Selected artifacts require string URL, lowercase SHA-256 archive/binary digests and correctly typed optional version/provenance fields. A missing platform remains `unsupported_platform`; a present but malformed platform entry is `runtime_lock_invalid`. Existing release URL, archive extraction, digest, native version, receipt, bounded-download and preservation checks remain in force.

ArtCraft validates the Node lock root, schema and field types before platform/version checks or directory creation. Structural rejection is `node_lock_invalid`. Distribution-lock preflight is covered by the follow-up implementation and evidence below.

Errors use the existing JSON failure channel with the current skill's own absolute bootstrap path, requested runtime home and `automaticRetry=false`. They do not execute native commands, select siblings or overwrite a damaged installation. Successful installation followed by a native failure retains the existing native-error semantics.

```mermaid
flowchart TD
 U[Public bootstrap or CLI entry] --> J[Read own runtime or Node JSON lock]
 J --> S[Validate object and field shapes]
 S -->|Malformed| E[lock_invalid + own dependencySetup]
 E --> P[Preserve copied skill and absent/existing runtime]
 S -->|Valid| V[Existing platform and identity validation]
 V --> I[Existing pinned installation and integrity checks]
 I --> N[Native CLI call]
 N --> O[Actual native outcome]
```

## Evidence boundary

Tests first reproduced the missing behavior in all five source packages. Public subprocess tests then cover malformed roots/fields through bootstrap and CLI; 64 individual source-skill copies separately execute both entries against absent and pre-existing runtimes, totaling256 calls for null locks. Every copied skill and existing sentinel file remains unchanged. Normal-lock candidate native tests separately cover the four domain save/reopen/export/source revisions and Art mixed creation/revision/reuse/moved delivery.

Evidence: `docs/evidence/craft-candidate-lock-shape-diagnostics-20261007.json`. It binds script, skill and test hashes, RED observations and current candidate results. Source mirrors are synchronized across64 skills. The already published plugins still contain their earlier immutable snapshots: this source candidate is not fixed-release installed acceptance.

The existing OpenSpec `*-SK-003-SETUP-FAIL` scenario records the structural rejection boundary. No broad task is closed. Remaining work includes immutable source/plugin publication, fixed installed revalidation, generic Skills CLI actual installation, complete command/scenario and creative acceptance. Other platforms and production remain unverified.

## Distribution preflight candidate / 分发提前校验候选

Art source now validates distribution root/schema/version and all five bundle objects before install_node. Bundle filenames, URLs, digest/file maps, versions and archive-format fields are checked without filesystem writes or downloads. The same validator is reused by setup and direct bundle installation. Node-only setup remains independent of distribution. Two RED tests reproduced sixteen failures; two target tests and 109 source regressions now pass (34 opt-in skips). New bundled-domain normal-lock native acceptance and fixed installed publication remain open.

Art 源码现在在 install_node 前校验分发根对象、schema、版本和全部五个制品对象，无写目录或下载地校验文件名、URL、摘要／文件映射、版本及归档格式；setup 和直接制品安装复用同一校验。node-only 仍独立于分发锁。两项 RED 测试复现十六次失败；两项目标测试及109项源回归通过（34项显式环境测试跳过）。新领域捆绑正常锁原生验收及固定安装发行仍未完成。

[Evidence / 证据](evidence/artcraft-distribution-preflight-candidate-20261007.json).

## New fixed-domain candidate verification / 新固定领域候选验证

All ten Art skills reject null distribution locks through both public entries with absent and existing runtimes (40 calls), preserving skill and user files. The new published Film30, Effect31, Photo31 and Vector30 bundles pass the fresh online mixed workflow (3 tests, 134.389 seconds), including native creation, revision, reuse and moved delivery. Full source regression: 143 tests, 109 passed, 34 opt-in skips. Runtime83 bytes remain unchanged. Fixed installed plugin acceptance is still pending.

10 个 Art 技能以两个公开入口、缺失和已有运行时执行40次 null 分发锁检查，保留技能和用户文件。新发行 Film30、Effect31、Photo31、Vector30 在全新在线混合工作流中通过3项测试（134.389秒），覆盖原生创建、返工、复用和移动交付。完整源回归143项，109通过、34项显式环境测试跳过；Runtime83字节保持一致。固定插件安装验收仍待执行。
