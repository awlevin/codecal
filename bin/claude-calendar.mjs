#!/usr/bin/env node
/**
 * claude-calendar — a weekly calendar view of local Claude Code sessions.
 *
 * Reads ~/.claude/projects/<project>/<session>.jsonl transcripts, turns each
 * session's timestamped records into activity intervals, and serves them to a
 * browser calendar that merges intervals with a live-adjustable idle gap.
 */
import { createServer } from "node:http";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

const PROJECTS_DIR = join(homedir(), ".claude", "projects");
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Intervals closer together than this are fused during indexing. */
const INDEX_FUSE_MS = 20_000;
/** Re-scan the transcript tree at most this often. */
const INDEX_TTL_MS = 15_000;

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(name);
}
function option(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

if (flag("--help") || flag("-h")) {
  console.log(`claude-calendar — a weekly calendar of your Claude Code sessions

Usage: claude-calendar [options]

  --port <n>   Port to serve on (default 4317, or $PORT)
  --no-open    Do not open a browser
  --help       Show this message`);
  process.exit(0);
}

function toMs(value) {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function textOf(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object" && part.type === "text") {
        return String(part.text ?? "");
      }
    }
  }
  return "";
}

function cleanPrompt(raw) {
  return raw
    .replace(/<[^>]*>[\s\S]*?<\/[^>]*>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuse(intervals, gapMs) {
  if (intervals.length === 0) {
    return [];
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const out = [intervals[0].slice()];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = out[out.length - 1];
    if (cur[0] - last[1] <= gapMs) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      out.push(cur.slice());
    }
  }
  return out;
}

/** Splits a cwd into a stable repo label and an optional worktree name. */
function describeCwd(cwd, dirName) {
  const path = cwd ?? dirName.replace(/^-/, "/").replace(/-/g, "/");
  const marker = "/.claude/worktrees/";
  if (path.includes(marker)) {
    const [base, rest] = path.split(marker);
    const repo = basename(base ?? "") || "unknown";
    const worktree = (rest ?? "").split("/")[0] ?? null;
    return { repo, worktree, project: worktree ? `${repo} ⑂ ${worktree}` : repo };
  }
  const repo = basename(path) || "unknown";
  return { repo, worktree: null, project: repo };
}

function readJsonl(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line) {
      continue;
    }
    try {
      rows.push(JSON.parse(line));
    } catch {
      // A partially flushed final line is expected on live sessions.
    }
  }
  return rows;
}

function collectIntervals(rows, into) {
  for (const row of rows) {
    const ms = toMs(row.timestamp);
    if (ms === null) {
      continue;
    }
    if (row.type === "system" && row.subtype === "turn_duration" && typeof row.durationMs === "number") {
      into.push([ms - Math.max(0, row.durationMs), ms]);
    } else {
      into.push([ms, ms]);
    }
  }
}

