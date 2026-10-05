# ArtCraft Skill Suite Architecture

> Updated: 2026-10-06. Skill suite: 0.1.0-dev.14; plugin: 0.1.0-dev.17; orchestration runtime: 0.1.0-dev.16. Existing OpenSpec owns target behavior.

## 1. Why a suite

The original single use skill gave a working bootstrap and representative native workflow, but had broad discovery and insufficient task routing. The revised suite follows Dreamina's entrypoint / CLI / setup / task pattern, with command groups derived from the inspected source and actual installed runtime. It does not create fake auth or generation interfaces. This package contains 10 skills.

## 2. Responsibilities and routing

| Skill | Task boundary |
| :--- | :--- |
| `artcraft-use` | use |
| `artcraft-cli` | cli |
| `artcraft-cli-setup` | cli setup |
| `artcraft-cli-plan` | cli plan |
| `artcraft-cli-execute` | cli execute |
| `artcraft-cli-assets` | cli assets |
| `artcraft-cli-revise` | cli revise |
| `artcraft-cli-recover` | cli recover |
| `artcraft-cli-deliver` | cli deliver |
| `artcraft-cli-review` | cli review |

```mermaid
flowchart TD
 U[User task] --> R[use router]
 R --> C[cli public operations]
 R --> S[cli-setup diagnosis]
 R --> T[Focused task skill]
 T --> B[Its own locked bootstrap and argv launcher]
 C --> B
 S --> B
 B --> N[Native or orchestration CLI]
 N --> D[Editable project / derivatives / evidence]
```

## 3. Single-skill packaging and CLI lifecycle

Each skill contains its own necessary scripts, runtime locks, workflow reference and examples. There are no sibling-directory reads or symlinks. `scripts/sync_skill_suite.py` copies canonical executable resources from the use skill during source maintenance; `--check` rejects drift. Scenario descriptions and command evidence remain individually maintained. This duplicates distribution resources to support granular installations while avoiding multiple hand-edited implementations.

The launcher accepts native argv after `--`, validates the leading subcommand before installation, invokes a fixed checksummed executable without a shell, preserves exit status and bounds waiting. Unknown operation/platform/corrupt install fails. Native parameters, command IDs and enabled state are discovered at runtime. Output timeouts are unknown results, not proof that writes never happened. Save a native checkpoint and inspect before any replay.

## 4. Source evidence and differences

Research checkout: `storytold/artcraft` at `3210977fb114cff7179aff2f480bf279572d5942`. CodeGraph indexed 4881 files, 68626 nodes and 155550 edges. CLI parser and engine dispatch were investigated separately from installed command catalogues; current source and release binary may differ. See [research evidence](evidence/upstream-codegraph.json).

FilmCraft uses tick-based timeline commands and save/save-as; EffectCraft has comp/layer property paths and render channels; PhotoCraft has ordered run flags and persistent serve; VectorCraft uses ordered run/export steps and distinct artboard/range indices. Upstream ArtCraft is a Tauri scene/generation application with scene asset persistence and asynchronous provider task notifications. Our ArtCraft CLI is the existing local DAG/ledger runtime, implemented independently; no upstream ArtCraft code or branding assets are copied.

## 5. Validation and release

`tests/test_skill_suite.py` isolates every skill, verifies CLI discovery and catalogue subsets against the pinned runtime, and refuses unsupported subcommands before creating a runtime directory. Existing native workflow suites verify editable delivery and revisions. Individual discovery success does not prove all task commands, creative quality, GUI or cross-editor fidelity. Shared resources are checked and each SKILL.md validated; native/platform and host results are reported separately.

Run from the independent skill repository:

```bash
python3 -B scripts/sync_skill_suite.py --check
python3 -B -m unittest discover -s tests -p test_skill_suite.py -v
CRAFT_LIVE_SUITE=1 python3 -B -m unittest discover -s tests -p test_skill_suite.py -v
```

Install one skill with `npx skills add full-aigc-skills/artcraft-skills --skill <skill-name>`; invoke its actual absolute directory, not a sibling path. Plugin packaging must bind the complete suite to a fixed source tag, commit and per-skill digest. Former tags remain immutable, and existing use/workflow payloads stay compatible.

## Independent task execution acceptance

Scene guides consume the same pinned runtime contracts as the router. Creation uses null expectedRevision; native revisions bind complete registered source artifacts and nativeProjectRef.sha256. Shared budgets enforce admission, while detached workers permit original-attempt adoption after scheduler exit only with stop evidence. Unknown submission windows and worker death retain ownership.

The task-first-use fixture verifies one cold revise skill, then replaces it with one assets/deliver/review/recover skill at a time. Four source revisions preserve prior packages, animation, audio and captions; an unrelated node is reused. Package review checks technical integrity; cancelling a stopped task is distinct from crash recovery. Evidence: [task first use](evidence/task-skill-first-use.json).
