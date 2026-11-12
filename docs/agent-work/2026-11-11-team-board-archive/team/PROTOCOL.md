# Team protocol

This file tells any coding agent (from any vendor) how to work in this project as one member of a
team of agents. It is the same in every project that uses the team tool. Read all of it before you
run your first command. A human opening the project folder can read it too: it explains every
file in `team/` and every command.

Words used below:
- **Agent**: one working session of a coding tool. Each agent has its own **agent ID** (for
  example `agent-3f2a`), printed when it joins.
- **Task**: one unit of work listed in `team/tasks/`. Each task has an ID (`T001`, `T002`, ...), a
  title, a description, a priority (1 is highest, 3 is lowest), optional dependencies (tasks that
  must be finished first), and **registered paths**: the files and folders the task is allowed to
  change.
- **Task states**: `available` (nobody has it), `claimed` (an agent has taken it), `in_progress`
  (the agent has started), `blocked` (waiting on an answer), `review` (finished, awaiting review),
  `done` (complete). A **live task** is one that is `claimed`, `in_progress`, or `blocked`.
- **Path reservations**: registered paths block overlapping claims while a task is `claimed`,
  `in_progress`, `blocked`, or `review`. Review is not live work, but its paths stay reserved until
  the reviewer approves or rejects it.
- **Owner**: the agent that currently holds a task.
- **Stale agent**: an agent that has not run an activity-recording command with its agent ID for `stale_minutes`
  (30 by default, set in `team/config.json`). Its tasks can be taken over by other agents.
- **Coordinator**: an agent that joined with `join --role coordinator`. It watches the board, is
  told when a question, review, block, or handoff needs attention, and may take any task over from
  a live owner. Workers are every other agent.
- **Busy**: a short promise that you are in a long step. `busy` keeps you from being called stale
  until the time you gave is up (see "Staying current").
- **The user**: the human. The user runs commands with the literal agent ID `user`.
- **Views**: `team/BOARD.md`, `team/BOARD.html` (a picture of the same board for a person, see
  "Coordinating a team"), `team/MESSAGES.md`, `team/DECISIONS.md`, `team/DISCOVERIES.md`, and
  `team/QUESTIONS.md`. The tool rewrites them after every change (read-only commands such as `show`
  and `owner` leave them alone); they are for reading only.

What is in `team/`:
- `team/team.py`: the command you run. It is usually a small launcher pinned to the kit used by
  `init`; for an in-kit project it keeps a relative path, and for an external project it keeps the
  kit path needed to reach the shared tool. A standalone project has the whole tool here.
- `team/PROTOCOL.md` (this file), `team/PLAN.md` (the project plan), `team/config.json` (settings).
- `team/tasks/`, `team/agents/`, `team/questions/` (one JSON file per task, agent, and question)
  and `team/messages.jsonl`, `team/decisions.jsonl`, `team/discoveries.jsonl` (one line per
  entry): the real state. The views above are generated from these.
- `team/.lock`: exists only for the split second a command is changing state; it makes changes
  happen one at a time. A leftover lock older than `lock_stale_seconds` is cleared automatically
  by the next command; `team/.lock.break` is a short-lived guard used while clearing one (ignore
  it), and a `team/.lock.broken.<random>` file is a cleared lock that a crashed command left
  behind and can be ignored.

## Startup sentence

When you are told **"Join the project and start working."**, do this: read this file
(`team/PROTOCOL.md`), then follow the loop below until the project is finished or you must stop.

Every command in this file is run from the project folder (the folder that contains `team/`) as:

```
python3 team/team.py <command> ...
```

The tool needs Python 3 and nothing else. Run the commands; do not create or edit files inside
`team/` by hand (the one exception is `team/PLAN.md`, under the conditions in "Rules"). State
changes are serialized by a lock. `status` is a read-only snapshot and does not use the lock.

## Identity

1. Run `python3 team/team.py join --label "<your tool name>"` (for example `--label "Codex"`).
   If your tool shows you a session ID, you may join with `--agent <that ID>` instead (letters,
   digits, `.`, `_` and `-`, up to 64 characters).
2. The tool prints `You are <ID>. Pass --agent <ID> on agent commands.` Write that ID down where you
   will keep seeing it (your notes or task list).
3. Pass `--agent <ID>` on agent commands. Alternatively, you may set the environment variable
   `TEAM_AGENT=<ID>` for commands that support it, if your tool keeps environment variables between
   commands. When in doubt, pass `--agent` explicitly.
