# ArtCraft default Python first-use architecture

## 1. Authority and platform

OpenSpec AC-SK-003-PY and task 3.18 cover the default-Python public entry checks. The tested host is macOS arm64 with existing Homebrew Python 3.14.3, invoked with -I -B. Plugin and skill tags are unchanged; this is acceptance tooling and evidence. Other Python versions and platforms require separate evidence.

## 2. Independent paths and identities

The verifier first validates all five installed plugin identities and 58 skill hashes against the fixed host lock. It then copies each skill into its own project's .agents/skills directory; no sibling skill is present there. Paths come from the actual app-server installation receipt, not a mounted directory or guessed user path. Missing Python, invalid receipt inventory and metadata drift fail before creating output or installing native dependencies.

```mermaid
flowchart LR
 H[Fixed host receipt and lock] --> V[Verify all source identities]
 V --> S[Copy one skill per isolated project]
 S --> P[Existing default Python / isolated flags]
 P --> C[Own public CLI launcher]
 C --> R[Fixed native runtime]
 R --> T[Exact version / command catalog]
 T --> D[Recheck source and copy hashes]
```

## 3. Cache and runtime behavior

Five fresh domain cache directories are used. The first skill in each domain performs a public cold install; later same-domain probes reuse that verified cache. This is not 58 independent cold downloads. Offline archive overrides are removed, native child PATH is limited to system executables, and no general-purpose installer, Python package or global skill is installed. ArtCraft --version only installs its orchestration runtime; creative workflows independently install their declared domains.

## 4. Actual checks

58 version probes pass in 42.371 seconds. Native catalogs contain FilmCraft 666, EffectCraft 640, PhotoCraft 748 and VectorCraft 585 command IDs; these counts do not prove every command's behavior. ArtCraft public help covers run and package. All installed and copied skill hashes remain unchanged and copied skills contain no bytecode. Default regression is 48 tests: 44 pass, 4 gated skips (2.666 seconds). Four targeted guard tests pass.

The actual Skills CLI/npx installation gate remains NOT_RUN. Separate actual host-installed mixed workflow execution also passes: two tests in 49.322 seconds, with installation, five native nodes, brand revision, replay and package verification invoked by Homebrew Python 3.14.3. The installation receipt binds that executable. Image assertions run in a test-only Python 3.13.5/Pillow process. All 58 source and copied hashes are reverified after the mixed run. Evidence: docs/evidence/default-python-cli-first-use.json.

## 5. Boundaries

Independent copying validates self-contained entry paths, not the external npx installer's behavior. Catalog queries and versions do not prove creative delivery, model-directed dispatch, GUI or human acceptance. Those scopes require separate bound evidence. Image comparisons may use a test-only Pillow environment without making that environment a workflow runtime dependency; any such split must be reported explicitly.
