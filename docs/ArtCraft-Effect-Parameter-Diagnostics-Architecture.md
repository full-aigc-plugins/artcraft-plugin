# ArtCraft effect parameter diagnosis architecture

## Authority and boundary

OpenSpec AC-TX-002-MAPPING owns this increment. EffectCraft source dev.7 / native CLI 0.2.0 rejects unknown fields as unsupported_mapping. ArtCraft runtime dev.48 had omitted that exact code from its closed whitelist: a single source skill cold-installed public bundles, its actual intro failed and Film was blocked, but persisted diagnosis contained a null domainCode. This is a diagnosis propagation repair, not a native engine edit.

```mermaid
flowchart LR
 A[Logo and poster native outputs] --> B[Effect intro]
 B --> C{Native parameters valid?}
 C -->|No| D[Stopped failure plus unsupported_mapping]
 D --> E[Film blocked]
 D --> F[Status and repeat preserve attempt and budget]
 C -->|Corrected revision| G[Reuse logo / poster / badge]
 G --> H[Render intro and film]
 H --> I[Five child native projects packaged and verified]
```

## Bounded diagnostics and recovery

The collector still drains complete stdout/stderr and hashes every observed byte, while parsing at most 16 KiB. Only a closed JSON object containing exactly one string error field may report an exact whitelisted prefix. unsupported_mapping_suffix, extra fields, raw text, incomplete/oversized streams and conflicting codes do not become the domain code. Persisted diagnostics carry the code, stream, hashes and completeness; native field names/text are not retained as diagnostic prose. A child report does not replace token/epoch/group-stop evidence.

The five-node first-use scenario carries one copied execute skill and a generated voice asset. It intentionally supplies an unknown effect.apply field; actual native failure blocks Film, while the prior Logo/Photo/badge files remain intact. Status returns the same diagnosis, repeat retains task/attempt/budget, and a corrected revision reuses those three nodes, produces the intro and film, and verifies a five-child package. Skill and voice hashes remain unchanged. This tests technical recovery, not creative approval.

## Distribution and evidence

Runtime candidate dev.51 adds one closed error code and retains the existing protocol. The independent Art skill lock consumes complete immutable Effect source dev.7 Git ZIP; other domain packages stay pinned. Candidate verification uses explicit local bundled runtime/archive bytes and public native downloads, so it is separate from public release acceptance.

Target runtime tests fail twice before the repair and then pass 28/28. Current full runtime regression passes 141/147 with six explicit native optional skips; the source suite passes 66/85 with nineteen explicit live skips. Actual candidate mixed acceptance passes in 35.403 seconds. [Evidence](evidence/mapping-propagation-repair-20261006.json). Immutable runtime/skill/plugin publication and installed first-use remain pending at this milestone; task 5.16 stays open. ArtCraft does not install or adapt Jianying.

Release correction: candidate dev.51 passed the scoped test, but its publication tag points to old source and is invalid provenance. Do not install dev.51. Runtime dev.52 is the replacement candidate; immutable publication and installed acceptance remain pending.