4. Never use another agent's ID, even one that looks unused.
5. If you lose your ID, run `join` again and use the new ID. Your old ID will go stale and its task
   will be taken over through the normal stale path (see "Stale agents"). Do not try to guess or
   reuse the old one.

`status` is read-only: it does not acquire the lock, rewrite views, or update an agent's activity
timestamp. Supported work commands record activity. For an explicit check-in without changing task
state, run `python3 team/team.py next --agent <ID>`; it shows claimable and review work and records
activity. Before a long step with no commands in it, use `busy` (see "Staying current"). Do not
invent any other heartbeat command.

## The loop

Follow these 13 steps in order. `<ID>` is your agent ID; `<T>` is a task ID. Whenever a command
exits with code 2 (refused by the team rules), read its one-line reason and run the command it
names; do not work around it.

1. Read this file, `team/PROTOCOL.md`.
2. Read `team/PLAN.md` (the goal, scope, and rules of the project; the single source of truth)
   and `team/BOARD.md` (who is doing what right now). If the board has no tasks at all:
   - if `team/PLAN.md` is still the unfilled template (its Goal section is empty or still the
     placeholder), run `question` asking the user to fill in `team/PLAN.md`, then `leave`;
   - otherwise the breakdown begins with
     `python3 team/team.py decide --agent <ID> --title "Initial task breakdown" --text "..."`
     (exactly that title). If it succeeds, you are the first agent: break the plan into tasks with
     `add`, one task per independently verifiable piece, each with its `--files` and, where one
     piece needs another first, `--depends`. Then continue at step 3. If it exits with code 2,
     another agent is already doing the breakdown: add no tasks. Check `inbox` and
     `status --agent <ID>` until that agent's tasks appear, then continue at step 3 (`next`).
     Never add a second breakdown.
3. Read your messages: `python3 team/team.py inbox --agent <ID>`. If you own a `blocked` task,
   check whether its question has been answered (see "Rules", blocked tasks).
4. See what you can do: `python3 team/team.py next --agent <ID>`. It lists the tasks you can claim
   right now (available, all dependencies done, no file overlap with live tasks), best first, then
   the tasks waiting for review by someone other than their owner.
5. Choose the highest-priority task you are able to do. If a task is waiting for review and you are
   not its owner, prefer reviewing it: run `review` on it (see "Rules", review) instead of steps 6
   to 11, then go to step 12. If `next` lists nothing you can claim, go through these in order and
   stop at the first that applies:
   1. it lists tasks in `review` that you do not own: review one, then go to step 12;
   2. `next` also ends with a list "Tasks you can take over (owner stale or left)", each with a
      ready `reclaim` command; if it lists one, take it with `reclaim` (see "Stale agents") and
      continue at step 7 (`python3 team/team.py stale` shows the same owners);
   3. run `python3 team/team.py complete`; if it prints `COMPLETE`, tell the user the project is
      finished and run `leave`;
   4. otherwise nothing is available to you. Run `question` only if something blocks the whole
      team. Tell the user what is waiting (tasks in `review` that need the user, blocked tasks,
      dependencies owned by other agents), then run `leave`.
   Never loop or sit waiting and polling for work to appear.
6. Take the task: `python3 team/team.py claim <T> --agent <ID>`. If it exits with code 2, someone
   else got it first or it is not ready: read the reason and go back to step 4. If the output
   contains a handoff note from a previous owner, read it fully before doing anything else.
7. Start it: `python3 team/team.py start <T> --agent <ID>`. Check `python3 team/team.py skills`
   first and use any skill that fits the task. Then change only the task's registered paths
   (`python3 team/team.py show <T>` lists them). Before you touch any other path, register it with
   `python3 team/team.py files add <T> --agent <ID> "<path>"`; if that exits with code 2, the path
   belongs to another live task, so do not touch it.
8. While working, record what others need to know:
   - `python3 team/team.py discover --agent <ID> --text "..." [--path "<path>"]` for a
     non-obvious fact about the code;
   - `python3 team/team.py decide --agent <ID> --title "..." --text "..."` for a choice other agents
     must follow;
   - `python3 team/team.py question --agent <ID> --text "..." [--task <T>]` for something only the
     user can answer; if you cannot continue without the answer, run
     `python3 team/team.py block <T> --agent <ID> --reason "..."` instead (it opens the question
     for you) and see "Rules", blocked tasks;
   - `python3 team/team.py msg --agent <ID> --to <agent or all> --kind <kind> --text "..."` to
     tell other agents something.
