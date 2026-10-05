# ArtCraft Agent Plugin

Cross-tool project planning, asset dependencies, version propagation and selective rework. The independent `artcraft-use` skill runs a pinned runtime and invokes four independent domain skills through public scripts.

[English](README.md) | [简体中文](README.zh-CN.md)

## Current release and reproducible host checks

Previously verified plugin/skill suite: `0.1.0-dev.8`. Codex 0.147.0 and 0.153.4 installed five fixed public releases and discovered all 58 enabled namespaced skills with zero loading errors and matching source digests. Five representative workflows passed through installed task-skill entrypoints on 0.147.0, including native projects, targeted revisions and the mixed ArtCraft online workflow. Model dispatch, desktop GUI, final creative review and full interchange fidelity remain unverified.

[Host verification design](docs/ArtCraft-Host-Verification-Architecture.md) · [Version-bound evidence](docs/evidence/codex-skill-suite.json). Historical milestones below retain their original scope; the current manifest and locks own version identity.

> Implementation in progress. Four-domain native handoff, durable CLI resume and clean first use through default online downloads pass. Current-version full host acceptance, provider invoice settlement and final creative review remain unfinished; unknown worker/submission outcomes retain ownership for reconciliation.

## At a glance

```mermaid
flowchart LR
 U[Brief and provided assets] --> S[Independent artcraft-use skill]
 S --> I[Pinned installation and identity checks]
 I --> H[Frozen plan / SQLite ledger / DAG]
 H --> V[VectorCraft]
 V --> P[PhotoCraft]
 V --> E[EffectCraft]
 E --> F[FilmCraft]
 H --> A[Native projects / media / exports / evidence]
```

| Property | Current state |
| --- | --- |
| Plugin ID / version | artcraft / 0.1.0-dev.8 |
| Specification authority | openspec/changes/establish-v1-plugin |
| Skill authority | Independent artcraft-skills / published v0.1.0-dev.8 |
| Runtime | macOS arm64; Python 3.11+; pinned Node installed automatically |
| Native delivery | .vectorcraft / .pcraft / .ecproj / .fcproj |
| Host and marketplace | Codex development install/discovery pass; production marketplace not eligible |

## Capabilities and boundaries

| Capability | Verified | Remaining work |
| --- | --- | --- |
| Planning and routing | Skill-led decomposition; explicit nodes bind actual capabilities | Automatic constraint inference; existing Jianying/Factory adapters |
| Dependency execution | DAG checks, bounded concurrency, one writer per project, verified inputs and original-attempt adoption | Unknown worker/submission windows require reconciliation |
| Versions and rework | Hashes, lineage, no-replay reuse, Logo consumer rebuilds | Complete creative revision orchestration |
| Technical delivery | Native projects, collected media, previews, exports, portable packages and hash-bound loss reports | Complete media metadata, cross-editor fidelity and creative approval |
| Evaluation | File/reference hashes, native reopen and real decode tests | Cross-artifact creative consistency and final review |
| Installation | Clean single skill, default online locked bundles, four official CLI installations and two Codex install/discovery runs | GUI and other hosts |

## Quick start

Run `scripts/workflow.py` from the actual independent skill directory. It installs pinned dependencies and creates the project ledger. The example requires an existing WAV; see the package's SKILL.md and workflow contract.

```text
python3 <skill-root>/scripts/workflow.py <plan.json> \
  --output <absolute-project-dir> --authorization <existing-scope-ref> \
  --asset voice=<absolute-voice.wav>
```

Default online downloads passed in a fresh runtime directory with only one copied skill and no global Node; see [online evidence](docs/evidence/online-first-use.json). Offline archive options also preserve hash checks. The actual CLI argv is `[nodeExecutable, entryPoint, ...]`; public commands are run, status and cancel.

## Architecture and documentation

- [Complete runtime architecture](docs/ArtCraft-Runtime-Architecture.md)
- [Domain design](docs/ArtCraft-Domain-Design.md)
- [Public protocol](docs/ArtCraft-Protocol-Implementation.md)
- [Task ledger](docs/ArtCraft-Task-Ledger.md)
- [Local execution](docs/ArtCraft-Local-Execution.md)
- [Dependency scheduling](docs/ArtCraft-Workflow-Scheduling.md)
- [Public skill adapter](docs/ArtCraft-Public-Skill-Adapter.md)
- [Four-domain native handoff](docs/ArtCraft-Native-Handoff.md)
- [First-use installation design](docs/ArtCraft-First-Use.md)
- [Complete documentation index](docs/README.md)
- [OpenSpec proposal](openspec/changes/establish-v1-plugin/proposal.md) and [tasks](openspec/changes/establish-v1-plugin/tasks.md)

