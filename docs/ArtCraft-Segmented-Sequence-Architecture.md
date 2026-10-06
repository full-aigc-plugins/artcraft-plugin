# ArtCraft Segmented Sequence Architecture

Date: 2026-10-07. Authority: `establish-v1-plugin`, AC-DM-004 and AC-AR-001-SEGMENT. This is candidate source integration. Art plugin dev.70 / source dev.47 / runtime dev.68 and existing immutable domain releases remain unchanged.

## Contract and ownership

Effect owns bounded native segment rendering. Film owns continuous collection and native import. Art owns typed artifact validation, dependency scheduling, revision and task reconciliation. The MIME remains `application/vnd.craft.image-sequence+json`; consumers dispatch on the explicit descriptor schema. Unknown schemas are rejected.

```mermaid
flowchart LR
 E[Effect public png-segmented workflow] --> S[Verified segments.json]
 S --> A[Art checks ranges and every RGBA frame]
 A --> F[Film public segmented-sequence-asset]
 F --> C[Continuous collected sequence.json]
 C --> N[Native fcproj and decoded MP4]
 N --> R[Moved project and bounded text revision]
 S --> B[Bad frame blocks consumption]
 B --> V[Restore and reverify]
 V --> U[Reuse task IDs and budget]
```

`craft-segmented-render-checkpoint/v1` requires verified state, project/runtime hash bindings, consistent composition timing, exact rational ranges and original v1 child manifests. Each child has at most 512 MiB encoded and decoded bytes. Logical totals are bounded to 64 GiB / 10,000 frames and 2 GiB encoded bytes. The original `craft-image-sequence/v1` aggregate limit stays 512 MiB. These are resource limits, not long-render acceptance.

Film creates `filmcraft-collected-sequence/v1`, keeping segment source hashes and the original `sourceSequenceSha256`. Its newly normalized descriptor has a different SHA. The adapter compares provenance to the original source hash and validates the new collected hash independently; treating these two hashes as equal would reject a valid import or weaken provenance checks.

## Paths, evidence and recovery

Art resolves a registered segmented asset's real path before constructing public Film arguments. This handles the macOS system temporary-directory alias without relaxing Film's child symlink rejection. Prepare revalidates input bytes before native execution. Models cannot select local executables or arbitrary scripts.

Source artifacts carry every child manifest and frame reference. Film artifacts carry all collected frame references and native dependency records. A partial checkpoint, range gap/overlap, timing mismatch, corrupted PNG or changed digest blocks execution. Restoring an unchanged version reuses the previous task IDs and budget; this does not claim reuse across an edited source version.

## Verification and release gate

[Candidate evidence](evidence/art-segment-adapter-candidate-20261007.json) binds actual native runtime hashes, independent skill file hashes, the native driver and candidate adapter/protocol source hashes. Public workflows generate three segments / twelve frames, decode twelve MP4 frames, check six composited pixels, revise text after moving the Film package and deleting the original background, preserve old files, block a corrupt frame and reuse tasks/budget after restoration. All source skill files are rehashed after execution.

The candidate uses existing verified native executables and current domain source. It is not an empty-runtime Art installation or an installed new immutable plugin. Task 6.46 covers this candidate; 6.47 remains open for HD long rendering, pinned domain and Art runtime/source/plugin publication, installed snapshots, cold public use, moved packaging and installation hash preservation. GUI/model/creative approval and full V1 remain open. Art has no Jianying adapter.

Reproduction: run `node --test test/segmented_sequence.test.ts` for protocol boundaries. The native driver is `test/segmented_sequence_native.test.ts`, enabled by `CRAFT_ART_SEGMENT_NATIVE=1` with explicit verified Python, domain skill and native CLI paths. Environment paths are local configuration and are never published in evidence.