9. Verify the work the way the task description says, and the way the "How to verify" section of
   `team/PLAN.md` says. Do not mark a task done that you have not verified.
10. If your change affects other agents (a shared file, an interface, a rule), tell them:
    `python3 team/team.py msg --agent <ID> --to <their ID> ...` or `--to all`.
11. Finish it: `python3 team/team.py done <T> --agent <ID> --note "what changed and how it was
    verified"`. A task that requires review goes to `review`; otherwise it goes to `done`.
12. If your tool shows how much of your usage or context is used, report it:
    `python3 team/team.py usage --agent <ID> --percent <n> --note "..."`. Then go back to step 3.
13. Before you stop for any reason, run
    `python3 team/team.py handoff <T> --agent <ID> --note "..."` for every live task you own
    (`claimed`, `in_progress`, or `blocked`). End each note with one line per registered path, in
    the form `<path>: committed | clean | uncommitted edits` (see "The limit rule"). Then run
    `python3 team/team.py check-exit --agent <ID>`; it prints `OK to leave` only when you own no live
    task, and otherwise lists the tasks still to hand off. Then run
    `python3 team/team.py leave --agent <ID>`. Your tasks in `review` need nothing more from you.

## The limit rule

When you are close to any limit (usage, context window, time, money, or any other reason you will
have to stop), stop starting new work and do this at once:

1. Run `python3 team/team.py handoff <T> --agent <ID> --note "..."` for every live task you own
   (`claimed`, `in_progress`, or `blocked`; use `--note-file "<file>"` instead of `--note` for a
   long note). Tasks you own that are in `review` need nothing. Each note must say:
   - what is done;
   - what is next, as the first concrete action;
   - exact pointers: file paths and line numbers;
   - what not to redo (finished or verified parts);
   - the state of each registered path, as the last lines of the note, one line per path in the
     form `<path>: committed | clean | uncommitted edits`. Write `committed` if you committed the
     path, `clean` if you left it untouched, and `uncommitted edits` if changes to it sit in the
     working tree, so the next owner knows whether half-written edits are already on disk.
2. Run `python3 team/team.py check-exit --agent <ID>`. It prints `OK to leave` when you own no live
   task; otherwise it exits with code 2 and names the tasks you still have to hand off.
3. Run `python3 team/team.py leave --agent <ID>`.

If your tool shows how much usage or context is left, report it first with
`python3 team/team.py usage --agent <ID> --percent <n> --note "..."` so the person watching the
board can see why you stopped. Always report it before a handoff.

Each task goes back to `available` with your note attached, and the next agent that claims it sees
the note. This per-task handoff is separate from a project-wide `HANDOFF.md` file that some
projects keep: that file describes the whole project, while unfinished task state always goes
through the `handoff` command.

## Rules

Plan:
- Follow `team/PLAN.md`. Do not redesign the project on your own.
- To change the goal, scope, or approach, run `propose` and wait for the user to answer. Never edit
  `team/PLAN.md` silently.
- The only edits an agent makes to `team/PLAN.md` are mechanical ones (ticking a
  Definition-of-done box, or applying a proposal the user approved), and each one is logged first
  with `decide`. The user may edit it at any time.
- Run `decide` before any architectural choice another agent must follow.
- Run `discover` for any fact about the code that is not obvious and that another agent would
  otherwise have to rediscover.
- Tasks cannot be deleted. To cancel a task that is no longer needed, log why with `decide`, then
  `claim` it if it is `available` and run `done <T> --agent <ID> --note "not needed"`. A task that
  requires review then goes to `review`, and another agent or the user approves it.

Files:
- Never edit a file reserved by another task. Reservations include tasks in `review`, even though
  they are not live work. To find out who owns a path, run
  `python3 team/team.py owner "<path>"`.
- Register paths relative to the project folder (for example `src/app.py`). Inside the project the tool stores paths relative to the project root,
  including when you supply an absolute name. Outside paths stay absolute.
- Register exact files or the narrowest necessary directories. Do not use wildcard paths for new
  reservations; broad and pattern-based claims are hard to audit, even if overlap checking
  understands them.
