# ArtCraft Agent Plugin

Cross-tool project planning, asset dependencies, version propagation and selective rework. The independent `artcraft-use` skill runs a pinned runtime and invokes four independent domain skills through public scripts.

[English](README.md) | [简体中文](README.zh-CN.md)

## Current release and reproducible host checks

Current plugin: `0.1.0-dev.21`; skill source: `0.1.0-dev.19`; runtime: `0.1.0-dev.16`. Historical host evidence below retains its original release scope. Codex 0.147.0 and 0.153.4 installed five fixed public releases and discovered all 58 enabled namespaced skills with zero loading errors and matching source digests. Five representative workflows passed through installed task-skill entrypoints on 0.147.0, including native projects, targeted revisions and the mixed ArtCraft online workflow. Model dispatch, desktop GUI, final creative review and full interchange fidelity remain unverified.

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
| Plugin ID / version | artcraft / 0.1.0-dev.21 |
| Specification authority | openspec/changes/establish-v1-plugin |
| Skill authority | Independent artcraft-skills / published v0.1.0-dev.19 |
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

Previously verified plugin dev.14 / runtime dev.13 pins skill suite dev.12 and supports optional Video Factory 0.4.0 public validation nodes. Explicit existing plugin/FFmpeg/ffprobe paths are hashed and frozen; model payloads cannot choose commands or executables. Real gates, input binding, report syntax and package retention are verified; missing provenance stays NOT_RUN and required FAIL blocks delivery. All 83 native runtime tests pass. Default public online first use now passes: 24 tests passed and one Node-only offline test skipped. The single installed skill cold-installs its dependencies, executes five nodes and verifies their delivery package. Plugin dev.14 fixes duplicated OpenSpec task IDs from snapshot dev.13 and adds a regression guard; runtime dev.13 retains its published bytes and digest. [Architecture](docs/ArtCraft-VideoFactory-Architecture.md), [candidate evidence](docs/evidence/video-factory-candidate.json), [online evidence](docs/evidence/video-factory-online.json). Legacy rendering, Jianying/Image Factory adapters and full model/creative acceptance remain pending.

Current plugin dev.15 pins skill suite dev.13 and retains runtime dev.13. EffectCraft skills dev.6 enable native mask vertex revision; only intro and consuming video change while Logo/poster tasks reuse. Original file hashes, opacity keys, audio and captions stay intact; actual RGBA boundaries and the four-child package verify. Full default-online regression: 25 passed, one Node-only offline test skipped; 83 native integration tests pass. [Architecture](docs/ArtCraft-Mask-Revision-Architecture.md), [evidence](docs/evidence/mask-revision-first-use.json). Host/model, creative and broader legacy-adapter acceptance remain open.

Current fixed-release host refresh: Codex 0.153.4 installs FilmCraft dev.5, EffectCraft dev.7, PhotoCraft/VectorCraft dev.6 and ArtCraft dev.15 in an isolated configuration, discovers all 58 skills and verifies every locked identity. All five representative workflows pass from installed skill content; all 58 skill hashes remain unchanged afterward. The explicit-tag matrix generator has four passing boundary tests. [Evidence](docs/evidence/codex-current-release-20261006.json). Model dispatch awaits explicit authorization; GUI, creative and production acceptance remain open. Published plugin/skill/runtime tags are unchanged by this QA maintenance.

Skill suite dev.14 pins orchestration runtime dev.16 and FilmCraft dev.5 (maintained native CLI 0.2.0-craft.1). It supports complete Git release ZIPs and explicitly retained source media. One isolated revise skill cold-installs default public dependencies, creates four native projects with Chinese voice and burned captions, then updates only FilmCraft while preserving original files, audio and three task identities. Two tests passed; 72 video frames and all four packaged children were verified. [Architecture](docs/ArtCraft-Chinese-Mixed-Architecture.md), [evidence](docs/evidence/chinese-mixed-first-use.json). Full creative, GUI and model-dispatch acceptance remain pending.

