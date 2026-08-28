import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Calendar, CARD, HEADER_H, SLIDER, knobX } from "../components/Calendar";
import { Cursor } from "../components/Cursor";
import { theme } from "../theme";

const CAPTIONS: Array<{ text: string; from: number; to: number }> = [
  { text: "A session is not one block. It is prompts, tool calls and pauses.", from: 16, to: 74 },
  { text: "The idle gap decides how long a pause splits a block in two.", from: 80, to: 164 },
  { text: "Same week, read at the resolution you want.", from: 182, to: 268 },
];

/** The drag: hold at 15, pull right to 60, then back down to 6. */
const gapAt = (frame: number) =>
  interpolate(frame, [64, 150, 176, 232], [15, 60, 60, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

export const CalendarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const gap = gapAt(frame);
  const reveal = interpolate(frame, [4, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [286, 300], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const approach = interpolate(frame, [30, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cursorX = interpolate(approach, [0, 1], [SLIDER.x + 470, knobX(gap)]);
  const cursorY = interpolate(approach, [0, 1], [CARD.y + 430, CARD.y + HEADER_H / 2]);
  const pressed = interpolate(frame, [56, 62, 236, 244], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div
        style={{
          transform: `scale(${0.985 + enter * 0.015}) translateY(${(1 - enter) * 16}px)`,
          opacity: enter,
        }}
      >
        <Calendar gapMin={gap} reveal={reveal} />
      </div>

      <Cursor x={cursorX} y={cursorY} pressed={pressed} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CARD.y + CARD.h + 42,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {CAPTIONS.map((caption) => {
          const shown = interpolate(
            frame,
            [caption.from, caption.from + 12, caption.to, caption.to + 10],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          if (shown <= 0.001) {
            return null;
          }
          return (
            <div
              key={caption.text}
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: shown,
                transform: `translateY(${(1 - shown) * 12}px)`,
                fontFamily: theme.sans,
                fontSize: 34,
                letterSpacing: -0.3,
                color: theme.text,
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ width: 4, height: 30, borderRadius: 2, background: theme.accent }} />
              {caption.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
