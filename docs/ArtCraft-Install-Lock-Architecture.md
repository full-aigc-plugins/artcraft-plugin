# ArtCraft bounded installation lock architecture

## 1. Problem and scope

The fix replaces unbounded blocking `flock` in the Node installer and combined setup with nonblocking acquisition and a monotonic deadline. Each lock has a 120-second production budget; this is not a 120-second deadline for an entire installation or workflow. OpenSpec authority is ArtCraft `AC-RT-002-ART-INSTALL-LOCK` in the plugin repository. The same bootstrap/setup resources are synchronized to all ten independent Art skills.

This fix is published as immutable source87/plugin115; public ZIP downloads match tagged archives. Actual Codex discovery finds64 skills without loading errors. Ten changed skills pass separate empty-cache public cold installations;54 historical cases are reused only with matching complete tree hashes. The four domain installers and native editing commands are unchanged; source86/plugin114 retain their historical acceptance identities.

## 2. Coordination and failure

```mermaid
flowchart TD
 S[Public skill entry] --> N[Node installation mutex]
 N -->|acquired| V[Verify or install fixed Node]
 V --> R[Release Node mutex]
 R --> B[Combined setup mutex]
 B -->|acquired| I[Verify or install selected fixed bundles and domains]
 I --> D[Release setup mutex and return identity]
 N -->|120-second wait expires| E[runtime_install_busy]
 B -->|120-second wait expires| E
 E --> F[Own setup diagnostic; no edit replay]
```

Locks are acquired separately. An unsuccessful attempt sleeps for at most 50 milliseconds or the remaining budget. Timeout occurs before download, publication or native work under that lock and raises `TimeoutError`, which the public bootstrap reports through its existing dependency failure envelope. The installer does not decide ownership from a PID or a leftover lock file; the operating system releases flock when its owning process exits. Retry is an explicit new caller action. Existing runtime verification, source hashes, atomic publication and corruption refusal remain mandatory.

## 3. Validation boundaries

Real holder processes reproduce the baseline hang. Tests use shortened wait budgets to verify timeout, preservation of existing Node and user project files, kernel lock release after SIGKILL, reuse without an archive, waiting followed by success, and the public bootstrap's own setup diagnostic. The complete source suite runs 160 tests: 122 pass and 38 conditional tests skip. Resource synchronization also passes.

Candidate public first-use evidence is recorded separately for each copied skill, with an empty runtime, system-only PATH, public fixed Node/runtime downloads, both locks held by owned processes and owner termination. Exact Node and runtime identities plus unchanged skill hashes are checked. These version probes do not install or exercise domain creative workflows, do not substitute for actual generic Skills CLI installation, and do not close the full requirement or V1.

[Candidate evidence](evidence/art-install-lock-candidate-20261008.json): all ten skills pass, with 20 successful public version probes. Every copied skill still matches current source. Completed QA runtimes were inventoried and removed only after terminal calls and a fresh open-handle check; logs and skill copies remain. This historical evidence covers pre-release candidate bytes and does not belong to source86/plugin114; source87/plugin115 installed acceptance is recorded separately below.

Fixed installed evidence: [source87/plugin115 first use](evidence/craft-art115-install-lock-fixed-first-use-20261008.json). The copied installed skill passes public cold installation, four-domain native creation/source revisions/reuse/moved delivery and receipt refusal; all64 installed tree identities still match. Two preceding disk-full attempts remain failures; completed QA caches were inventoried and checked for open handles before cleanup, and a fresh output passed. This proves only the listed technical scope;3.16, the full4.5/4.6 contract and V1 remain open.
