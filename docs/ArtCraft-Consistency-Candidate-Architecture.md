# ArtCraft Fixed-Reference Consistency Review Architecture

This is a source candidate. Task6.13 has target-failure evidence and eight subsequent passing tests. Task6.14 distribution/regression gates and task6.15 complete native scene acceptance remain open. The plugin still locks source98; public plugin126 does not contain the new behavior.

## Contract and data flow

```mermaid
flowchart TD
  A[Current package and workflow identity] --> B[Verify asset versions and digests]
  C[Fixed brand and subject references] --> B
  B --> D[Creative checks and entire reference set]
  D --> E[Verify observation file digests]
  E --> F[Parse contracts from verified bytes]
  F --> G{Bindings and locators valid}
  G -->|No| R[Refuse without publishing record]
  G -->|Yes| H[Aggregate every Photo Effect Film output]
  H --> I[PASS FAIL or NOT_RUN]
  I --> J[Portable record with recomputed verification]
```

The existing review.py record/verify entry accepts optional consistency input. Brand and subject references must identify current packaged assets, with brands also matching top-level brandReferences. Every assessment uses the same complete reference set. Creative-check evidence contains strict observation JSON bound to target, references, evaluator and status. A prompt-only JSON file is refused even when its digest matches.

Photo targets require normalized regions; Effect and Film targets require frames. Coverage applies to every actual output: an unreviewed additional cover prevents PASS. Failures retain versions and locators; missing outputs, domains or NOT_RUN observations produce NOT_RUN. This result never completes the task or substitutes for human acceptance.

Records retain craft-review-record/v1. The optional consistency result appears only with the new input contract. Legacy records remain supported. After relocation, verification checks inventory, hashes, input and observations and recomputes results. Changing or deleting aggregation fields and recomputing the outer hash does not bypass verification.

## Evidence and remaining gates

See [candidate evidence](evidence/consistency-candidate-20261009.json). The original implementation produced three target-field errors among five tests. Eight new tests and seven legacy review tests pass after implementation. These are protocol fixtures, not native-project, actual image/frame observation, installed-release or complete-scenario acceptance. Complete regression, immutable skill distribution and fixed-host verification remain required before release; existing release tags remain unchanged.
