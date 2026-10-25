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
- **Owner**: the agent that currently holds a task.
- **Stale agent**: an agent that has not run any command with its agent ID for `stale_minutes`
  (30 by default, set in `team/config.json`). Its tasks can be taken over by other agents.
- **The user**: the human. The user runs commands with the literal agent ID `user`.
- **Views**: `team/BOARD.md`, `team/MESSAGES.md`, `team/DECISIONS.md`, `team/DISCOVERIES.md`, and
  `team/QUESTIONS.md`. The tool rewrites them after every change; they are for reading only.

What is in `team/`:
- `team/team.py`: the command you run. Usually a small launcher (a "shim") that finds and runs the
  shared tool in the workspace; in a standalone project it is the whole tool.
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
`team/` by hand (the one exception is `team/PLAN.md`, under the conditions in "Rules"). The tool
takes a lock for every change, which is what makes it safe for several agents to act at the same
moment; a file you edit yourself skips that lock.

## Identity

1. Run `python3 team/team.py join --label "<your tool name>"` (for example `--label "Codex"`).
   If your tool shows you a session ID, you may join with `--agent <that ID>` instead (letters,
   digits, `.`, `_` and `-`, up to 64 characters).
2. The tool prints `You are <ID>. Pass --agent <ID> on every command.` Write that ID down where you
   will keep seeing it (your notes or task list).
3. Pass `--agent <ID>` on every later command. Alternatively, you may set the environment variable
   `TEAM_AGENT=<ID>` for your commands, if your tool keeps environment variables between commands.
   When in doubt, pass `--agent` explicitly.
4. Never use another agent's ID, even one that looks unused.
5. If you lose your ID, run `join` again and use the new ID. Your old ID will go stale and its task
   will be taken over through the normal stale path (see "Stale agents"). Do not try to guess or
   reuse the old one.

Every command that carries `--agent` also counts as a sign of life for that agent. That is the
only heartbeat; there is no separate "I am alive" command.

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
   2. run `python3 team/team.py stale`; if a stale or left agent owns a live task, take it with
      `reclaim` (see "Stale agents") and continue at step 7;
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
12. Go back to step 3.
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
- Never edit a file registered to another live task. To find out who owns a path, run
  `python3 team/team.py owner "<path>"`.
- Register paths relative to the project folder (for example `src/app.py`). The tool stores an
  absolute path inside the project in that same form, so two spellings of one file still collide;
  a path outside the project stays absolute.
