import React from "react";
import { interpolate } from "remotion";
import { SESSIONS, blockCountAt, activeMinutesAt, groupsAt, wallClockAt, peakParallelAt } from "../data";
import type { DemoSession } from "../data";
import { projectColor, theme } from "../theme";
import { Wordmark } from "./Wordmark";

export const CARD = { x: 110, y: 88, w: 1700, h: 800, radius: 20 };
export const HEADER_H = 78;
const STATS_H = 46;
const DAYHEAD_H = 66;
const GUTTER = 74;
const HOUR_PX = 61;
const FIRST_HOUR = 9;
const HOURS = 10;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATES = [16, 17, 18, 19, 20, 21, 22];

const PILL_W = 116;
export const SLIDER = {
  x: CARD.x + CARD.w - 26 - PILL_W - 22 - 244,
  y: CARD.y + HEADER_H / 2,
  w: 244,
};
export const knobX = (gapMin: number) =>
  SLIDER.x + interpolate(gapMin, [1, 60], [0, SLIDER.w], { extrapolateRight: "clamp" });

type Positioned = {
  key: string;
  title: string;
  faded: boolean;
  project: number;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  span: number;
  minutes: number;
};

const overlaps = (a: Positioned, b: Positioned) =>
  a.top < b.top + b.height - 0.5 && b.top < a.top + a.height - 0.5;

/** Same laning the app uses: pack into lanes, then widen over the free ones. */
function layout(blocks: Positioned[]): Positioned[] {
  blocks.sort((a, b) => a.top - b.top || b.height - a.height);
  const lanes: Positioned[][] = [];
  for (const block of blocks) {
    let lane = lanes.findIndex((held) => !held.some((other) => overlaps(other, block)));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(block);
    block.lane = lane;
  }
  for (const block of blocks) {
    block.lanes = lanes.length;
    let span = 1;
    while (
      block.lane + span < lanes.length &&
      !lanes[block.lane + span].some((other) => overlaps(other, block))
    ) {
      span++;
    }
    block.span = span;
  }
  return blocks;
}