- Never edit the view files (`BOARD.md`, `BOARD.html`, `MESSAGES.md`, `DECISIONS.md`, `DISCOVERIES.md`,
  `QUESTIONS.md`) or the files under `team/tasks/`, `team/agents/`, `team/questions/`, or the
  `.jsonl` logs. Only the tool writes them.

Blocked tasks:
- After `block`, the task stays yours. You may claim other work in the meantime.
- On each pass through the loop, check whether the question was answered: `show <T>` or
  `team/QUESTIONS.md` shows the resolution, and the user's answer also reaches you as a message in
  `inbox`.
- When it is answered, run `python3 team/team.py unblock <T> --agent <ID>` and continue the task.
- Before you leave, `handoff` it like any other live task.
- A blocked task that is handed off, released, or reclaimed keeps its question open, and its next
  owner holds it as `claimed`, not `blocked`. That owner reads the question in
  `team/QUESTIONS.md`, waits for the answer (or records one with `resolve` if it has it), and then
  runs `start`, not `unblock`.

Review:
- A task created with review required (the default, `review_default` in `team/config.json`) goes to
  `review` when its owner runs `done`. Only a different agent or the user can approve it; the owner
  cannot review their own task.
- The reviewer reads the changes to the task's registered paths (for example with `git diff --
  "<path>"` when the project is a git repository) and runs the verification the task names.
- A task keeps its registered path reservations while in `review`. Approval or rejection releases
  them; do not alter its files while the review is pending. A reviewer must be someone other than
  the task owner. Check the submitted changes and run the named verification before deciding.
- Approve: `python3 team/team.py review <T> --agent <ID> --approve --note "..."` moves the task to
  `done`.
- Reject: `python3 team/team.py review <T> --agent <ID> --reject --note "what is wrong"` sends it
  back to `available` with the note attached as a handoff, and tells the old owner.

Staying current:
- Staleness is based on the last activity-recording command. `status` is read-only and never counts
  as a check-in, even with `--agent`. While working, use the supported check-in when needed:
  `python3 team/team.py next --agent <ID>`. It displays available/review work and records activity.
- Before a step that may take longer than 10 minutes (a long build or test run), run
  `python3 team/team.py busy --agent <ID> --minutes <N> --text "T004: running the full build"`.
  It tells everyone and stops you from being called stale until those minutes pass (at most
  `busy_max_minutes` in `team/config.json`, 120 by default). Run any command, such as `next`, when
  the step ends. A coordinator or the user can still take your task at once.
- Report your usage with `usage --agent <ID> --percent <n> --note "..."` whenever your tool shows
  it. The figure is self-reported; the board shows "not reported" until you do.

Skills (shared procedures):
- Before starting work, run `python3 team/team.py skills` and use any skill that fits the task. It
  lists the project's `.agents/skills/` and, when the project sits inside a workspace that has
  one, the workspace's `.agents/skills/` too.
- To share a procedure with the team, write it as `.agents/skills/<id>/SKILL.md` in the project
  (frontmatter with exactly `name` and `description`; the body ends with the sections
  `Exit criteria` and `When uncertain`), then run
  `python3 team/team.py skill register <id> --agent <ID>`.

Talking to the user:
- To reach the user, run `question`. Do not use `msg` for the user; the user reads
  `team/QUESTIONS.md`, not an inbox (`msg --to user` is refused).
- To reach the coordinator, run `msg --to coordinator ...`; every active coordinator gets it. With
  no coordinator it is refused, and you use `question` instead.
- Coordinators are told automatically when anyone opens a question, blocks, proposes a plan change,
  sends a task to review, or hands off or releases a task. You do not need to message them about
  those. After any command, up to three unread direct messages are printed in full under the
  unread line.
- The user answers with `python3 team/team.py resolve <Q> --agent user --text "..."`. The view
  files are regenerated after every command and are never edited by hand, so an answer typed into
  `QUESTIONS.md` is lost.

Commits:
- If `team/config.json` has `"git_commit": false` (the default), do not commit.
- If it has `"git_commit": true` and the project is a git repository, commit only your task's
  registered paths: first `git add -- "<path>" ...`, then
  `git commit -m "<T>: <summary>" -- "<path>" ...`. If git reports that `index.lock` exists,
  another agent is committing; wait a few seconds and retry.

## Stale agents

- `python3 team/team.py stale` lists agents that have not run a command for `stale_minutes`, and
  the live tasks they still own.
- An owner who ran `busy` is not stale until its time is up, so `stale`, `next`, and `reclaim` do
  not offer its task. You no longer need to read messages to find out.
- `python3 team/team.py reclaim <T> --agent <ID>` is the only way to take a task that another
  agent owns. For an ordinary agent it works only if that owner has left or is stale; otherwise it
  is refused. A coordinator or the user may take a task from an active owner at any time (the
  log says "override"). The old owner is told.
- `python3 team/team.py reclaim <T> --agent <ID> --release` does not take the task: it returns it to
  `available` with no owner and a note warning of uncommitted edits. Anyone may do it for a stale or
  left owner; a coordinator or the user may do it always.
- `reclaim` prints the previous owner's handoff note (if any) and the last 10 log entries of the
  task. Read them, and look at the current state of the task's registered paths, before
  continuing. Do not redo work the log says is finished.
- If a command tells you that your task was reclaimed from you, stop working on it: someone else
  owns it now. Go back to step 3 of the loop.

## Project finished

- `python3 team/team.py complete` prints `COMPLETE` only when at least one task exists, every task
  is `done`, and `team/PLAN.md` has exactly one non-empty `## Definition of done` section with at
  least one real checkbox criterion, no malformed or placeholder criteria, and no unchecked box
  (`- [ ]`). Otherwise it prints the remaining tasks or plan problems.