Plugin dev.18 vendors independent source dev.16 and retains runtime dev.16. All ten skills bootstrap the orchestration runtime first; workflows select required domains. Logo-only avoids unused domains; a poster adds PhotoCraft; queries and packaging do not add unrelated CLIs. Default-online regression passed 35 tests, with one Node offline fixture skipped; six additional instruction/guard checks passed. [Architecture](docs/ArtCraft-Selected-Setup-Architecture.md), [evidence](docs/evidence/selected-domain-first-use.json). New-release host model dispatch and full creative acceptance remain pending.

Plugin dev.19 vendors skill source dev.17. Every independent skill now carries the current-package review recorder; runtime remains dev.16. It saves named observations and movable evidence, keeps missing creative/human acceptance pending, and leaves the task ledger unchanged. Six review unit tests and one source-isolated native first-use test pass. Fixture records do not prove creative acceptance. [Architecture](docs/ArtCraft-Review-Records-Architecture.md), [evidence](docs/evidence/review-record-first-use.json). Fixed-release host evidence is reported separately below.

Fixed release dev.19 host validation: all five plugins and 58 skills discovered with zero loading errors; the actual installed review skill passes one public cold first-use test in 30.165 seconds. All installed skill hashes remain identical to their locks after execution. This proves the review-record contract, not model dispatch, GUI or complete creative acceptance. [Host evidence](docs/evidence/codex-release19-review-first-use-20261006.json).

Plugin dev.20 vendors the revision helper from published independent source dev.18; runtime remains dev.16. It accepts a frozen policy, verified package/review and explicit native patches; preserves original deliveries; and supports bounded rounds, stagnation, budget stops and interrupted-process recovery. [Architecture](docs/ArtCraft-Revision-Cycle-Architecture.md). Fixed-release host verification is recorded separately. Fixture feedback does not establish creative acceptance.

Fixed plugin dev.20 host validation passed: five plugins and all 58 skills discovered without errors; the actual installed revise skill passed default-public cold first use and real interrupted-process recovery in 47.636 seconds. Every installed skill hash still matches its fixed release lock. Release-commit documentation/OpenSpec and implementation CI passed; Linux runtime CI reports 79 passed and 5 skipped, not native macOS acceptance. [Evidence](docs/evidence/codex-release20-revision-first-use-20261006.json). Model dispatch, GUI and complete creative acceptance remain open.

Current fixed-release mixed observation: installed plugin dev.20 and skills dev.18 passed two Chinese native first-use/revision tests. Four actual exports were inspected by the current assistant and a hash-bound model observation was recorded and reverified. Caption-only v2 deliberately retains the original narration but changes its text, so wording consistency is FAIL; engineering/technical PASS does not imply creative acceptance. Human acceptance remains NOT_RUN. [Evidence](docs/evidence/installed-mixed-observation.json). No new native release or model session was used for this QA check.

Plugin dev.21 pins skills dev.19 and runtime dev.16. Stop receipts retain the latest unresolved observation and package/review identity separately from the best package. Old journals remain NOT_RUN. Native source cold-first-use passes; fixed-release host evidence is separate. [Evidence](docs/evidence/revision-unresolved-first-use.json).

Fixed plugin dev.21 host verification passed: five plugins, all 58 skills, zero discovery errors and unchanged skill hashes after execution. The actual installed revise skill passed native cold first use, unresolved issue delivery and interrupted-process recovery in 50.054 seconds. [Host evidence](docs/evidence/codex-release21-unresolved-first-use-20261006.json). Release-commit documentation/OpenSpec and implementation CI passed. Full creative, model dispatch and GUI acceptance remain open.

Independent Skills CLI installation acceptance is prepared and NOT_RUN. The verifier reads fixed public source refs, checks 58 project-installed directories and probes every native launcher without changing global skill directories. Three plan/guard tests pass; the missing installer requires isolated-install authorization before live execution. [Design](docs/ArtCraft-Independent-Install-Architecture.md), [readiness evidence](docs/evidence/independent-install-readiness.json). Existing plugin/native evidence is unchanged.