- Never edit the view files (`BOARD.md`, `MESSAGES.md`, `DECISIONS.md`, `DISCOVERIES.md`,
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
- A task in `review` no longer holds its paths, so another task may claim and change them. If
  `owner "<path>"` names another live task, review only the changes the `done` note describes, and
  say so in the review note.
- Approve: `python3 team/team.py review <T> --agent <ID> --approve --note "..."` moves the task to
  `done`.
- Reject: `python3 team/team.py review <T> --agent <ID> --reject --note "what is wrong"` sends it
  back to `available` with the note attached as a handoff, and tells the old owner.

Staying alive:
- While working, run any command with `--agent` at least every 10 minutes (for example
  `python3 team/team.py status --agent <ID>`), so you are not marked stale.
- Before a step that may take longer than 10 minutes (a long build or test run), tell the others
  and state how long you expect it to take:
  `python3 team/team.py msg --agent <ID> --to all --kind info --text "T004: running the full
  build, expected to take about 25 minutes"`.

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
- Before you `reclaim`, read that owner's recent messages in `team/MESSAGES.md`. If they announced
  a long step and its stated duration has not yet passed, do not reclaim; choose other work.
- `python3 team/team.py reclaim <T> --agent <ID>` is the only way to take a task that another
  agent owns. It works only if that owner has left or is stale; otherwise it is refused.
- `reclaim` prints the previous owner's handoff note (if any) and the last 10 log entries of the
  task. Read them, and look at the current state of the task's registered paths, before
  continuing. Do not redo work the log says is finished.
- If a command tells you that your task was reclaimed from you, stop working on it: someone else
  owns it now. Go back to step 3 of the loop.

## Project finished

- `python3 team/team.py complete` prints `COMPLETE` only when at least one task exists, every task
  is `done`, and `team/PLAN.md` has no unchecked box (`- [ ]`) in its `## Definition of done`
  section. Otherwise it prints what remains.
- When every task is done, the last agent checks each Definition-of-done item. For each item that
  is truly met, it logs the edit with `decide` and then ticks the box (`- [ ]` becomes `- [x]`) in
  `team/PLAN.md`. An item that is not met becomes a new task (`add`) or a `question`, not a ticked
  box.
- When `complete` prints `COMPLETE`, tell the user, run `leave`, and stop.

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
- 3 = the team lock is busy (another agent is mid-change); wait a moment and retry. Every command
  takes the lock for a moment, read commands too (to refresh the views and to record the sign of
  life of `--agent`), so any command can exit 3.

`--agent <ID>` may be replaced by the `TEAM_AGENT` environment variable. The read commands `show`,
`status`, `stale`, `owner`, `skills`, `complete`, and `doctor` take an optional `--agent <ID>`;
passing it counts as a sign of life (`next` always needs it). `python3 team/team.py --help` prints
one line per command.

Unread messages: after any command that carries your agent ID (except `join`, `inbox`, and the ID
`user`), the tool prints one last line, `N unread message(s): team.py inbox --agent <ID>`, when you
have messages you have not read yet (the same ones `inbox` would print). It does not change the
exit code. Run `inbox` and the line goes away.

Setup and identity:
- `init [--standalone]` — create or refresh `team/` in the current folder; re-copies this file and
  the launcher, never overwrites `PLAN.md`, `config.json`, or state; `--standalone` copies the whole
  tool for projects outside a workspace. Exit 2: never. Exit 1 if the new launcher cannot reach the
  tool (then use `--standalone`).
- `join [--agent <ID>] [--label "<text>"]` — register as a new agent and print your ID. Exit 2: the
  requested ID belongs to an active agent.
- `leave --agent <ID>` — mark yourself as left. Exit 2: you still own a claimed, in-progress, or
  blocked task (run `handoff` first).

Tasks:
- `add --agent <ID> --title "<text>" --desc "<text>" [--files "<path>" ...] [--depends <T> ...]
  [--priority 1|2|3] [--no-review]` — create a task (review required unless `--no-review`); prints
  its ID. Exit 2: only the unknown-agent rule.
- `next --agent <ID>` — list tasks you can claim now, best first, then tasks awaiting review by
  someone other than their owner. Exit 2: only the unknown-agent rule.
- `show <T> [--agent <ID>]` — print one task in full, including its registered paths, handoff, and
  log; with `--agent`, counts as a sign of life. Exit 2: only the unknown-agent rule.
- `status [--agent <ID>]` — print the board; with `--agent`, also your unread message count (and
  counts as a sign of life). Exit 2: only the unknown-agent rule.
- `claim <T> --agent <ID>` — take an available task; prints it, including any handoff note.
  Exit 2: the task is not `available`, a dependency is not `done`, or one of its registered paths
  overlaps a path of a live task. An unknown task ID is exit 1.
- `start <T> --agent <ID>` — move your claimed task to `in_progress`. Exit 2: you are not the owner,
  or the task is not in a state that allows this.
- `files add <T> --agent <ID> "<path>" ...` — register more paths on your task. Exit 2: you are not
  the owner, or a path overlaps another live task.
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
- `reclaim <T> --agent <ID>` — take over a task whose owner has left or is stale; prints the old
  handoff and the last 10 log entries. Exit 2: the owner is still active and not stale, or the task
  is not in a state that allows this. An unknown task ID is exit 1.
- `complete [--agent <ID>]` — print `COMPLETE` when the project is finished (see "Project
  finished"). Exit 2: the project is not finished (the output says what remains), or the unknown-agent
  rule.
- `check-exit --agent <ID>` — run it before `leave`: prints `OK to leave: no live task owned by
  <ID>` when you own no `claimed`, `in_progress`, or `blocked` task. Changes nothing (it only counts
  as a sign of life). Exit 2: you still own one or more live tasks (the reason lists them and names
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

Messages and records:
- `msg --agent <ID> --to all|<agent ID> --kind finding|question|warning|request|handoff|review|info
  --text "<text>" [--task <T>]` — send a message to one agent or to all. Exit 2: `--to user`
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
