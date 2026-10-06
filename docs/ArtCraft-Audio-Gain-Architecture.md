# ArtCraft Mixed-Project Audio Gain Architecture and Acceptance

Candidate source dev.35 retains runtime dev.45 and pins FilmCraft source dev.7. Fixed installed-plugin verification is pending. AC-DM-004-GAIN is authoritative; complete V1 acceptance remains open.

The old FilmCraft dev.6 workflow rejected mixer.setStrip. A real old-dependency test created four native projects, then failed the gain revision with unsupported_command in 51.625 seconds while reusing all three upstream tasks. Only the FilmCraft domain bundle changes. Its complete public Git ZIP has SHA-256 1ae806e216fc9fe794bd65fc791c055dbaa62c57ba8155cd4fc7d2e5dad94405, 468688 bytes and 198 files. All ten ArtCraft skills carry the same distribution lock.

```mermaid
flowchart LR
    V[VectorCraft Logo] --> P[PhotoCraft poster]
    V --> E[EffectCraft intro]
    E --> F[FilmCraft original film]
    F --> G[Save static A1 gain revision]
    G --> A[Decode audio acceptance]
    P --> R[Reuse poster task]
    E --> S[Reuse intro task]
```

Bind the previous native project digest and sourceProject, mark the intro asset binding retained and preserve packaged audio. Only explicit A tracks and finite volumeDb are supported. Do not regenerate upstream assets or voices. Repeated identical revisions reuse tasks and budget.

The candidate artcraft-cli-revise skill copied alone into an isolated .agents/skills publicly installs Node, runtime and four domains into an empty directory. One real test passed in 47.927 seconds, checking decoded -6 dB RMS ratio, four native projects, three upstream task IDs, original files/clip identities/captions/previews and repeat preservation. [Candidate evidence](evidence/audio-gain-mixed-candidate.json). Default source regression: 66 passes and 17 explicit skips; skips are not acceptance.

Multiple-track mixing, automation, GUI, model dispatch and complete creative acceptance remain unverified. Fixed installed-release evidence is recorded separately. Jianying uses its own independent plugin outside ArtCraft adaptation.
