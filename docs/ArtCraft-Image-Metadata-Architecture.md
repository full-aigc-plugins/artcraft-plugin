# ArtCraft derived image metadata architecture

Status: working-tree candidate; no new fixed runtime, skill source or plugin has been released for this change. The installed release remains plugin124 / source96 / runtime124. Full artifact protocol task2.3 remains open.

## Contract and use

The plugin OpenSpec `AC-CP-002-IMAGE` owns this behavior. PNG/JPEG outputs from PhotoCraft, VectorCraft and EffectCraft public workflows carry encoded raster `width`, `height`, `bitDepth` and `alpha` in `technicalMetadata`. Consumers read `nodes.<id>.outputs` in the workflow receipt; no new domain command is required.

A PNG can report `{"width":320,"height":400,"bitDepth":8,"alpha":false}`. MIME alone cannot establish an Alpha representation. JPEG reports `alpha:false`. Unknown `colorSpace` is omitted, as are inapplicable timing and audio fields.

## Data flow and failures

```mermaid
flowchart TD
    A[Fixed public domain workflow] --> B[Native project image and manifest]
    B --> C[Verify manifest and dependency digests]
    C --> D[Bounded PNG or JPEG read]
    D --> E{Parsed bytes match output digest}
    E -->|No| X[Reject public output publication]
    E -->|Yes| F[Inspect raster depth and Alpha]
    F --> G[Populate public technical metadata]
    G --> H[Recheck content references and protocol]
    H --> I[Durable workflow receipt and portable package]
    D -->|Invalid or oversized| X
    H -->|Conflict or invalid reference| X
```

The adapter reuses existing PNG/JPEG inspectors. An optional expected digest binds facts to the actual bytes inspected; ordinary artifact verification supplies it too. Existing call signatures remain compatible. Native project, source, dependency, exchange-loss and manifest references retain their existing verification path. Final public protocol verification checks declared facts against content again.

PNG CRC, chunk, decompressed scan, color and depth checks retain the 64MiB encoded / 128MiB scan limits. JPEG marker checks retain the 64MiB and supported-process boundaries. Alpha representation does not prove visible transparency. JPEG marker inspection does not prove entropy decoding, applied EXIF orientation or ICC fidelity.

## Verification and delivery gates

The target test first reproduces empty public image metadata. Tests cover three adapters, PNG, baseline/progressive/gray/CMYK JPEG fixtures, invalid contents and digest mismatch. Fixtures do not substitute for native exports.

The native mixed test uses fixed public domain packages and adds Photo JPEG and Effect PNG preview outputs. An independent decoder checks dimensions and Alpha representation. Logo revisions, native source revisions, historical preservation, reuse, moved packages and reopening remain covered. Film explicitly selects the intro video so an unused preview cannot fabricate lineage.

Candidate evidence: `docs/evidence/image-export-metadata-candidate-20261008.json`. A new immutable runtime, ten independent skill lock updates, source release, vendored plugin release and installed verification remain required. Plugin124 installation evidence cannot prove this candidate is distributed. Native large-integer timing handoff and the complete artifact protocol matrix remain open.
