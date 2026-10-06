# ArtCraft installed deadline acceptance

Plugin dev.46 / independent source dev.34 / runtime dev.45. A single installed recover skill is copied alone to `.agents/skills`. Its public bootstrap installs Node, ArtCraft and the selected EffectCraft domain into an empty runtime, with no archive/cache overrides. The following workflow reuses that new runtime; installation time is explicitly outside the four-second execution deadline.

A two-node plan starts a 1280×720, 24 fps native render with a long enough composition to remain active. The test observes the actual EffectCraft render before the deadline. No manual cancel command is sent. On expiry, the supervisor terminates the process group, records close and confirmed group stop, then settles cancellation and releases the lease. The dependent consumer is cancelled without a task ID or native spawn.

Only one task and one native spawn are recorded; no outcome is published. Attempt identity and the shared budget account remain unchanged. Repeating the same frozen plan after expiry remains cancelled and does not replay. Original/copy skill bytes are preserved; all 58 installed skills match the fixed host lock.

One live test passes in 25.845 seconds. Independent source regression: 66 passed, 16 skipped. [Evidence](evidence/codex-artcraft46-deadline-first-use-20261006.json). Reproduce in the independent skill repository using `CRAFT_DEADLINE_FIRST_USE=1`, `CRAFT_INSTALLED_RECOVER_SKILL` as the actual installed recover directory and optionally a fresh `CRAFT_DEADLINE_EVIDENCE` output; run `python3 -B -m unittest discover -s tests -p test_deadline_first_use.py`.

The composition duration is a cancellation fixture, not a delivered hour-long video. This verifies execution deadline after setup, not installation within four seconds. It does not establish worker-crash recovery, model/GUI dispatch or creative acceptance. Full AC-TX-003 task 5.9 remains open; only bounded deadline supplement 5.15 is complete.
