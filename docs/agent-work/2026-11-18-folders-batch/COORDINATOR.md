# Folders batch -- coordinator checkpoint

Coordinator board ID: agent-4969 (session of 2026-11-18). Plan: PLAN.md. Board map: BOARD-MAP.md.

Owner's limits (2026-11-18): at most 1 Haiku, 2 Sonnet and 1 Opus sub-agent running at any time, until the batch is done. Reviews are Opus. No commits, no native screen runs without his word.

Intended order:
- Opus slot: FB12 (T330) first, then a batch review of whatever is in review, then FB4 (T322), reviews, FB5 (T323), reviews. Never idle; reviews come before new work.
- Sonnet slots: FB1 (T319) and FB3 (T321) first; then FB2 (T320), FB8, FB9, FB10, FB11; later FB13, FB14.
- Haiku slot: FB7 (T325), FB6 (T324), then whatever small task is open.

If this session dies: run `python3 team/team.py status`; tasks in claimed/in_progress with a stale owner are handed back with `stale`; each task's notes file under notes/ says how far it got.