const fmtHours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const Calendar: React.FC<{
  gapMin: number;
  reveal: number;
  extra?: DemoSession[];
  highlight?: string;
}> = ({ gapMin, reveal, extra = [], highlight }) => {
  const gridTop = CARD.y + HEADER_H + STATS_H + DAYHEAD_H;
  const colW = (CARD.w - GUTTER) / 7;

  const perDay: Positioned[][] = DAYS.map(() => []);
  [...SESSIONS, ...extra].forEach((session, sessionIndex) => {
    groupsAt(session.intervals, gapMin).forEach((group, groupIndex) => {
      const top = ((group.start - FIRST_HOUR * 60) / 60) * HOUR_PX;
      const height = Math.max(9, ((group.end - group.start) / 60) * HOUR_PX);
      perDay[session.day].push({
        key: `${sessionIndex}-${groupIndex}`,
        title: session.title,
        project: session.project,
        top,
        height,
        lane: 0,
        lanes: 1,
        span: 1,
        faded: highlight !== undefined && session.title !== highlight,
        minutes: group.end - group.start,
      });
    });
  });
  perDay.forEach(layout);

  const blocks = blockCountAt(gapMin);
  const active = activeMinutesAt(gapMin);
  const wall = wallClockAt(gapMin);
  const peak = peakParallelAt(gapMin);

  return (
    <div
      style={{
        position: "absolute",
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        borderRadius: CARD.radius,
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        boxShadow: "0 40px 120px rgba(0,0,0,.6)",
        overflow: "hidden",
        fontFamily: theme.sans,
      }}
    >
      <div style={{ height: HEADER_H, position: "relative", borderBottom: `1px solid ${theme.line}` }}>
        <div style={{ position: "absolute", left: 26, top: HEADER_H / 2, transform: "translateY(-50%)" }}>
          <Wordmark size={26} />
        </div>
        <div
          style={{
            position: "absolute",
            right: CARD.w - (SLIDER.x - CARD.x) + 18,
            top: HEADER_H / 2,
            transform: "translateY(-50%)",
            color: theme.muted,
            fontSize: 19,
            whiteSpace: "nowrap",
          }}
        >
          Idle gap
        </div>
        <div
          style={{
            position: "absolute",
            left: SLIDER.x - CARD.x,
            top: HEADER_H / 2 - 3,
            width: SLIDER.w,
            height: 6,
            borderRadius: 3,
            background: "#2b2b33",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: knobX(gapMin) - SLIDER.x,
              background: theme.accent,
              borderRadius: 3,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: knobX(gapMin) - SLIDER.x - 11,
              top: -8,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#f2f2f5",
              boxShadow: "0 3px 10px rgba(0,0,0,.6)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            right: 26,
            top: HEADER_H / 2,
            transform: "translateY(-50%)",
            width: PILL_W,
            textAlign: "center",
            padding: "7px 0",
            borderRadius: 999,
            background: theme.panelSoft,
            border: `1px solid ${theme.line}`,
            color: theme.text,
            fontSize: 19,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(gapMin)} min
        </div>
      </div>

      <div
        style={{
          height: STATS_H,
          display: "flex",
          alignItems: "center",
          gap: 30,
          padding: "0 26px",
          borderBottom: `1px solid ${theme.line}`,
          color: theme.muted,
          fontSize: 18,
        }}
      >
        <span>
          Wall clock{" "}
          <b style={{ color: theme.text, fontVariantNumeric: "tabular-nums" }}>{fmtHours(wall)}</b>
        </span>
        <span>
          Session time{" "}
          <b style={{ color: theme.text, fontVariantNumeric: "tabular-nums" }}>{fmtHours(active)}</b>
        </span>
        <span>
          Multiplier{" "}
          <b style={{ color: theme.text, fontVariantNumeric: "tabular-nums" }}>
            {(active / Math.max(1, wall)).toFixed(1)}×
          </b>
        </span>
        <span>
          Peak parallel <b style={{ color: theme.text }}>{peak}×</b>
        </span>
        <span>
          Blocks <b style={{ color: theme.text, fontVariantNumeric: "tabular-nums" }}>{blocks}</b>
        </span>
      </div>

      <div style={{ display: "flex", height: DAYHEAD_H, borderBottom: `1px solid ${theme.line}` }}>
        <div style={{ width: GUTTER }} />
        {DAYS.map((day, i) => (
          <div key={day} style={{ width: colW, textAlign: "center", paddingTop: 9, borderLeft: `1px solid ${theme.lineSoft}` }}>
            <div style={{ color: theme.muted, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" }}>{day}</div>
            <div style={{ color: theme.text, fontSize: 24, marginTop: 2 }}>{DATES[i]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", height: HOURS * HOUR_PX, position: "relative" }}>
        <div style={{ width: GUTTER, position: "relative" }}>
          {Array.from({ length: HOURS }).map((_, h) => {
            const hour = FIRST_HOUR + h;
            const label = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
            return (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: h * HOUR_PX - 8,
                  right: 12,
                  color: theme.muted,
                  fontSize: 13,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
        {DAYS.map((day, i) => (
          <div key={day} style={{ width: colW, position: "relative", borderLeft: `1px solid ${theme.lineSoft}` }}>
            {Array.from({ length: HOURS }).map((_, h) => (
              <div key={h} style={{ position: "absolute", top: h * HOUR_PX, left: 0, right: 0, borderTop: `1px solid ${theme.lineSoft}` }} />
            ))}
            {perDay[i].map((block) => {
              const unit = colW / block.lanes;
              const width = unit * block.span - 5;
              const color = projectColor(block.project);
              const appear = interpolate(reveal, [i * 0.06, i * 0.06 + 0.4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={block.key}
                  style={{
                    position: "absolute",
                    top: block.top,
                    left: block.lane * unit + 2,
                    width,
                    height: block.height - 2,
                    borderRadius: 7,
                    background: color.fill,
                    borderLeft: `3px solid ${color.edge}`,
                    boxShadow: highlight && !block.faded ? `0 0 0 2px ${color.edge}, 0 8px 26px rgba(0,0,0,.55)` : undefined,
                    color: color.text,
                    padding: block.height > 26 ? "4px 8px" : "1px 8px",
                    fontSize: 13.5,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    opacity: appear * (block.faded ? 0.22 : 1),
                    transform: `translateY(${(1 - appear) * 10}px)`,
                  }}
                >
                  {block.height >= 19 ? (
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                      {block.title}
                    </div>
                  ) : null}
                  {block.height > 34 ? (
                    <div style={{ opacity: 0.72, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(block.minutes)}m
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