- When every task is done, the last agent checks each Definition-of-done item against evidence. For
  each item that is truly met, it logs the edit with `decide` and then ticks the box (`- [ ]` becomes
  `- [x]`) in `team/PLAN.md`. An item that is not met becomes a new task (`add`) or a `question`, not
  a ticked box. An empty board, missing/duplicate/empty Definition of done, or template/unchecked
  criterion cannot pass `complete`.
- When `complete` prints `COMPLETE`, tell the user, run `leave`, and stop.

## Task worktrees (optional)

Off by default. In a git project, set `"worktrees": true` in `team/config.json` and each task gets
its own working copy, so one agent's half-done edits cannot trip over another's.

- **Turn on.** Edit `team/config.json`. The project folder must be the top of its git repository,
  on a branch with at least one commit, and git must not track any file under `team/` (the tool
  adds `/team/` to `.git/info/exclude` for you). Otherwise `claim` is refused with the reason.
- **Where.** `claim` (and `reclaim`) creates the folder `team/worktrees/<T>` on a branch named
  `team/<T>` and prints both the folder and the exact `team.py` command to run. Work and commit
  only inside that folder, and run team commands with the printed path. Absolute paths inside the
  folder are understood by `owner` and `files add`.
- **Handoff.** `handoff` leaves the folder and any edits in it for the next owner, who gets the
  same folder when they claim or reclaim the task.
- **Finish.** `done` is refused while the worktree has uncommitted edits: commit them there first.
- **Review.** The project folder shows no change until approval. A reviewer reads the work with
  the `git diff <base>...team/<T>` line that `show` prints (for example
  `git diff main...team/T003`), not with a plain `git diff`.
- **Approval merges.** Approving (or `done` on a task that needs no review) merges `team/<T>` into
  the base branch, which must be the branch checked out in the project folder, then removes the
  folder and the branch. If the merge hits a conflict, the tool undoes the merge, keeps the task in
  `review`, and refuses: reject the task with a note so the owner can fix the branch. If git
  refuses the merge because the project folder has uncommitted edits, commit or stash them and
  approve again.
- **Timing.** Each git call is cut off after 15 seconds. A claim runs several git calls and holds
  the lock while it does, and a lock older than 20 seconds is treated as stale, so on a very slow
  disk or a huge repository a claim can fail or collide with another command. Run `claim` again.
- **Searching.** Every worktree holds a full copy of the project under `team/worktrees/`, so a
  plain recursive `grep -r` from the project folder also lists those copies. Search inside
  `src/` (or exclude `team/worktrees`), and keep test runners from scanning `team/`.

## Solo mode

One agent alone follows the same loop. Tasks that require review wait in `review` because the
owner cannot approve its own work, and a task that depends on one of them cannot be claimed until
it is approved. For a solo project, set `"review_default": false` in `team/config.json` before
tasks are added (it applies to new tasks), or have the user approve (or reject) each one:

```
python3 team/team.py review <T> --agent user --approve --note "checked"
```

The user can also add tasks (`add --agent user ...`) and answer questions
(`resolve <Q> --agent user --text "..."`) the same way.

## Coordinating a team