Native global brand-token mixed workflow passes a single-skill public cold install: logo, poster, intro and film update while the unrelated badge task and original deliveries are preserved. VectorCraft skills are pinned to dev.6; ArtCraft runtime remains dev.16. Skill source dev.20 is published; plugin dev.22 is published. Fixed-release host discovery passes for 58 skills, and the installed single-skill cold native mixed test passes in 54.471 seconds. Actual npx independent installation and model dispatch remain unverified. [Architecture](docs/ArtCraft-Brand-Token-Mixed-Architecture.md), [evidence](docs/evidence/brand-token-mixed-first-use.json).

Existing default Homebrew Python 3.14.3 passes all 58 separately copied public CLI entries. Five domain caches start empty; later same-domain probes reuse verified caches. Skill hashes remain unchanged. This verifies launcher installation and queries, not actual npx installation or creative acceptance. [Architecture](docs/ArtCraft-Default-Python-Architecture.md), [evidence](docs/evidence/default-python-cli-first-use.json).

The actual host-installed ArtCraft mixed workflow also passes with Homebrew Python 3.14.3 invoking installation, native creation, selective brand revision and package verification (2 tests, 49.322 seconds). Image assertions use a separate test-only Pillow process. [Default-Python evidence](docs/evidence/default-python-cli-first-use.json).

Development candidate dev.23 vendors ArtCraft skills dev.21, pinning VectorCraft skills dev.7 with bundled sample fonts. Single-skill cold native mixed creation/revision/package tests pass (2 tests, 56.437 seconds); fixed-host installed verification of this candidate remains NOT_RUN. [Evidence](docs/evidence/vector-font-mixed-first-use.json).

Published dev.21 skills / dev.23 plugin now pass fixed-host discovery (58 skills) and actual installed single-skill native mixed cold-start verification (2 tests, 54.673 seconds) with default Python 3.14.3. All installed hashes remain unchanged. [Evidence](docs/evidence/codex-release25-vector-font-mixed-20261006.json).

Candidate skills dev.22 fix ordinary and Chinese Vector wordmark defaults. Both single-skill public cold native workflows pass (2 tests each, 52.807 / 52.964 seconds). New fixed-host installed retesting remains NOT_RUN. [Evidence](docs/evidence/default-campaign-font-first-use.json).

Published skills dev.22 / plugin dev.24 pass fixed-host discovery for all 58 skills. Both actual installed single-skill cold workflows pass: ordinary source-project revision (2 tests, 57.177 seconds) and Chinese delivery/caption revision (2 tests, 57.973 seconds). All installed skill hashes remain unchanged. Earlier candidate NOT_RUN states describe the pre-publication checkpoint. [Evidence](docs/evidence/codex-release26-default-campaign-20261006.json).

Current first-release capability and installation gaps are listed in the [delivery audit](docs/ArtCraft-Delivery-Audit.md).

Plugin candidate dev.25 pins skill source dev.23, validating frozen revision bindings before publishing installation metadata. Source single-skill native first use passes (3 tests, 92.662 seconds); installed-release retesting remains NOT_RUN. [Architecture](docs/ArtCraft-Frozen-Revision-Metadata-Architecture.md), [evidence](docs/evidence/frozen-revision-metadata-first-use.json).

Published plugin dev.25 / skills dev.23 pass actual installed single-skill native cold start, replay and metadata-preserving conflict refusal (3 tests, 90.697 seconds). Host discovery and unchanged installed hashes cover all 58 skills. [Proof](docs/evidence/codex-release27-binding-metadata-20261006.json).

Runtime dev.26 fixes cross-authorization task reuse. Candidate skill suite dev.24 pins that immutable archive, preserving same-scope selective reuse and blocking reuse from old producer authorization. Cold single-skill native proof passes (20.006 seconds); final installed-plugin proof remains NOT_RUN. [Architecture](docs/ArtCraft-Authorization-Reuse-Architecture.md), [evidence](docs/evidence/authorization-reuse.json).

