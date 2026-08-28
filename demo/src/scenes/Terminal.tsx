import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

const COMMAND = "npx github:awlevin/codecal";
const TYPE_START = 8;
const TYPE_END = 44;

const OUTPUT: Array<{ text: string; at: number; color: string }> = [
  { text: "indexed 1303 codex, 176 claude sessions in 10.4s", at: 60, color: theme.muted },
  { text: "codecal → http://localhost:4317", at: 74, color: "#7ee2b8" },
];

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const typed = Math.round(
    interpolate(frame, [TYPE_START, TYPE_END], [0, COMMAND.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const caretOn = frame < TYPE_END ? true : Math.floor(frame / 15) % 2 === 0;
  const exit = interpolate(frame, [110, 126], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: exit }}>
      <div
        style={{
          width: 1180,
          borderRadius: 16,
          background: "#0f0f13",
          border: `1px solid ${theme.line}`,
          boxShadow: "0 40px 120px rgba(0,0,0,.65)",
          overflow: "hidden",
          transform: `scale(${0.96 + enter * 0.04}) translateY(${(1 - enter) * 18}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            height: 46,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 18px",
            background: "#17171c",
            borderBottom: `1px solid ${theme.line}`,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c }} />
          ))}
          <div style={{ flex: 1, textAlign: "center", color: theme.muted, fontFamily: theme.sans, fontSize: 15, marginLeft: -40 }}>
            zsh
          </div>
        </div>
        <div style={{ padding: "30px 34px 38px", fontFamily: theme.mono, fontSize: 27, lineHeight: 1.75 }}>
          <div style={{ color: theme.text }}>
            <span style={{ color: "#7ee2b8" }}>~ </span>
            <span style={{ color: theme.accent }}>$ </span>
            {COMMAND.slice(0, typed)}
            <span style={{ opacity: caretOn ? 1 : 0, color: theme.accent }}>▍</span>
          </div>
          {OUTPUT.map((line) => {
            const shown = interpolate(frame, [line.at, line.at + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={line.text}
                style={{ color: line.color, opacity: shown, transform: `translateY(${(1 - shown) * 6}px)` }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          marginTop: 34,
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.muted,
          opacity: interpolate(frame, [82, 94], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        No install. No config. No account.
      </div>
    </AbsoluteFill>
  );
};