The coordinator is the person or session that prepares the plan, creates tasks, starts worker chats,
and tracks the board. This is optional workflow guidance; the kit does not start agents or schedule
work. The simplest setup is to open one chat per worker and give each the startup sentence above.
Choose any coding tool or model that can read the project and run its commands.

- Give each worker a short brief containing the task ID, goal, registered paths, constraints, and
  verification command. Ask it to follow this protocol.
- Start a separate reviewer chat for tasks in `review`, or review them yourself. The owner cannot
  approve its own task.
- Join with `join --role coordinator`. Workers never wait: they run the loop and hand off. The
  coordinator can sit in its chat and run `python3 team/team.py wait --agent <ID>` in the
  background; it prints what is already waiting, then returns with lines starting `NEW:` when a
  question, review, stale owner, high usage report, or direct message appears (or `NOTHING NEW`
  after `--timeout` seconds, 1500 by default).
- For the person, `team/BOARD.html` is a picture of the board: one lane per agent, a "Needs you"
  strip, each agent's reported usage, and a detail panel for any task. Double-click it to open it in
  a browser; it reloads itself every 5 seconds and shows STALE without any command being run. To
  be alerted on a Mac, run `python3 team/team.py watch` in a terminal: it plays a sound and shows a
  banner for each new item. Banners need a one-time setup, which `watch` prints when it starts.
- Use `status` to inspect progress. If a worker needs an explicit activity check-in, it can run
  `next --agent <ID>`; there is no automatic monitor or scheduler.
- At a natural stopping point, have the worker hand off unfinished work and open another chat only
  when useful.

### When one session spawns the agents (this workspace)

A coordinator session that writes the plan, adds tasks, and spawns worker and reviewer agents is
usually the most expensive model in the room, so it should do the least typing. The 2026-11-02
workflow retro measured coordinators running for days at 300k-760k tokens of context, mostly on
bookkeeping. Five rules follow from that:

- **Compact at wave boundaries.** When a wave of tasks is approved, write `HANDOFF.md`, then end the
  turn telling the user to compact or open a new session before the next wave. A coordinator cannot
  compact itself; it has to ask.
- **A clerk does the bookkeeping.** `claim`, `show`, `review`, `msg`, `inbox` and reading `status`
  go to a Sonnet sub-agent that returns at most ten lines. The coordinator itself runs `team.py`
  only for `add`, `decide` and `resolve`.
- **One reviewer per batch.** When several tasks sit in `review`, spawn one reviewer agent for all of
  them (up to five), not one per task. Every spawned agent costs about 60k tokens before it reads a
  single task.
- **Sonnet workers by default.** Use Opus for a worker only when `pick-model` says so or after a
  Sonnet rejection, and give every worker brief a cap: hand off after about 40 tool calls if not done.
- **Recurring checks keep one ID.** A scheduled check (for example an hourly Codex check) re-joins
  with a fixed ID: `join --agent codex-hourly --label "Codex hourly check"`. A fresh ID per run adds
  a dead agent row every hour.
- **Wait instead of polling.** Run `wait --agent <ID>` in the background between waves instead of
  reading `status` on a timer; it returns when something needs you.

## Command reference

Run every command as `python3 team/team.py <command> ...` from the project folder. Exit codes:
- 0 = success.
- 1 = usage or validation error: wrong or missing flags, missing `--agent` on a command that
  changes anything, an unknown task ID (on any command, `--depends` included) or question ID. An
  unknown ID is a typo to fix, not a refusal.
- 2 = refused by the team rules; the printed reason names what is in the way and the command to run
  next. Any command carrying `--agent` exits 2 if that ID is unknown or has left; run `join`.
  (`join` itself and the ID `user` are exempt.) Other refusals are listed per command below. For
  `complete`, exit 2 is not a refusal: it means "not finished yet", and the output lists what
  remains.
- 3 = the team lock is busy (another agent is mid-change); wait a moment and retry. Commands that
  change state take the lock. `status` is a read-only snapshot and does not take it.

`--agent <ID>` may be replaced by the `TEAM_AGENT` environment variable where supported. Read
commands take an optional `--agent <ID>`. `status` never records activity. `next --agent <ID>` is
the supported explicit check-in: it shows available/review work and records activity.
`python3 team/team.py --help` prints one line per command.

Unread messages: after any command that carries your agent ID (except `join`, `inbox`, and the ID
`user`), the tool prints one last line, `N unread message(s): team.py inbox --agent <ID>`, when you
have messages you have not read yet (the same ones `inbox` would print). It does not change the
exit code. Run `inbox` and the line goes away.

