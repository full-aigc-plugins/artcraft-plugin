# Five-plugin first-use completion audit

This audit checks the current fixed releases and actual installation identities while retaining the full goal. **Installation identities and recorded cold starts match; overall completion remains unproven.** It neither changes OpenSpec/tasks/releases nor reruns native work.

## Current dev.105 defaults

The three maintainer tools use `host-acceptance-art105.lock.json`; the auditor uses `craft-art105-whisper-fixed-first-use-20261008.json`. The default audit rehashed all 64 current identities and reports 120 requirements and 277 open tasks. Recorded cold evidence comprises 23 new Film/Art runs and 41 historical records reused after complete digest equality. Explicit historical lock/evidence parameters remain supported. Nine audit tests cover current defaults, historical overrides and existing rejection boundaries; they do not prove new creative acceptance.

[Current fixed evidence](evidence/craft-art105-whisper-fixed-first-use-20261008.json).

Actual default installed verification passes 64 CLI probes in 73.069s, with five new domain caches and later reuse. The 80-test Python regression has 75 passes and five conditional skips. [Maintainer correction evidence](evidence/artcraft105-maintainer-defaults-20261008.json).

## Historical dev.102 audit

The current immutable matrix is Film32/source30, Effect33/31, Photo33/31, Vector32/30 and Art102/76, totaling64 skills. All64 freshly executed independent cold installations pass in666.554s; these are one current run, separate from the historical composed proof below. Current tracked source exports, full plugin/installed skill trees and exact host/tag identities match. There are120 requirements,439 scenarios and277 unchecked tasks. No complete formal requirement is inferred from this installation proof. Actual generic Skills CLI, exhaustive command contexts and creative review remain open.

[Current audit](evidence/craft-art102-first-use-completion-audit-20261007.json) · [Fixed installation/native evidence](evidence/craft-lock-preflight-fixed-installation-20261007.json).


## Historical dev.101 evidence and scope

| Plugin | Plugin version | Skill source version | Skills | Requirements / scenarios | Unchecked tasks |
| --- | --- | --- | ---: | ---: | ---: |
| FilmCraft | dev.31 | dev.29 | 13 | 23 / 77 | 58 |
| EffectCraft | dev.32 | dev.30 | 15 | 23 / 74 | 57 |
| PhotoCraft | dev.32 | dev.30 | 13 | 23 / 75 | 55 |
| VectorCraft | dev.31 | dev.29 | 13 | 26 / 79 | 55 |
| ArtCraft | dev.101 | dev.75 | 10 | 25 / 134 | 52 |

All versions have the `0.1.0-` prefix. Totals: 64 skills, 120 requirements, 439 scenarios and 277 unchecked tasks. Unchecked tasks are not a missing-feature count; implemented items awaiting complete acceptance can remain unchecked. Each contract/scenario retains its name, location and SHA-256 for subsequent evidence review.

- **Rechecked:** complete plugin and installed skill trees, plugin metadata, independent source locks and local immutable tag commits.
- **Rechecked:** fixed skill-source archives against current tracked files byte for byte, and archive skill digests against the lock. The source working trees contain 41 ignored files, reported separately and preserved. They are not release content; the entire source working tree is not asserted to match the release.
- **Recorded identity checked:** all host-discovered skills, enabled states and exact hashes; recorded independent cold-start coverage has no missing/duplicate/stale/warm entries. The 64 records combine three version-bound runs, rather than a new 64-case native invocation this turn.
- **Unproven:** actual generic Skills CLI installation, complete scenarios/creative acceptance, model dispatch, other platforms and production release. Formal scenarios remain pending full evidence review; installation success cannot close their contracts.

Original fixed runtime observations remain in the [structured-receipt first-use evidence](evidence/artcraft101-structured-workflow-receipt-fixed-first-use-20261007.json). This read-only recheck is the [completion audit](evidence/craft-current-first-use-completion-audit-20261007.json). Evidence layers remain separate.

## Validation flow

```mermaid
flowchart TD
 L[Fixed five-plugin release lock] --> T[Local immutable tag commits]
 T --> S[Tagged archives versus tracked source bytes]
 T --> P[Complete plugin and installed tree digests]
 L --> H[Host discovery and enabled identities]
 L --> C[Recorded independent cold starts per skill]
 S --> I[Matching installation identities]
 P --> I
 H --> I
 C --> I
 F[Existing OpenSpec requirements and scenarios] --> R[Contract hashes and unchecked tasks]
 R --> G[Full scenario implementation and runtime evidence review]
 I --> G
 G --> U[Keep goal incomplete when evidence is insufficient]
```

The auditor rejects duplicate JSON keys, stale locks, incorrect host identities, duplicate/missing skills, warm-start records, tracked source changes and digest drift. Failure does not publish a successful report. It preserves source caches; extra files in plugin/installed skill trees still fail strict hashing.

## Reproduction and remaining work

Run from the ArtCraft plugin root with caller-provided paths. `HOST_RECEIPT` must come from a real isolated installation; a handwritten directory inventory is insufficient. Output must be a new file.

```bash
python3 -I -B scripts/audit_first_use_completion.py \
  --plugins-root "$PLUGINS_ROOT" --skills-root "$SKILLS_ROOT" \
  --host-receipt "$HOST_RECEIPT" --output "$NEW_AUDIT_OUTPUT"
```

This is a maintainer evidence tool. Independent user skills retain their own `cli.py` / `workflow.py` entries. The audit does not install tools or publish releases.

Continue the original contracts: actual Skills CLI acceptance remains pending authorization; review complete evidence for native creation, referenced assets, save/reopen, previews/exports, targeted revisions and mixed dependency/delivery scenarios. Reuse older runs only when their exact current identities and scenario scopes match. Matching identities must not mark all formal scenarios complete.

Seven unit tests cover stale hashes, duplicate/missing/warm records, missing run identifiers, success counts without records, duplicate JSON keys, preserved ignored caches, tracked modifications and task state not substituting for scenario evidence. They establish auditor behavior, not new native/creative acceptance.
