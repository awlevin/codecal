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
  { title: "fix flaky auth test", project: 0, day: 0, start: 9.5, bursts: 5 },
  { title: "port dashboard to v2", project: 1, day: 0, start: 13.2, bursts: 6 },
  { title: "review PR #482", project: 0, day: 0, start: 16.4, bursts: 3 },
  { title: "debug webhook retries", project: 2, day: 1, start: 9.9, bursts: 6 },
  { title: "write the billing migration", project: 1, day: 1, start: 11.1, bursts: 5 },
  { title: "profile the slow query", project: 3, day: 1, start: 15.0, bursts: 4 },
  { title: "refactor the queue worker", project: 0, day: 2, start: 10.4, bursts: 7 },
  { title: "chase a memory leak", project: 2, day: 2, start: 14.2, bursts: 5 },
  { title: "rewrite onboarding copy", project: 4, day: 2, start: 17.1, bursts: 3 },
  { title: "add retries to the importer", project: 1, day: 3, start: 9.2, bursts: 6 },
  { title: "split the settings route", project: 3, day: 3, start: 11.8, bursts: 5 },
  { title: "upgrade the build pipeline", project: 0, day: 3, start: 15.3, bursts: 6 },
  { title: "trace the 500s in checkout", project: 2, day: 4, start: 9.6, bursts: 7 },
  { title: "design the empty state", project: 4, day: 4, start: 13.0, bursts: 4 },
  { title: "tune the cache headers", project: 1, day: 4, start: 16.2, bursts: 5 },
  { title: "prep the release notes", project: 3, day: 5, start: 11.0, bursts: 4 },
  { title: "clean up dead flags", project: 0, day: 5, start: 14.6, bursts: 5 },
  { title: "sketch the weekly digest", project: 4, day: 6, start: 12.4, bursts: 4 },
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