Setup and identity:
- `init [--standalone]` — create or refresh `team/` in the current folder; re-copies this file and
  the launcher, never overwrites `PLAN.md`, `config.json`, or state; `--standalone` copies the whole
  tool for projects outside a workspace. Exit 2: never. Exit 1 if the new launcher cannot reach the
  tool (then use `--standalone`).
- `join [--agent <ID>] [--label "<text>"] [--role coordinator]` — register as a new agent and print
  your ID. `--role coordinator` makes you a coordinator. A new agent
  starts with an empty inbox (messages sent before it joined are in `team/MESSAGES.md`). Exit 2: the
  requested ID belongs to an active agent.
- `leave --agent <ID>` — mark yourself as left. Exit 2: you still own a claimed, in-progress, or
  blocked task (run `handoff` first).

Tasks:
- `add --agent <ID> --title "<text>" --desc "<text>" [--files "<path>" ...] [--depends <T> ...]
  [--priority 1|2|3] [--no-review]` — create a task (review required unless `--no-review`); prints
  its ID. Exit 2: only the unknown-agent rule.
- `next --agent <ID>` — list tasks you can claim now, best first, then tasks awaiting review by
  someone other than their owner. Exit 2: only the unknown-agent rule.
- `show <T> [--full] [--agent <ID>]` — print one task, including its registered paths, handoff, and
  log. Long log notes are cut to 240 characters (reject, review-requested and handoff notes are never
  cut); `--full` prints everything. Exit 2: only the unknown-agent rule.
- `status [--all] [--agent <ID>]` — print the board as a read-only snapshot. Agents that have left
  are hidden (a count line says how many); `--all` lists them. It never updates activity or rewrites
  views.
- `claim <T> --agent <ID>` — take an available task; prints it, including any handoff note.
  Exit 2: the task is not `available`, a dependency is not `done`, or one of its registered paths
  overlaps a reserved path (including one held by a task in `review`). An unknown task ID is exit 1.
- `start <T> --agent <ID>` — move your claimed task to `in_progress`. Exit 2: you are not the owner,
  or the task is not in a state that allows this.
- `files add <T> --agent <ID> "<path>" ...` — register more paths on your task. Exit 2: you are not
  the owner, or a path overlaps another task's reservation, including review.
- `owner "<path>" [--agent <ID>]` — print the live task and agent that own a path, or `unowned`.
  Exit 2: only the unknown-agent rule.
- `block <T> --agent <ID> --reason "<text>"` — mark your task `blocked` and open a question for the
  user. Exit 2: you are not the owner, or the task is not in a state that allows this.
- `unblock <T> --agent <ID>` — move your blocked task back to `in_progress` (resolves its question
  if still open). Exit 2: you are not the owner, or the task is not in a state that allows this.
- `done <T> --agent <ID> --note "<text>"` — finish your task: to `review` if review is required,
  else to `done`. Exit 2: you are not the owner, or the task is not in a state that allows this.
- `review <T> --agent <ID> --approve|--reject --note "<text>"` — approve (to `done`) or reject (to
  `available`, note kept as a handoff) a task in `review`. Exit 2: you are the task's owner, the
  task is not in `review`, or the reviewer has not joined (and is not `user`).
- `handoff <T> --agent <ID> --note "<text>" | --note-file "<file>"` — give up your task with a note;
  it returns to `available`. The note should end with one line per registered path,
  `<path>: committed | clean | uncommitted edits`. Exit 2: you are not the owner, or the task is not
  in a state that allows this.
- `release <T> --agent <ID>` — give up your task with the note "released". Exit 2: you are not the
  owner, or the task is not in a state that allows this.
- `stale [--agent <ID>]` — list stale or left agents and the live tasks they own. Exit 2: only the
  unknown-agent rule.
- `reclaim <T> --agent <ID> [--release]` — take over a task whose owner has left or is stale (a
  coordinator or `user` may take it from an active owner); prints the old handoff and the last 10
  log entries. With `--release` the task returns to `available` instead, with no owner. Exit 2: the
  owner is still active and not stale and you are not a coordinator or `user`, or the task is not in
  a state that allows this. An unknown task ID is exit 1.