## Reliability and verification

Trusted configuration pins interpreter, scripts, native executables and output roots; public payloads cannot choose executable code. Python runs isolated without bytecode caches. The runner persists intent, supervises process groups and verifies outputs before releasing ownership. Unknown outcomes are not replayed. The skill entry also serializes project-directory calls, freezes plans and registries and preserves existing user directories.

The dev.7 runtime's 79 native regression tests passed; see [exchange/report evidence](docs/evidence/exchange-loss.json). Independent installation and first-use evidence is in [setup records](docs/evidence/artcraft-setup-tests.json). Local installation, online download, native delivery, creative acceptance and host installation are separate evidence scopes. `review_ready` denotes technical readiness.

## Specification, contribution and license

The existing OpenSpec change remains the sole authority. Check tasks only against their actual scope; complete scenarios stay in progress until accepted. Hosts, provider invoice settlement, creative review and complete recovery remain unfinished.

```bash
python3 scripts/validate_docs.py
openspec validate establish-v1-plugin --strict --no-interactive
```

These validate documentation and specifications only. Original code uses [Apache-2.0](LICENSE). Node and official CLI licenses are retained separately. Restricted upstream ArtCraft/Services code and brand assets are not copied.

[Upstream reference](https://github.com/storytold/artcraft) · [Issues](https://github.com/full-aigc-plugins/artcraft-plugin/issues)

Independent skills are pinned at the current published development tag `v0.1.0-dev.9`, including the exact source commit and whole-skill digest in `skills.lock.json`. Verify using `python3 scripts/vendor/skill_vendor.py check`. These source snapshots do not establish plugin-host acceptance or production readiness.

## Codex development host checks

All five plugins installed from public tags into an isolated Codex configuration. App-server discovered their namespaced skills without loading errors; the installed ArtCraft entry produced four native projects. [Host evidence](docs/evidence/codex-installation.json). These controlled development checks do not establish desktop GUI, other hosts, complete creative or production marketplace acceptance.

## Shared budget admission

The development runtime now freezes one account per owner/workflow/authorization, reserves trusted cost bounds before native execution and limits subsequent plan revisions. Replays do not allocate twice; unknown outcomes keep their reservation. [Architecture and migration contract](docs/ArtCraft-Budget-Architecture.md). Paid-provider settlement and quality stagnation loops remain pending.

Version `0.1.0-dev.1` passes [default online first use and bounded Logo rework](docs/evidence/online-first-use-v1.json): all four outputs update, original native project hashes and provided audio remain intact, replay allocates no extra round, and a third revision is rejected.

The new development version also passes [Codex installed-skill execution](docs/evidence/codex-installation-v1.json), including bounded Logo rework. This is controlled host evidence, not desktop GUI or production marketplace acceptance.

Development version `0.1.0-dev.3` binds registered native source projects through public revision interfaces, saves new deliveries and verifies unchanged source packages and inherited media. See [revision architecture](docs/ArtCraft-Runtime-Architecture.md#101-native-source-revision-adapter-development-version-3) and [evidence](docs/evidence/native-source-revision.json). Native regressions serialize test files; intermittent parallel EffectCraft failures remain unresolved.

Version 3 passes [default online first use and native Logo source revision](docs/evidence/online-first-use-v3.json): single-skill dependency installation, four native deliveries, source-project recolor, consumer updates, unchanged old packages/audio, replay reuse and budget denial. This does not establish the new installed-host entry or final creative acceptance.

Development version `0.1.0-dev.4` pins all domain skills at dev.1 and resolves the previous parallel failure: competing CLI reuse failed at the nonblocking install lock, before rendering. After bounded waiting, 16/16 concurrent composition samples, 59 parallel native regression tests and 71 domain live skill tests pass. [Evidence](docs/evidence/install-concurrency.json).

Version 4 passes [default online first use](docs/evidence/online-first-use-v4.json), including all four native deliveries, source Logo revision, downstream updates, preserved source projects/audio and bounded rework. Public runtime and four skill ZIP digests match the installation lock.

Development version `0.1.0-dev.5` packages trusted ledger deliveries with native projects, registered media, previews, exports, frozen plans and task records, returning an independent manifest SHA. Existing directories and unfinished/active workflows are rejected. All four native projects reopen/export after moving the package and deleting original directories/audio. [Evidence](docs/evidence/project-package.json). State remains technical review_ready.

Version 5 passes [the complete default online entry](docs/evidence/online-first-use-v5.json): installation, native revision, public packaging and moved verification after deleting originals. All three AC-AR-001 OpenSpec tasks now have completion evidence; creative review and complete exchange-loss reporting remain open.

Development version `0.1.0-dev.6` adds detached native supervision and original-attempt recovery. Scheduler/worker SIGKILL, cancellation after scheduler death, DAG adoption, concurrent recovery and real EffectCraft rendering pass in 76 parallel native regression tests. Unknown worker/submission outcomes retain ownership; creative approval and full current host acceptance remain open.

Default online dev.6 acceptance passes from a single copied skill and empty runtime without archive overrides. Killing the installed scheduler during a native operation and re-running the same public workflow preserves the original attempt, produces exactly four executions and leaves no lease or duplicate budget allocation. Source revision and moved package verification also pass; see [online evidence](docs/evidence/online-first-use-v6.json).

The current development milestone adds hash-bound exchange loss reports to native deliveries. lost, observed and unknown are separate; derivatives never substitute for native projects. Font/effect/mask fidelity across editors remains unverified, so full exchange acceptance stays open.

Default online dev.7 first-use acceptance passes in 53.106 seconds: one copied skill, fresh runtime and no archive overrides. All four native deliveries include digest-bound exchange reports; source revisions, scheduler recovery and moved-package verification pass. See [online evidence](docs/evidence/online-first-use-v7.json).

## CLI and task skill suite

The source suite contains 10 independently installable skills with setup, public CLI operations and focused tasks. [Architecture and catalogue](docs/ArtCraft-Skill-Suite-Architecture.md). Runtime and plugin versions are separate; prior host evidence retains its original version scope.

Previously verified plugin: `0.1.0-dev.10`; skill suite: `0.1.0-dev.9`. The corrected examples resolve scripts from the actual host-loaded `SKILL.md` directory. All skills passed isolated entry-point checks in user, project and plugin layouts with spaces. [Path evidence](docs/evidence/installed-skill-paths.json). Earlier host evidence above covers its recorded release; existing installations require an update.

Plugin `0.1.0-dev.10` corrects the whole-skill digests by fetching the immutable public source tag, without local Python caches. Plugin tag `v0.1.0-dev.9` is superseded and must not be installed because its source digests included ignored development caches.

Previously verified plugin `0.1.0-dev.11` pins skill suite `0.1.0-dev.10` and runtime dev.7. One copied skill cold-installed default public dependencies, delivered four native projects, reused tasks and packaged/moved/verified the delivery with PhotoCraft/VectorCraft dev.5. Regression: 20 passed, one Node-only offline-archive test skipped. [Evidence](docs/evidence/online-domain-upgrade.json). Legacy adapters and full host/model/creative acceptance remain pending.

Previously verified plugin `0.1.0-dev.12` pins skill suite `0.1.0-dev.11` and runtime dev.7. Updated task contracts remove outdated budget/revision/recovery instructions. One revise skill cold-installs default public dependencies and revises four native sources in a five-node project, reusing the unrelated node and preserving old projects, animation, audio and captions. Replacing it with independent assets/deliver/review/recover skills verifies ledger access, moved delivery packages and idempotent cancellation of a stopped task. Regression: 22 passed, one Node-only offline test skipped. [Evidence](docs/evidence/task-skill-first-use.json). Full model dispatch, creative acceptance, worker-crash recovery and legacy adapters remain open.

Current plugin/runtime dev.13 pins skill suite dev.12 and supports optional Video Factory 0.4.0 public validation nodes. Explicit existing plugin/FFmpeg/ffprobe paths are hashed and frozen; model payloads cannot choose commands or executables. Real gates, input binding, report syntax and package retention are verified; missing provenance stays NOT_RUN and required FAIL blocks delivery. All 83 native runtime tests pass. Candidate first use passes with a local locked runtime ZIP; default online download is a separate post-publication gate. [Architecture](docs/ArtCraft-VideoFactory-Architecture.md), [candidate evidence](docs/evidence/video-factory-candidate.json). Legacy rendering, Jianying/Image Factory adapters and full model/creative acceptance remain pending.
