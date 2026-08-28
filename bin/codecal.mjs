#!/usr/bin/env node
/**
 * codecal — a weekly calendar view of local coding-agent sessions.
 *
 * Reads the transcripts Claude Code writes to ~/.claude/projects and the
 * rollouts Codex writes to ~/.codex/sessions, turns each session's timestamped
 * records into activity intervals, and serves them to a browser calendar that
 * merges intervals with a live-adjustable idle gap.
 */
import { createServer } from "node:http";
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

const HOME = homedir();
const CLAUDE_DIR = join(HOME, ".claude", "projects");
const CODEX_DIRS = [join(HOME, ".codex", "sessions"), join(HOME, ".codex", "archived_sessions")];
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const CACHE_FILE = join(HOME, ".cache", "codecal", "index-v1.json");

/** Intervals closer together than this are fused during indexing. */
const INDEX_FUSE_MS = 20_000;
/** Re-scan the transcript trees at most this often. */
const INDEX_TTL_MS = 15_000;
/** Records longer than this are read for their timestamp only. */
const MAX_PARSE_BYTES = 200_000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

if (flag("--help") || flag("-h")) {
  console.log(`codecal — a weekly calendar of your Claude Code and Codex sessions

Usage: codecal [options]

  --port <n>     Port to serve on (default 4317, or $PORT)
  --no-open      Do not open a browser
  --no-codex     Skip Codex rollouts
  --no-claude    Skip Claude Code transcripts
  --no-cache     Ignore the on-disk index cache
  --help         Show this message`);
  process.exit(0);
}

// ---------------------------------------------------------------- helpers

function toMs(value) {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Pulls the leading `{"timestamp":"..."` off a record without parsing it. */
function leadingTimestamp(line) {
  if (!line.startsWith('{"timestamp":"')) {
    return null;
  }
  const end = line.indexOf('"', 14);
  if (end === -1) {
    return null;
  }
  const ms = Date.parse(line.slice(14, end));
  return Number.isFinite(ms) ? ms : null;
}

/** Reads the record's own `"type"` out of the head of the line. */
function leadingType(line) {
  const at = line.indexOf('"type":"', 0);
  if (at === -1 || at > 120) {
    return null;
  }
  const start = at + 8;
  const end = line.indexOf('"', start);
  return end === -1 ? null : line.slice(start, end);
}

function textOf(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object" && (part.type === "text" || part.type === "input_text")) {
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

/** Splits a working directory into a stable repo label and optional worktree. */
function describeCwd(cwd, fallbackDirName) {
  const path = cwd ?? (fallbackDirName ?? "").replace(/^-/, "/").replace(/-/g, "/");
  for (const marker of ["/.claude/worktrees/", "/.codex/worktrees/"]) {
    if (path.includes(marker)) {
      const [base, rest] = path.split(marker);
      const parts = (rest ?? "").split("/").filter(Boolean);
      // Claude names the worktree dir; Codex nests the repo under a hash.
      const repo = marker.includes("codex") ? parts[parts.length - 1] : basename(base ?? "");
      const worktree = marker.includes("codex") ? parts[0] : parts[0];
      const label = repo || "unknown";
      return { repo: label, worktree: worktree ?? null, project: worktree ? `${label} ⑂ ${worktree}` : label };
    }
  }
  const repo = basename(path) || "unknown";
  return { repo, worktree: null, project: repo };
}

function readLines(path) {
  try {
    return readFileSync(path, "utf8").split("\n");
  } catch {
    return [];
  }
}

function boundsOf(intervals) {
  let start = Infinity;
  let end = -Infinity;
  for (const [s, e] of intervals) {
    start = Math.min(start, s);
    end = Math.max(end, e);
  }
  return { start, end };
}

function walkJsonl(root, out) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      walkJsonl(path, out);
    } else if (entry.name.endsWith(".jsonl")) {
      out.push(path);
    }
  }
  return out;
}

// ------------------------------------------------------- Claude Code source

