/**
 * Synthetic sessions for the demo. Shaped like real transcripts (bursts of
 * events with pauses between them) but invented, so no private work leaks.
 */

export type Interval = [startMin: number, endMin: number];

export type DemoSession = {
  title: string;
  project: number;
  day: number;
  intervals: Interval[];
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const SEEDS: Array<{ title: string; project: number; day: number; start: number; bursts: number }> = [
  { title: "flaky auth test", project: 0, day: 0, start: 9.6, bursts: 5 },
  { title: "webhook retries", project: 2, day: 0, start: 9.9, bursts: 5 },
  { title: "dashboard v2", project: 1, day: 0, start: 13.6, bursts: 5 },
  { title: "index rebuild", project: 3, day: 0, start: 13.9, bursts: 5 },
  { title: "review PR #482", project: 0, day: 0, start: 14.0, bursts: 4 },

  { title: "billing migration", project: 1, day: 1, start: 9.4, bursts: 6 },
  { title: "slow query", project: 3, day: 1, start: 9.7, bursts: 5 },
  { title: "empty state", project: 4, day: 1, start: 13.4, bursts: 5 },
  { title: "cache headers", project: 1, day: 1, start: 13.8, bursts: 4 },

  { title: "queue worker", project: 0, day: 2, start: 10.1, bursts: 6 },
  { title: "memory leak", project: 2, day: 2, start: 10.4, bursts: 5 },
  { title: "onboarding copy", project: 4, day: 2, start: 10.8, bursts: 4 },
  { title: "dead flags", project: 0, day: 2, start: 15.1, bursts: 5 },
  { title: "snapshot tests", project: 1, day: 2, start: 15.4, bursts: 4 },

  { title: "importer retries", project: 1, day: 3, start: 9.5, bursts: 6 },
  { title: "settings route", project: 3, day: 3, start: 9.8, bursts: 5 },
  { title: "build pipeline", project: 0, day: 3, start: 15.0, bursts: 5 },
  { title: "release notes", project: 3, day: 3, start: 15.4, bursts: 4 },
  { title: "api docs", project: 4, day: 3, start: 13.2, bursts: 5 },

  { title: "checkout 500s", project: 2, day: 4, start: 9.7, bursts: 6 },
  { title: "weekly digest", project: 4, day: 4, start: 10.0, bursts: 5 },
  { title: "search ranking", project: 1, day: 4, start: 10.4, bursts: 4 },
  { title: "seed script", project: 3, day: 4, start: 14.6, bursts: 5 },
  { title: "flake quarantine", project: 0, day: 4, start: 15.0, bursts: 4 },
  { title: "perf budget", project: 2, day: 4, start: 14.9, bursts: 4 },

  { title: "docs pass", project: 4, day: 5, start: 11.2, bursts: 4 },
  { title: "upgrade deps", project: 0, day: 5, start: 11.5, bursts: 4 },

  { title: "inbox triage", project: 2, day: 6, start: 12.5, bursts: 4 },
];

export const SESSIONS: DemoSession[] = SEEDS.map((seed, index) => {
  const random = mulberry32(index * 977 + 13);
  const intervals: Interval[] = [];
  let cursor = seed.start * 60;
  for (let i = 0; i < seed.bursts; i++) {
    const run = 3 + random() * 9;
    intervals.push([cursor, cursor + run]);
    cursor += run;
    // Most pauses are short thinking gaps; a few are real breaks.
    const pause = random() < 0.62 ? 2 + random() * 7 : 14 + random() * 34;
    cursor += pause;
  }
  return { title: seed.title, project: seed.project, day: seed.day, intervals };
});

export type Group = { start: number; end: number; whole: boolean };

/**
 * Merges a session's intervals at the given idle gap. A pause fuses gradually
 * as the gap approaches its length, so blocks visibly reach for each other
 * instead of snapping together.
 */
export function groupsAt(intervals: Interval[], gapMin: number): Group[] {
  const out: Group[] = [];
  let start = intervals[0][0];
  let end = intervals[0][1];
  for (let i = 1; i < intervals.length; i++) {
    const pause = intervals[i][0] - end;
    const soften = Math.max(2, pause * 0.35);
    const fill = Math.min(1, Math.max(0, (gapMin - (pause - soften)) / soften));
    if (fill >= 1) {
      end = intervals[i][1];
      continue;
    }
    const reach = (pause * fill) / 2;
    out.push({ start, end: end + reach, whole: true });
    start = intervals[i][0] - reach;
    end = intervals[i][1];
  }
  out.push({ start, end, whole: true });
  return out;
}

export const blockCountAt = (gapMin: number) =>
  SESSIONS.reduce((total, session) => total + groupsAt(session.intervals, gapMin).length, 0);

export const activeMinutesAt = (gapMin: number) =>
  SESSIONS.reduce(
    (total, session) =>
      total + groupsAt(session.intervals, gapMin).reduce((sum, g) => sum + (g.end - g.start), 0),
    0,
  );

/** Wall clock across the week: two sessions in the same minute count once. */
export function wallClockAt(gapMin: number): number {
  const spans: Array<[number, number]> = [];
  for (const session of SESSIONS) {
    for (const group of groupsAt(session.intervals, gapMin)) {
      spans.push([session.day * 1440 + group.start, session.day * 1440 + group.end]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const span of spans) {
    if (current && span[0] <= current[1]) {
      current[1] = Math.max(current[1], span[1]);
    } else {
      if (current) {
        total += current[1] - current[0];
      }
      current = [span[0], span[1]];
    }
  }
  return current ? total + (current[1] - current[0]) : total;
}

/** The most sessions running at the same moment. */
export function peakParallelAt(gapMin: number): number {
  const edges: Array<[number, number]> = [];
  for (const session of SESSIONS) {
    for (const group of groupsAt(session.intervals, gapMin)) {
      edges.push([session.day * 1440 + group.start, 1], [session.day * 1440 + group.end, -1]);
    }
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let running = 0;
  let peak = 0;
  for (const [, delta] of edges) {
    running += delta;
    peak = Math.max(peak, running);
  }
  return peak;
}
