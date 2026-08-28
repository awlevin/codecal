import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Calendar, CARD, HEADER_H, SLIDER, knobX } from "../components/Calendar";
import { Cursor } from "../components/Cursor";
import { theme } from "../theme";

const SHIFT = 58;
const HEADLINE = (
  <>
    See how well you <i>really</i> use your agents.
  </>
);

const CAPTIONS: Array<{ text: string; from: number; to: number }> = [
  { text: "You took five minutes to reply. The session never stopped.", from: 92, to: 180 },
  { text: "You set how long a pause has to be to count as a break.", from: 196, to: 280 },
];

/** The drag: hold at 15, pull right to 60, then back down to 6. */
const gapAt = (frame: number) =>
  interpolate(frame, [80, 166, 190, 246], [15, 60, 60, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

export const CalendarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 18, fps, config: { damping: 200, mass: 0.6 } });
  const gap = gapAt(frame);
  const reveal = interpolate(frame, [22, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [292, 306], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headline = interpolate(frame, [0, 14, 86, 98], [0, 1, 1, 0.32], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const approach = interpolate(frame, [46, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cursorX = interpolate(approach, [0, 1], [SLIDER.x + 470, knobX(gap)]);
  const cursorY = interpolate(approach, [0, 1], [CARD.y + SHIFT + 430, CARD.y + SHIFT + HEADER_H / 2]);
  const pressed = interpolate(frame, [72, 80, 250, 258], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 46,
          textAlign: "center",
          fontFamily: theme.sans,
          fontSize: 42,
          fontWeight: 600,
          letterSpacing: -0.6,
          color: theme.text,
          opacity: headline,
          transform: `translateY(${(1 - Math.min(1, headline * 1.4)) * 14}px)`,
        }}
      >
        {HEADLINE}
      </div>

      <div
        style={{
          transform: `translateY(${SHIFT + (1 - enter) * 22}px) scale(${0.985 + enter * 0.015})`,
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
          top: CARD.y + SHIFT + CARD.h + 36,
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
                fontSize: 33,
                letterSpacing: -0.3,
                color: theme.text,
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ width: 4, height: 29, borderRadius: 2, background: theme.accent }} />
              {caption.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