/** Timestamps sit past the message body, so oversized records are read from the tail. */
function tailTimestamp(line) {
  const match = /"timestamp":"([^"]+)"/.exec(line.slice(-2000));
  return match ? toMs(match[1]) : null;
}

function collectClaudeIntervals(lines, into) {
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.length > MAX_PARSE_BYTES) {
      const ms = tailTimestamp(line);
      if (ms !== null) {
        into.push([ms, ms]);
      }
      continue;
    }
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
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

function indexClaudeFile(path) {
  const dirPath = dirname(path);
  const dirName = basename(dirPath);
  const id = basename(path).replace(/\.jsonl$/, "").replace(/\.orphaned-.*$/, "");
  const lines = readLines(path);
  if (lines.length === 0) {
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

  for (const line of lines) {
    if (!line || line.length > MAX_PARSE_BYTES) {
      continue;
    }
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
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

  collectClaudeIntervals(lines, main);

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
        collectClaudeIntervals(readLines(join(subagentsDir, agentFile)), sub);
      }
    }
  }

  const mainFused = fuse(main, INDEX_FUSE_MS);
  const subFused = fuse(sub, INDEX_FUSE_MS);
  if (mainFused.length === 0 && subFused.length === 0) {
    return null;
  }

  const { repo, worktree, project } = describeCwd(cwd, dirName);
  const { start, end } = boundsOf([...mainFused, ...subFused]);

  return {
    source: "claude",
    id,
    file: path,
    project,
    repo,
    worktree,
    cwd,
    branch,
    client: null,
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

// -------------------------------------------------------------- Codex source

/** Digs the typed prompt out of the wrappers Codex puts around a user message. */
function codexPromptText(payload) {
  const raw = typeof payload?.message === "string" ? payload.message : textOf(payload?.content);
  const marker = "## My request for Codex:";
  const at = raw.indexOf(marker);
  const body = (at === -1 ? raw : raw.slice(at + marker.length)).trimStart();
  const isPreamble =
    body.startsWith("<") ||
    body.startsWith("# AGENTS.md instructions") ||
    body.startsWith("# Files mentioned by the user");
  if (isPreamble) {
    return null;
  }
  const text = cleanPrompt(body);
  return text.length > 3 ? text.slice(0, 90) : null;
}

/** Desktop rollouts carry the prompt as a plain response item, not an event. */
function codexTitleFallback(lines) {
  for (const line of lines) {
    if (line.length > MAX_PARSE_BYTES || !line.includes('"role":"user"')) {
      continue;
    }
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const title = codexPromptText(row.payload);
    if (title) {
      return title;
    }
  }
  return null;
}

function indexCodexFile(path) {
  const lines = readLines(path);
  if (lines.length === 0) {
    return null;
  }

  const main = [];
  const models = {};
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let prompts = 0;
  let assistantTurns = 0;
  let cwd = null;
  let client = null;
  let id = null;
  let firstPrompt = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }
    const ms = leadingTimestamp(line);
    if (ms !== null) {
      main.push([ms, ms]);
    }
    // Response items carry the bulk of the bytes and none of the metadata.
    const type = leadingType(line);
    if (type === null || type === "response_item" || line.length > MAX_PARSE_BYTES) {
      continue;
    }
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = row.payload ?? {};
    if (row.type === "session_meta") {
      id = payload.id ?? id;
      cwd = payload.cwd ?? cwd;
      client = payload.originator ?? client;
    } else if (row.type === "turn_context") {
      cwd = payload.cwd ?? cwd;
      if (typeof payload.model === "string") {
        models[payload.model] = (models[payload.model] ?? 0) + 1;
      }
    } else if (row.type === "event_msg") {
      if (payload.type === "user_message") {
        prompts++;
        firstPrompt = firstPrompt ?? codexPromptText(payload);
      } else if (payload.type === "agent_message") {
        assistantTurns++;
      } else if (payload.type === "token_count" && payload.info?.total_token_usage) {
        // Codex reports running totals, so the last one wins.
        const usage = payload.info.total_token_usage;
        tokens.input = usage.input_tokens ?? tokens.input;
        tokens.output = usage.output_tokens ?? tokens.output;
        tokens.cacheRead = usage.cached_input_tokens ?? tokens.cacheRead;
        tokens.cacheWrite = usage.cache_write_input_tokens ?? tokens.cacheWrite;
      }
    }
  }

  const mainFused = fuse(main, INDEX_FUSE_MS);
  if (mainFused.length === 0) {
    return null;
  }
  firstPrompt = firstPrompt ?? codexTitleFallback(lines);

  id = id ?? (basename(path).match(/([0-9a-f-]{36})\.jsonl$/)?.[1] ?? basename(path));
  const { repo, worktree, project } = describeCwd(cwd, null);
  const { start, end } = boundsOf(mainFused);

  return {
    source: "codex",
    id,
    file: path,
    project,
    repo,
    worktree,
    cwd,
    branch: null,
    client,
    title: firstPrompt || "Untitled session",
    main: mainFused,
    sub: [],
    prompts,
    assistantTurns,
    models,
    tokens,
    costUSD: null,
    start,
    end,
  };
}