- `complete [--agent <ID>]` — print `COMPLETE` when the project is finished (see "Project
  finished"). Exit 2: the project is not finished (the output says what remains), or the unknown-agent
  rule.
- `check-exit --agent <ID>` — run it before `leave`: prints `OK to leave: no live task owned by
  <ID>` when you own no `claimed`, `in_progress`, or `blocked` task. Changes no task state. Exit 2:
  you still own one or more live tasks (the reason lists them and names
  the `handoff` command to run), or the unknown-agent rule. A user may wire it into a tool-specific
  stop hook if that tool has one; the tool itself does not do that.
- `doctor [--agent <ID>] [--fix-views]` — read-only check of `team/`; prints `OK` when it finds
  nothing wrong, otherwise one `problem:` line per finding. It checks that every task file reads and
  has its required keys, every live task has an active owner (or `user`), no two live tasks register
  overlapping paths, every `depends_on` names a task and there is no dependency cycle, each agent's
  current task is owned by that agent, message IDs run 1..N in order, every question's task exists,
  and the view files are present. A stale `.lock` or `.lock.break` is a `warning:` line only and does
  not change the exit code. It changes nothing, not even the view files, unless `--fix-views` is
  given, which rewrites the views. Exit 2: at least one problem was found, or the unknown-agent
  rule.

Usage, waiting and watching:
- `usage --agent <ID> [--percent 0-100] [--note "<text>"]` — record your self-reported usage; shown
  on the board, and 80 percent or more (`usage_warn_percent`) is listed as needing attention. Exit 1:
  neither flag given, or the percent is outside 0 to 100.
- `busy --agent <ID> --minutes <N> --text "<text>"` — say you are in a long step; you are not
  called stale for N minutes and everyone is told. Exit 1: N is below 1 or above `busy_max_minutes`.
- `wait --agent <ID> [--timeout <seconds>] [--interval <seconds>]` — block until something new
  needs attention or a message arrives for you or all, then print it as `NEW: ...` and exit 0; after
  the timeout print `NOTHING NEW`. For coordinators. It never takes the lock except a brief
  check-in. Exit 2: the unknown-agent rule.
- `watch [--interval <seconds>] [--once] [--no-notify]` — print each new thing that needs attention
  and, on macOS, play a sound and show a banner (`--no-notify` turns both off). Banners need
  Script Editor to be allowed to notify once and do not show during Do Not Disturb; the sound
  needs nothing. For a person, in a terminal; stop with Ctrl-C. Needs no agent ID.

Messages and records:
- `msg --agent <ID> --to all|coordinator|<agent ID> --kind finding|question|warning|request|handoff|review|info
  --text "<text>" [--task <T>]` — send a message to one agent, to `coordinator`, or to all. Exit 2: `--to user`
  (use `question` instead), or `--to` names an unknown agent.
- `inbox --agent <ID> [--peek]` — print your new messages, oldest first, and mark them read
  (`--peek` leaves them unread). Exit 2: only the unknown-agent rule.
- `decide --agent <ID> --title "<text>" --text "<text>"` — log a decision in `DECISIONS.md` and
  announce it to all. Exit 2: a decision with the same title already exists (the reason names who
  decided it and when), or the unknown-agent rule.
- `discover --agent <ID> --text "<text>" [--path "<path>"]` — log a codebase fact in
  `DISCOVERIES.md`. Exit 2: only the unknown-agent rule.
- `question --agent <ID> --text "<text>" [--task <T>]` — ask the user; appears in `QUESTIONS.md`,
  and the user answers with `resolve`. Exit 2: only the unknown-agent rule.
- `resolve <Q> --agent <ID> --text "<text>"` — record the answer to a question (usually
  `--agent user`); the asker gets a message only when it is a joined agent (not `user`). Exit 2:
  only the unknown-agent rule. An unknown question ID, or one already resolved, is exit 1.
- `propose --agent <ID> --title "<text>" --text "<text>"` — propose a change to `PLAN.md`; opens a
  question for the user and announces it to all. Exit 2: only the unknown-agent rule.

Skills:
- `skills [--agent <ID>]` — list shared skills (the project's `.agents/skills/` and, inside a
  workspace, the workspace's). Exit 2: only the unknown-agent rule.
- `skill register <id> --agent <ID>` — check `.agents/skills/<id>/SKILL.md` in the project and
  announce it as a decision. Exit 2: the skill fails the check (folder name differs from `name`,
  frontmatter keys other than `name` and `description`, or a missing `Exit criteria` or
  `When uncertain` section); the reason is printed.
