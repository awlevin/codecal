# claude-calendar

A weekly, hour-by-hour calendar of the [Claude Code](https://claude.com/claude-code) sessions you ran on this machine.

```bash
npx github:awlevin/claude-calendar
```

That is the whole setup. It serves <http://localhost:4317> and opens it. No install, no dependencies, no config, no account. Node 18 or newer is the only requirement.

## Why

Claude Code already writes a full transcript of every session to `~/.claude/projects/`. The data to answer "when did I actually work today, and on what" is sitting on your disk. This draws it as a calendar.

It answers questions like:

- When did I really start and stop today?
- How much of yesterday was three agents running at once?
- Which repo ate Tuesday?
- What was that session on Thursday afternoon, and how do I resume it?

Everything is read locally. Nothing is uploaded, and no transcript content leaves the machine.

## What you get

- **Week view**, seven days by hour, with a live now-line.
- **A block per stretch of work**, colored by repo and worktree, laid out side by side when sessions overlap.
- **Two totals.** Wall clock counts overlapping sessions once, so it is time you spent. Session time sums every block, so it is work that got done. On a day of parallel agents the second is much larger than the first.
- **Session detail** on click: full span, prompt count, assistant turns, models used, token totals, every block in that session, and a ready-to-paste `claude --resume` command.
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

Low values show individual turns. High values show "I had Claude open all evening". 15 minutes is a good middle. The setting is remembered per browser.

## Controls

| Control | What it does |
| --- | --- |
| `Today`, `‹`, `›`, `←`, `→`, `T` | Move between weeks |
| Idle gap slider | Live re-merge of blocks |
| Subagents toggle | Count `Task` subagent runtime as session runtime |
| Projects menu | Show or hide individual repos and worktrees |
| Click a block | Open the session detail panel |
| `Esc` | Close the detail panel |

## Options

```bash
npx github:awlevin/claude-calendar --port 5000   # serve somewhere else
npx github:awlevin/claude-calendar --no-open     # do not open a browser
npx github:awlevin/claude-calendar --help
```

Run it from a clone instead:

```bash
git clone https://github.com/awlevin/claude-calendar.git
cd claude-calendar
node bin/claude-calendar.mjs
```

## How it reads your transcripts

| Source | Becomes |
| --- | --- |
| Any timestamped record in `<session>.jsonl` | An activity point |
| A `turn_duration` record | A real span, so one long tool call still reads as runtime |
| `<session>/subagents/*.jsonl` | Subagent runtime, credited to the parent session |
| Custom title, then AI title, then first prompt | The block label |
| `cwd` and `gitBranch` | The project color and the detail panel |

Points and spans are fused into intervals at index time, then merged into blocks in the browser at whatever idle gap you pick. A full pass over ~800 transcript files takes about a second.

Transcript formats change between Claude Code releases. If a week looks empty or wrong, the format probably moved; open an issue with your Claude Code version.

## License

MIT
