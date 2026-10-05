# ArtCraft public protocol implementation status

The active OpenSpec change remains the normative authority. Strict protocol fields and dependency-graph checks are implemented. The ledger and local supervisor are partly implemented; full scheduling, independent skills and host installation remain pending.

## Components and execution

| Component | Location | Implemented behavior |
| :--- | :--- | :--- |
| Task schema | [craft-task/v1](../schemas/craft-task-v1.json) | Strict core fields, runtime identity, authorization reference and explicit budget |
| Artifact schema | [craft-artifact/v1](../schemas/craft-artifact-v1.json) | Immutable version references, relative locations, rational timing and packaging fields |
| Validator | [contracts.ts](../src/protocol/contracts.ts) | Field validation, canonical plan hash, actual file digest/size and supported file signatures |
| Dependency graph | [dependency_graph.ts](../src/protocol/dependency_graph.ts) | Topological ordering, cycle/missing-node rejection and transitive invalidation |
| Tests | [protocol.test.ts](../test/protocol.test.ts) | Positive and boundary tests without domain render execution |

Node.js 24+ runs the TypeScript using built-in type stripping. No npm dependencies are downloaded.

```bash
npm test
```

## Field decisions

Runtime identity uses `pluginId`, `pluginVersion`, `cliVersion`, `sha256`, `mode` and `capabilitySnapshotSha256`. Mode is `headless` or `bridge`. Schema validation does not prove runtime discovery; adapters must verify actual versions and capabilities.

Budget uses `currency`, `maxMinorUnits`, `maxRevisions` and `maxExternalCalls`. Limits are nonnegative safe integers; explicit null means unlimited. Omitted fields never imply authorization. Shared upper-bound admission is implemented in the budget ledger; provider invoice settlement remains pending.

`payload.schemaVersion` identifies the domain protocol. Domain adapters interpret additional JSON payload fields. Core and runtime fields reject unknown properties. Unsafe JSON integers are rejected; exact ticks use decimal strings and require a rational `timeBase`.

Plan hashes use locally canonicalized, key-sorted JSON and SHA-256. RFC 8785 compatibility is not claimed. Consumers must pin the implementation; task registration must bind the digest to the actual plan. Idempotent registration is now implemented in the [ledger](ArtCraft-Task-Ledger.md); complete crash recovery remains pending.

## Files and dependencies

Locations currently support relative files within the delivery root. Real-path checks reject traversal and escaping symbolic links. Streaming verification checks actual digest, size and file changes during reading.

Supported signatures are PNG, JPEG, PDF, SVG and MP4. `application/octet-stream` declares only generic bytes and does not replace domain-format verification. Other MIME types return `media_type_unsupported`. Signature checks do not prove complete decoding; domain verifiers remain responsible for native projects and media decoding.

Unpackaged dependencies require a missing reason; packaged dependencies must not have one. Current verification checks the primary file. Complete verification of renditions, native references and dependency files, plus immutable version registration, remains pending.

The graph computes transitive consumers of a changed logo while leaving independent voice valid. Callers must compare versions, hashes and output-affecting parameters before identifying changed nodes. Execution queues, project leases and cross-plugin media handoffs are not implemented by these graph functions.

## Evidence and remaining acceptance

Ten Node tests pass, covering versions, unknown fields, calendar dates, safe integers, timing, file digest/size/signature, traversal, escaping links, packaging state, cycles, missing nodes and logo invalidation.

Full protocol acceptance still requires idempotency and task-state responses, actual authorization coverage, immutable asset registration, complete referenced-file verification and real consumers in all four domains. OpenSpec tasks remain unchecked. Graph tests do not prove mixed-project delivery.