Published plugin dev.27 / skills dev.24 / runtime dev.26 pass actual installed native authorization-scope testing (1 test, 23.649 seconds) and four-domain first-use/replay/conflict/relocated-package regression (3 tests, 95.854 seconds). All 58 installed hashes are unchanged. [Proof](docs/evidence/codex-release28-authorization-native-20261006.json).

Plugin candidate dev.29 vendors released ArtCraft skills dev.25 and pins runtime dev.28 for versioned Brief validation. Isolated single-skill online testing passed 3 tests in 98.048 seconds; final installed-host Brief acceptance remains pending. [Architecture](docs/ArtCraft-Versioned-Brief-Architecture.md), [proof](docs/evidence/versioned-brief-first-use.json).

Published plugin dev.29 / skills dev.25 / runtime dev.28 pass installed-skill online Brief first use (3 tests, 89.841 seconds). All 58 skills across five plugins are discovered and retain their hashes after execution. Overall implementation remains incomplete. [Proof](docs/evidence/codex-release29-brief-native-20261006.json).

Candidate plugin dev.30 vendors ArtCraft skills dev.26 with PhotoCraft skills dev.6 protected-source handoff. Runtime remains dev.28. Independent online proof passed; installed-plugin proof is pending. [Architecture](docs/ArtCraft-Photo-Protection-Architecture.md), [evidence](docs/evidence/photo-protection-first-use.json).

Fixed PhotoCraft plugin dev.7 / skills dev.6 and ArtCraft plugin dev.30 / skills dev.26 pass installed native protection/handoff proof; all 58 installed skill hashes remain unchanged. Only the scoped protection tasks are complete; overall implementation and creative acceptance remain incomplete. [Proof](docs/evidence/codex-release30-protected-native-20261006.json).

Candidate plugin dev.31 pins ArtCraft skills dev.27 and PhotoCraft skills dev.7 for protected retouch handoff. Source online-native test passed; fixed installed-plugin proof remains pending. Runtime stays dev.28.

Fixed PhotoCraft plugin dev.8 / skills dev.7 and ArtCraft plugin dev.31 / skills dev.27 pass installed native retouch/handoff testing (13.260s and 23.264s). All 58 installed skill hashes remain unchanged. Only scoped retouch tasks are complete; the full goal remains incomplete. [Proof](docs/evidence/codex-release31-retouch-native-20261006.json).

Local runtime candidate preserves bounded native-failure diagnostics without raw output text and retains them across repeated workflow queries. Immutable release and installed-native revalidation remain pending. [Architecture](docs/ArtCraft-Native-Failure-Diagnostics-Architecture.md).

Candidate plugin dev.33 pins ArtCraft skills dev.28 / runtime dev.32 with bounded native-failure diagnostics and durable public status/repeat queries. Source online-native proof passed; fixed installed-plugin proof remains pending.

Fixed ArtCraft plugin dev.33 / skills dev.28 / runtime dev.32 pass installed-native failure/status/repeat testing (1 test, 26.233s) and four-domain online first-use regression (3 tests, 95.701s). All 58 installed skill hashes remain unchanged. Scoped task 5.12 is verified; full implementation and creative acceptance remain incomplete. [Proof](docs/evidence/codex-release33-diagnostics-native-20261006.json).

Local runtime candidate dev.34 adds exact Film Brief timeline preflight and hash-bound saved-project/export duration verification before readiness and reuse. Local native mixed regression passed; fixed released first-use proof remains pending. [AC-DM-001-TIME](docs/ArtCraft-Film-Brief-Duration-Architecture.md)。

Plugin candidate dev.35 vendors fixed independent skills dev.29 and runtime dev.34. One-second Film Brief cold online source first use passed (3 tests, 93.401s); installed-host first use is pending.

Fixed ArtCraft plugin dev.35 / skills dev.29 / runtime dev.34 pass actual installed-skill online first use (3 tests, 94.638s), including the hash-bound one-second native Film duration and exported probe. All 58 installed skill hashes remain unchanged. Source-project Brief inspection and full implementation/creative acceptance remain open. [Evidence](docs/evidence/codex-release35-film-duration-native-20261006.json)。
