# Five-Plugin Delivery Audit

Checked 2026-10-06 against each repository's establish-v1-plugin OpenSpec and the user's first-release scope. Representative native tests and checked tasks do not establish complete product acceptance.

| Frozen plugin / skills | Implemented representative coverage | Preserved delivery | Boundary |
| --- | --- | --- | --- |
| FilmCraft dev.6 / dev.5, 11 skills | Media import, trimming/timeline, audio/subtitles, reopen, preview/export and one-shot revision; separate Chinese/system-voice evidence | .fcproj, referenced media, preview and film | [Installed native evidence](evidence/codex-release18-native-20261006.json) has the unchanged current FilmCraft identity; no narration-quality or human approval claim |
| EffectCraft dev.7 / dev.6, 13 skills | Composition/layers, text and graphics animation, keyframes, supported blur/masks, transparent PNG/video and targeted text revision | .ecproj, dependencies, renders and parameters/operations | [Domain scenes](https://github.com/full-aigc-plugins/effectcraft-plugin/blob/main/docs/evidence/task-skill-first-use.json); not all effects or complex automatic rotoscoping |
| PhotoCraft dev.6 / dev.5, 12 skills | Product layers, masks, text, size variants, native reopen, PNG/PSD, protected revisions and installed Chinese cold-start text | .pcraft, applicable PSD and flat exports | [Chinese native/PSD evidence](https://github.com/full-aigc-plugins/photocraft-plugin/blob/main/docs/evidence/chinese-text-first-use.json); synthetic product pixels are not real photography acceptance |
| VectorCraft dev.8 / dev.7, 12 skills | Paths/shapes/booleans, text/colors/artboards, reusable assets, SVG/PDF/PNG, global colors and targeted Chinese edits; 42 native-suite tests pass without skips | .vectorcraft and applicable SVG/PDF/PNG | [Current full native regression](https://github.com/full-aigc-plugins/vectorcraft-plugin/blob/main/docs/evidence/dev7-full-native-suite.json); loaded-font availability is not full OS inventory; interchange does not replace native |
| ArtCraft dev.24 / dev.22, 10 skills | Explicit DAG, adapters, dependency fingerprints, recovery/budget/version binding, selective rework, unrelated reuse and moved package; installed ordinary/Chinese defaults pass cold start | Project manifest, workflow/ledger, child references and technical/creative review states | [Current installed templates](evidence/default-campaign-font-first-use.json); not natural-language model planning, complete creative consistency or every external legacy-plugin feature |

## First-use chain

1. Each skill contains its scripts, guides and needed examples. Scripts resolve from the actual loaded SKILL.md directory; caches are separate.
2. [Frozen host installation](evidence/codex-release26-default-campaign-20261006.json) discovers 58 skills with zero errors; all installed hashes remain unchanged after native use.
3. Native domain CLIs and the ArtCraft runtime have public pinned artifacts and archive/file/version checks. Evidence distinguishes fresh caches from reuse.
4. Actual generic Skills CLI project installation remains NOT_RUN. Manual copies, host installation and mocked subprocesses do not satisfy this gate. The tool is missing and the previously requested isolated-install authorization has not arrived. [Pending evidence](evidence/independent-install-readiness.json).
5. New model dispatch, desktop GUI, human creative acceptance and other platforms remain unverified, separate from native/headless, discovery and static checks.

## Remaining work

- Execute actual fixed-source Skills CLI installation and all 58 installed native version checks.
- Meet model dispatch and product/creative acceptance gates while preserving uncovered limits. Do not automatically broaden supportedPluginHosts or marketplace eligibility.
- Complete each outstanding OpenSpec implementation/failure/acceptance task with evidence. This table does not justify blanket checking or archiving.

This audit found and fixed ordinary/Chinese default Vector wordmark cold-start failures introduced by the dev.7 font check. Published plugin dev.24 / skills dev.22 pass both actual installed cold-start cases: 2 tests each, 57.177 and 57.973 seconds. The full objective remains incomplete.
