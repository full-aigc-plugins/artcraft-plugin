# ArtCraft installed scheduler crash acceptance

Fixed plugin dev.44, skill source dev.33, runtime dev.41. The installed `artcraft-cli-recover` is copied alone to `.agents/skills`. A fresh runtime installs public Node, ArtCraft and EffectCraft dependencies, with all archive/cache overrides excluded.

A four-second 640×360, 24 fps intro is scheduled using the normal workflow entry. The test observes a running execution through a read-only SQLite connection, identifies the exact scheduler as a child of its own workflow process with the same database argument, and sends SIGKILL only to that scheduler. It waits for durable `stopped`, `group_stopped=1`, zero-exit evidence from the independent worker; PID disappearance alone is never treated as success.

The public workflow entry then reopens the same project. Task ID, attempt ID, token, epoch and command identity stay bound; one native spawn event is retained and the budget account does not change. The result is technical `review_ready`. Existing ffprobe counts 96 actual video frames. Repeating the workflow reuses the same task and leaves all delivery hashes unchanged. Copied skill and original installed bytes are preserved; all ten installed ArtCraft skill hashes match the fixed host lock.

One live test passed in 22.932 seconds. Source regression: 66 passed, 14 skipped; plugin regression: 53 passed, four skipped. [Evidence](evidence/codex-artcraft44-scheduler-crash-first-use-20261006.json). Reproduce in the skill repository with existing ffprobe and `CRAFT_SCHEDULER_CRASH_FIRST_USE=1`, `CRAFT_INSTALLED_RECOVER_SKILL` set to the actual installed recover skill directory; optionally set a fresh `CRAFT_SCHEDULER_CRASH_EVIDENCE` path. Run `python3 -B -m unittest discover -s tests -p test_scheduler_crash_first_use.py`.

This is scheduler-crash recovery while the independent worker survives. Worker crash, unknown submission window, concurrent recoverers, model dispatch, GUI and creative acceptance remain unverified by this test. It does not claim the entire specification is complete.