function indexSessionFile(dirPath, dirName, fileName) {
  const file = join(dirPath, fileName);
  const id = fileName.replace(/\.jsonl$/, "").replace(/\.orphaned-.*$/, "");
  const rows = readJsonl(file);
  if (rows.length === 0) {
    return null;
  }

  const main = [];
  const sub = [];
  const models = {};
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let prompts = 0;
  let assistantTurns = 0;
  let cwd = null;
  let branch = null;
  let customTitle = null;
  let aiTitle = null;
  let agentName = null;
  let firstPrompt = null;
  let costUSD = null;

  collectIntervals(rows, main);

  for (const row of rows) {
    if (typeof row.cwd === "string") {
      cwd = row.cwd;
    }
    if (typeof row.gitBranch === "string") {
      branch = row.gitBranch;
    }
    switch (row.type) {
      case "custom-title":
        customTitle = row.customTitle ?? customTitle;
        break;
      case "ai-title":
        aiTitle = row.aiTitle ?? aiTitle;
        break;
      case "agent-name":
        agentName = row.agentName ?? agentName;
        break;
      case "cost-state":
        if (typeof row.totalCostUSD === "number") {
          costUSD = row.totalCostUSD;
        }
        break;
      case "assistant": {
        assistantTurns++;
        const model = row.message?.model;
        if (typeof model === "string") {
          models[model] = (models[model] ?? 0) + 1;
        }
        const usage = row.message?.usage;
        if (usage) {
          tokens.input += usage.input_tokens ?? 0;
          tokens.output += usage.output_tokens ?? 0;
          tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
          tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0;
        }
        break;
      }
      case "user": {
        if (row.origin?.kind === "human" && row.isMeta !== true) {
          prompts++;
          if (firstPrompt === null) {
            const text = cleanPrompt(textOf(row.message?.content));
            if (text.length > 3) {
              firstPrompt = text.slice(0, 90);
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  const titleFile = join(dirPath, id, "custom-title.json");
  if (existsSync(titleFile)) {
    try {
      customTitle = JSON.parse(readFileSync(titleFile, "utf8")).customTitle ?? customTitle;
    } catch {
      // Ignore a malformed sidecar title.
    }
  }

  const subagentsDir = join(dirPath, id, "subagents");
  if (existsSync(subagentsDir)) {
    for (const agentFile of readdirSync(subagentsDir)) {
      if (agentFile.endsWith(".jsonl")) {
        collectIntervals(readJsonl(join(subagentsDir, agentFile)), sub);
      }
    }
  }

  const mainFused = fuse(main, INDEX_FUSE_MS);
  const subFused = fuse(sub, INDEX_FUSE_MS);
  if (mainFused.length === 0 && subFused.length === 0) {
    return null;
  }

  const { repo, worktree, project } = describeCwd(cwd, dirName);
  const bounds = [...mainFused, ...subFused];
  let start = Infinity;
  let end = -Infinity;
  for (const [s, e] of bounds) {
    start = Math.min(start, s);
    end = Math.max(end, e);
  }

  return {
    id,
    file,
    project,
    repo,
    worktree,
    cwd,
    branch,
    title: customTitle || aiTitle || agentName || firstPrompt || "Untitled session",
    main: mainFused,
    sub: subFused,
    prompts,
    assistantTurns,
    models,
    tokens,
    costUSD,
    start,
    end,
  };
}

function buildIndex() {
  const sessions = [];
  let dirs = [];
  try {
    dirs = readdirSync(PROJECTS_DIR);
  } catch {
    return { sessions, scannedAt: Date.now() };
  }
  for (const dirName of dirs) {
    const dirPath = join(PROJECTS_DIR, dirName);
    let stat;
    try {
      stat = statSync(dirPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }
    for (const fileName of readdirSync(dirPath)) {
      if (!fileName.endsWith(".jsonl")) {
        continue;
      }
      const session = indexSessionFile(dirPath, dirName, fileName);
      if (session) {
        sessions.push(session);
      }
    }
  }
  // Orphaned shards share a session id; fold them into one entry.
  const byId = new Map();
  for (const session of sessions.sort((a, b) => a.start - b.start)) {
    const existing = byId.get(session.id);
    if (!existing) {
      byId.set(session.id, session);
      continue;
    }
    existing.main = fuse([...existing.main, ...session.main], INDEX_FUSE_MS);
    existing.sub = fuse([...existing.sub, ...session.sub], INDEX_FUSE_MS);
    existing.prompts += session.prompts;
    existing.assistantTurns += session.assistantTurns;
    existing.start = Math.min(existing.start, session.start);
    existing.end = Math.max(existing.end, session.end);
  }
  return { sessions: [...byId.values()], scannedAt: Date.now() };
}

let cache = null;

function getIndex(force) {
  if (force || cache === null || Date.now() - cache.scannedAt > INDEX_TTL_MS) {
    const started = Date.now();
    cache = buildIndex();
    console.log(`indexed ${cache.sessions.length} sessions in ${Date.now() - started}ms`);
  }
  return cache;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/sessions") {
    const index = getIndex(url.searchParams.get("refresh") === "1");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ scannedAt: index.scannedAt, sessions: index.sessions }));
    return;
  }
  const name = url.pathname === "/" ? "index.html" : basename(url.pathname);
  const asset = join(PUBLIC_DIR, name);
  if (!existsSync(asset)) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": MIME[extname(asset)] ?? "application/octet-stream" });
  response.end(readFileSync(asset));
});

function openBrowser(url) {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(command, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
}

const port = Number(option("--port", process.env.PORT ?? 4317));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`port ${port} is busy — already running? try --port ${port + 1}`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  if (!existsSync(PROJECTS_DIR)) {
    console.log(`no Claude Code transcripts found at ${PROJECTS_DIR} — the calendar will be empty`);
  }
  getIndex(true);
  console.log(`claude-calendar → ${url}`);
  if (!flag("--no-open")) {
    openBrowser(url);
  }
});
