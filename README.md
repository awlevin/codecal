# codecal

A weekly, hour-by-hour calendar of the coding-agent sessions you ran on this machine. Reads [Claude Code](https://claude.com/claude-code) transcripts and [Codex](https://developers.openai.com/codex) rollouts, and draws both on one grid.

```bash
npx github:awlevin/codecal
```

That is the whole setup. It serves <http://localhost:4317> and opens it. No install, no dependencies, no config, no account. Node 18 or newer is the only requirement.

## Why

Both tools already write a full transcript of every session to disk: Claude Code in `~/.claude/projects/`, Codex in `~/.codex/sessions/`. The data to answer "when did I actually work today, and on what" is already there. This draws it as a calendar.

It answers questions like:

- When did I really start and stop today?
- How much of yesterday was three agents running at once?
- Which repo ate Tuesday?
- Am I spending more time in Claude Code or in Codex?
- What was that session on Thursday afternoon, and how do I resume it?

Everything is read locally. Nothing is uploaded, and no transcript content leaves the machine.

## What you get

- **Week view**, seven days by hour, with a live now-line.
- **A block per stretch of work**, colored by repo and worktree, laid out side by side when sessions overlap. Codex blocks are striped, Claude Code blocks are solid.
- **Both sources, or either one.** Header toggles show the session count per source for the week.
- **Two totals.** Wall clock counts overlapping sessions once, so it is time you spent. Session time sums every block, so it is work that got done. On a day of parallel agents the second is much larger than the first.
- **Session detail** on click: full span, prompt count, assistant turns, models used, token totals, every block in that session, the transcript path, and a ready-to-paste resume command.
- **Live refresh.** The index rebuilds every 30 seconds, so a session you start while the page is open shows up on its own.

## The idle gap

A session is a stream of events, not a solid block. If you read a diff for ten minutes before replying, the transcript has a ten minute hole that was really one continuous stretch of work. Draw it literally and the calendar turns into confetti.

The **Idle gap** slider in the header sets how long a pause must be before one block breaks in two. Drag it and the calendar re-merges immediately, so you can see the shape of your day at different resolutions.

On a typical week of mine:

| Idle gap | Blocks | Wall clock |
| --- | --- | --- |
| 1 min | 314 | 13h 29m |
| 15 min (default) | 171 | 19h 47m |
| 120 min | 41 | 72h 02m |

Low values show individual turns. High values show "I had an agent open all evening". 15 minutes is a good middle. The setting is remembered per browser.

## Controls

| Control | What it does |
| --- | --- |
| `Today`, `‹`, `›`, `←`, `→`, `T` | Move between weeks |
| Idle gap slider | Live re-merge of blocks |
| Subagents toggle | Count subagent runtime as session runtime |
| Claude / Codex toggles | Show one source or both |
| Projects menu | Show or hide individual repos and worktrees |
| Click a block | Open the session detail panel |
| `Esc` | Close the detail panel |

## Options

```bash
npx github:awlevin/codecal --port 5000   # serve somewhere else
npx github:awlevin/codecal --no-open     # do not open a browser
npx github:awlevin/codecal --no-codex    # Claude Code only
npx github:awlevin/codecal --no-claude   # Codex only
npx github:awlevin/codecal --no-cache    # force a full re-read
npx github:awlevin/codecal --help
```

Run it from a clone instead:

```bash
git clone https://github.com/awlevin/codecal.git
cd codecal
node bin/codecal.mjs
```

## How it reads your transcripts

| Source | Read from | Becomes |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/<session>.jsonl` | An activity point per timestamped record |
| Claude Code | `turn_duration` records | A real span, so one long tool call still reads as runtime |
| Claude Code | `<session>/subagents/*.jsonl` | Subagent runtime, credited to the parent session |
| Codex | `~/.codex/sessions/**` and `~/.codex/archived_sessions/**` | An activity point per rollout record |
| Codex | `session_meta`, `turn_context`, `event_msg` | Working directory, model, prompts, token totals |
| Both | Session title, then the first typed prompt | The block label |
| Both | Working directory | The project color and the detail panel |

Points and spans are fused into intervals at index time, then merged into blocks in the browser at whatever idle gap you pick.

Bulk parsing is skipped for the largest records, which carry bytes rather than metadata, and every file is cached in `~/.cache/codecal/` by size and mtime. A cold pass over ~2.5 GB of transcripts takes about ten seconds; after that a re-index is well under a second, since only changed files are re-read.

## What it cannot see

ChatGPT web conversations. Those live on OpenAI's servers, not on your disk, so there is nothing local to read. Only the Codex CLI and Codex Desktop write rollouts locally, and those are what this reads.

Transcript formats also change between releases of both tools. If a week looks empty or wrong, the format probably moved; open an issue with your Claude Code or Codex version.

## License

MIT