// ------------------------------------------------------------------- index

function loadCache() {
  if (flag("--no-cache")) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(entries) {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(entries));
  } catch {
    // A cache miss next run is the only cost of failing to write.
  }
}

let cacheEntries = loadCache();

/** Cache key changes when the transcript, or a session's subagent dir, does. */
function fingerprint(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return null;
  }
  let key = `${path}|${stat.mtimeMs}|${stat.size}`;
  const subagents = join(dirname(path), basename(path).replace(/\.jsonl$/, ""), "subagents");
  try {
    key += `|${statSync(subagents).mtimeMs}`;
  } catch {
    // No subagents for this session.
  }
  return key;
}

function claudeFiles() {
  const files = [];
  let dirs = [];
  try {
    dirs = readdirSync(CLAUDE_DIR, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }
    for (const name of readdirSync(join(CLAUDE_DIR, dir.name))) {
      if (name.endsWith(".jsonl")) {
        files.push(join(CLAUDE_DIR, dir.name, name));
      }
    }
  }
  return files;
}

function buildIndex() {
  const sources = [];
  if (!flag("--no-claude")) {
    sources.push(...claudeFiles().map((path) => ({ path, index: indexClaudeFile })));
  }
  if (!flag("--no-codex")) {
    for (const root of CODEX_DIRS) {
      sources.push(...walkJsonl(root, []).map((path) => ({ path, index: indexCodexFile })));
    }
  }

  const nextCache = {};
  const sessions = [];
  for (const { path, index } of sources) {
    const key = fingerprint(path);
    if (key === null) {
      continue;
    }
    let session = Object.prototype.hasOwnProperty.call(cacheEntries, key) ? cacheEntries[key] : undefined;
    if (session === undefined) {
      try {
        session = index(path);
      } catch {
        session = null;
      }
    }
    nextCache[key] = session;
    if (session) {
      sessions.push(session);
    }
  }
  cacheEntries = nextCache;
  saveCache(nextCache);

  // Orphaned shards share a session id; fold them into one entry.
  const byId = new Map();
  for (const session of sessions.sort((a, b) => a.start - b.start)) {
    const key = `${session.source}:${session.id}`;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, { ...session });
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
    const counts = cache.sessions.reduce((acc, s) => ({ ...acc, [s.source]: (acc[s.source] ?? 0) + 1 }), {});
    const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ") || "0";
    console.log(`indexed ${summary} sessions in ${Date.now() - started}ms`);
  }
  return cache;
}

// ------------------------------------------------------------------ server

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
  if (!existsSync(CLAUDE_DIR) && !CODEX_DIRS.some(existsSync)) {
    console.log("no Claude Code or Codex transcripts found — the calendar will be empty");
  }
  getIndex(true);
  console.log(`codecal → ${url}`);
  if (!flag("--no-open")) {
    openBrowser(url);
  }
});
