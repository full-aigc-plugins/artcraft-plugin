# ArtCraft Jianying Adapter Design

Status: source-verified design. The adapter, pinned release and actual first-use acceptance are not complete. AC-DM-006 in `establish-v1-plugin` remains the specification authority; this document does not advertise Jianying routing as available.

## Pinned contract and evidence

The baseline is Jianying CLI v1.6.31, source commit `6fe623096f1ce281d5f0a06f93ca23989b901cff`. Inspected files: `src/main.rs`, `src/job_runner.rs`, `crates/jianying-cli/src/success_envelope.rs`, `crates/jianying-jobs/src/job_record.rs` and `provenance/CAPABILITIES.json`. Registration must freeze the release hashes from the existing Jianying plugin's `runtime/jianying-cli.lock.json`, rather than dynamically trusting another checkout.

| Interface | Actual behavior | ArtCraft requirement |
| :--- | :--- | :--- |
| `capabilities --json` | Success envelope is `{ok:true,data:...}`; runtime overrides release identity | Check binary, version, commit and capability status; route only supported capabilities |
| `job run JOB --out OUTPUT --state-root STATE --json` | Allocates a new jy-task ID and executes synchronously; data contains the business result and task_id | Freeze argv, Job digest, exclusive output and state directory; persist intent before execution |
| `job show TASK --state-root STATE --json` | Returns JobRecord state, paths, revision, attempts and history, without the business result | Re-inspect and verify products and material hashes after succeeded |
| `job list --state-root STATE --json` | Lists persisted records in that state directory | Reconcile a lost task_id through unique Job/output paths; unresolved or multiple matches remain unknown |
| `job retry TASK ...` | Explicitly retries the same record and increments attempts | No automatic parent retry; never run again after an unknown outcome |
| Job proxy export | Generates a proxy video | Preserve proxy_preview evidence; do not claim native final output |
| Job native / draft_archive export | Returns incompatible capability | Reject before dispatch; an enum in the schema is not executable support |

## Components and handoff

```mermaid
flowchart LR
  A[Brief and native format] --> B[Capability and identity registration]
  B --> C[Declarative Job compiler]
  C --> D[Persisted intent and project lock]
  D --> E[Public Jianying CLI]
  E --> F[Task reconciliation and artifact verification]
  F --> G[Project closure and loss report]
  G --> H[Package and editor acceptance]
  E --> I[Unknown outcome]
  I --> F
```

A public registration entry takes the actual absolute CLI path and trusted release lock. It must not import the Jianying plugin's private runtime_adapter. Model payloads cannot select executables, state directories, environment variables or shell commands. Each independent skill uses its own installation resources and public workflow entry, without sibling skill paths. Installation stays within user authorization; existing versions are checked against hashes before reuse.

Create compilation maps registered image, video and audio artifacts into Job v2 local materials, retaining logical IDs and input hashes. Time is represented as integer microseconds with rational frame rates; conversion loss is explicit. Edits bind a source and a fresh output and compare the complete source directory and external media before and after execution, rather than trusting isolation.source_unchanged alone. Revisions preserve unrelated layers, tracks and assets; only dependent downstream nodes are invalidated.

## Recovery and cancellation

Before dispatch, ArtCraft freezes a unique Job path, output path, state root and input digests. The child assigns task IDs, creating a crash window before the parent receives a receipt. Recovery first establishes that the original worker has stopped, then uses list/show in the dedicated state root. A timeout is not evidence of non-submission. Adopt succeeded only for a unique match whose artifacts are independently verified. Missing or multiple records, running state and identity drift retain the project lease and require reconciliation.

JobRecord does not persist the business result. Recovery reconstructs read-only evidence instead of inventing an old receipt. A cancelled record does not prove that writing or rendering stopped; release the lease only after process-stop evidence. Retry is explicit, and repeated parent calls must not create another draft.

## Delivery and acceptance

A Jianying native deliverable is the draft directory plus its referenced material closure, never a renamed `.fcproj`. ArtCraft may package that closure itself, without claiming an unavailable store.archive call. Accept only verified regular files; reject escapes, symlinks, duplicate outputs and missing dependencies. Relocate the package, verify references and invoke public inspect/verify again. Keep structural verification, proxy preview, actual editor reopen and native export distinct; unexecuted evidence remains NOT_RUN.

Actual acceptance covers brand graphics, poster and intro input to a Jianying draft, local text/Logo revision, source preservation, unrelated artifact reuse, submission-window recovery and a moved package. A supported Jianying editor must reopen the draft and verify editable objects. Native final output requires its own executable export capability and evidence; proxy output is insufficient.

## Implementation sequence

1. Failure tests for envelope parsing, partial capabilities, digest drift, unknown submission without replay, succeeded without artifacts, and unsupported archive/native export.
2. Public registration, Job compiler, supervised driver, persistent queries, project closure packaging and independent skill entry; preserve four-domain and Video Factory compatibility.
3. Pinned candidate CLI/runtime/skills/plugin releases, actual empty-runtime first use and failure recovery.
4. Separate editor reopen, selective revision and native export acceptance; close AC-DM-006 only with evidence for every requirement.
