import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Calendar, CARD } from "../components/Calendar";
import { RUNAWAY } from "../data";
import { theme } from "../theme";

const SHIFT = 58;
const PANEL_W = 470;

const ROWS: Array<{ label: string; value: string; hot?: boolean }> = [
  { label: "Session span", value: "Thu 9:04 AM → Fri 6:12 PM" },
  { label: "Active total", value: "6h 24m over 96 blocks" },
  { label: "Prompts", value: "1" },
  { label: "Assistant turns", value: "2,914" },
  { label: "Models", value: "claude-fable-5 (2,914)", hot: true },
  { label: "Tokens", value: "in 1.4M · out 318K\ncache read 812M", hot: true },
];

const CAPTIONS: Array<{ text: string; from: number; to: number }> = [
  { text: "This one nobody was watching. It ran for two days.", from: 8, to: 62 },
  { text: "One prompt, 2,914 turns. That is where the tokens went.", from: 70, to: 132 },
];

export const WasteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panel = spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.7 } });
  const hot = interpolate(frame, [64, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [126, 140], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 0.5 + 0.5 * Math.sin((frame - 64) / 7);

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <div style={{ transform: `translateY(${SHIFT}px)` }}>
        <Calendar gapMin={15} reveal={1} extra={RUNAWAY} highlight="nightly digest loop" />
      </div>

      <div
        style={{
          position: "absolute",
          right: CARD.x,
          top: CARD.y + SHIFT + 138,
          width: PANEL_W,
          padding: "24px 26px 26px",
          borderRadius: 16,
          background: theme.panelSoft,
          border: `1px solid ${theme.line}`,
          boxShadow: "0 40px 110px rgba(0,0,0,.75)",
          fontFamily: theme.sans,
          opacity: panel,
          transform: `translateX(${(1 - panel) * 46}px)`,
        }}
      >
        <div style={{ fontSize: 25, fontWeight: 600, color: theme.text }}>nightly digest loop</div>
        <div style={{ fontSize: 18, color: theme.muted, marginTop: 4, marginBottom: 20 }}>
          internal-tools · main
        </div>
        {ROWS.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              gap: 16,
              padding: "9px 10px",
              margin: "0 -10px",
              borderRadius: 9,
              background: row.hot ? `rgba(242,80,75,${0.14 * hot})` : "transparent",
              boxShadow: row.hot ? `0 0 0 ${1.4 * hot}px rgba(242,80,75,${0.42 * hot * (0.65 + 0.35 * pulse)})` : undefined,
            }}
          >
            <div style={{ width: 138, flex: "none", color: theme.muted, fontSize: 17 }}>{row.label}</div>
            <div
              style={{
                color: row.hot && hot > 0.5 ? "#ffb4b0" : theme.text,
                fontSize: 17,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "pre-line",
              }}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>

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
              <div style={{ width: 4, height: 29, borderRadius: 2, background: "#f2504b" }} />
              {caption.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
