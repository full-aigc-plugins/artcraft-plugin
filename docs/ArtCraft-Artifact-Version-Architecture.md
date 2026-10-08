# ArtCraft immutable artifact version candidate

AC-CP-002 already requires immutable content per artifact version. The added VERSION scenario defines namespace and refusal timing while this change fixes the runtime gap. This is an unpublished candidate: public fixed runtime122/source94/plugin122 do not contain the protection. Task 2.1 has reproducible failure tests; fixed delivery material for 2.2 and complete acceptance 2.3 remain open.

## Data and control flow

```mermaid
flowchart TD
    Artifact[Artifact and versioned references] --> Bind[One SHA256 per assetId and version]
    History[Historical plans and durable task outcomes] --> Check[Check logical namespace]
    Bind --> Check
    Check -->|input conflict| Reject[Reject before registration and budget allocation]
    Check -->|valid inputs| Execute[Execute or reuse normally]
    Execute --> Verify[Verify files and formats]
    Verify --> Commit[Recheck version history in write transaction]
    Commit -->|output conflict| Fail[Preserve files and fail without publishing outputs]
    Commit -->|consistent| Ready[Publish technical readiness]
```

## Implementation and use

`src/protocol/artifact_versions.ts` checks the artifact, sourceRefs, nativeProjectRef, renditions, dependencies, lossReportRef and evidenceRefs. Repeated identity/version references can share a digest; different content requires a new version. Relocation does not change identity. JSON array keys avoid concatenation collisions.

`src/harness/task_ledger.ts` checks inputs and historical outputs inside SQLite write transactions. Workflows use ownerId and workflowId as their namespace, shared across revisions and authorization scopes. Standalone tasks use callerId and projectKey. History includes frozen plans, node records and durable task outcomes, so replacing a node summary cannot erase a published version. Input refusal precedes new budget and task registration. Output publication checks prevent concurrent producers from assigning different contents to one version. Existing tables are reused without initialization or migration; contradictory legacy history is preserved and refused, including replay of frozen revisions.

`src/harness/local_runner.ts` retains the supported artifact_version_conflict code. Other verification failures retain artifact_invalid. A failed task with confirmed stop evidence releases its lease without publishing failed outputs. Unknown-execution recovery rules remain unchanged.

On a conflict, compare the current content with the registered digest. Intended content changes need a new artifact version and plan revision. Changing authorization, retrying, or rewriting old delivery files cannot resolve the conflict. Ordinary Art skill imports derive versions from content hashes; changed files naturally receive new versions. Callers submitting public protocol objects must also preserve immutable versions.

## Evidence and state

[Candidate evidence](evidence/artifact-version-candidate-20261008.json) binds 17 target RED/GREEN tests, complete runtime regression, a four-domain native mixed workflow, real concurrent output conflicts and two public Node CLI refusals with ledger/file preservation. It proves candidate code, not a fixed release or installation in the Python skill. Procedural graphics and test audio do not establish creative or human acceptance.

Next, fix a new runtime, independent skill source and plugin release, then verify installed public entry points and independent cold starts before closing the delivery gap in 2.2. Complete JPEG, PNG, WAV, dynamic sequence, exact time and consumer matrices remain under 2.3. History queries scan the logical project; long-lived large-ledger performance is not claimed.
