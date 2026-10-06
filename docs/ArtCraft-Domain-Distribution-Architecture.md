# ArtCraft domain distribution upgrade

Candidate standalone skills dev.49 pin runtime distribution dev.73, FilmCraft skills dev.14 and the other three domain skills dev.13. Each Art skill carries its own lock and installer. Public downloads verify archive and file digests, runtime versions and native CLI identities. Existing locks, artifacts and release tags remain immutable.

```mermaid
flowchart LR
 A[One loaded Art skill] --> B[dev.73 distribution lock]
 B --> C[Pinned Node and Art CLI]
 B --> D[Four immutable domain skill tags]
 D --> E[Native CLI and protocol client]
 C --> F[Dependency and budget ledger]
 E --> F
 F --> G[Native child projects and exports]
 G --> H[Reopen checks and portable package]
```

The domain bundles preserve complete Git release ZIP bytes. Art uses archives without an outer directory, published under distinct filenames from the domains' existing prefixed user-install archives. No existing asset is overwritten. The builder reads immutable tags, verifies each file and excludes working-tree changes.

The domain clients detect malformed, non-object, missing/ambiguous and nonfinite responses, broken pipes and invalid tool content. Uncertain requests must not be replayed automatically. Preserve native projects, failure receipts and the ledger, then inspect actual state. Complete command helpers are included; their presence does not establish arbitrary Art planning support.

Acceptance requires ten independent empty-runtime installs of all domains, real mixed creation and dependent Logo revisions, fault stopping and no replay, portable delivery, immutable skill vendoring and actual installed-host checks. OpenSpec task 4.7 closes only after its matching evidence passes. Exhaustive commands, GUI, model dispatch and creative approval remain separately tracked.
