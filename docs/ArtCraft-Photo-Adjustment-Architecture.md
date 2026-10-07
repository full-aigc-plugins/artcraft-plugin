# ArtCraft Photo editable adjustment and mask distribution

## Distribution contract

Keep runtime83 and pin Photo skill source19 alongside Film19, Effect19 and Vector19. Every Art skill owns its DAG, revision plan, installer and complete domain index. First use installs only the selected Photo domain. Resolve domain usageRecipes against the domain skillRoot from the install receipt. No sibling skills, native runtime changes or Jianying adapter are introduced.

```mermaid
flowchart LR
    A[Independent Art skill] --> B[Public DAG and Brief]
    B --> C[Pinned Node and runtime83]
    C --> D[Photo source19 and CLI]
    D --> E[Editable adjustment and selection mask]
    E --> F[Save reopen and pixels]
    F --> G[Trusted source revision]
    G --> H[Native child and moved package]
```

The 128×64 example preserves Product, Control and a separate brightnessContrast layer. A rectangular mask covers only the product's left half. Revise brightness30 to -30 with explicit contrast0 and legacy=false. Verify persisted mask and adjustment values, native ID inventory, control pixels and all original delivery hashes. Selection flags describe transient session state.

## Trusted revision

Read poster.root and poster.outputs[0] from the previous public workflow receipt. Bind expectedRevision to nativeProjectRef.sha256, externalInputs to [{root,artifact}] and payload.sourceProject to {assetId:artifact.assetId}. Use the skill-owned revision plan after removing its placeholder expectedProjectSha256; the trusted adapter supplies the digest. Revisionv2 creates a new task; repeating an identical completed plan reuses its taskId.

## Evidence scope

Each test copies one Art skill into .agents/skills and uses an empty runtime through public workflow.py/package.py, without injected developer archives. Verify selected-domain installation, actual native reopening, target/control pixels, preserved other layers and original delivery, and moved package verification. Source candidate, fixed installed and updated four-domain mixed acceptance remain separate. Regression:122 total,91 passed,31 optional environment skips; skips are not acceptance.

The plugin's existing OpenSpec establish-v1-plugin remains authoritative. AC-DM-002 task6.58 stays open until fixed distribution and updated mixed acceptance pass. The sample does not prove exhaustive2639 commands, PSD fidelity, GUI, model dispatch, other platforms or fullV1.
