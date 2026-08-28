import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "../components/Wordmark";
import { theme } from "../theme";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const pill = spring({ frame: frame - 10, fps, config: { damping: 200, mass: 0.8 } });
  const footer = interpolate(frame, [26, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 14}px)` }}>
        <Wordmark size={64} />
      </div>
      <div
        style={{
          marginTop: 44,
          padding: "22px 46px",
          borderRadius: 16,
          background: theme.panel,
          border: `1px solid ${theme.line}`,
          boxShadow: "0 30px 90px rgba(0,0,0,.55)",
          fontFamily: theme.mono,
          fontSize: 42,
          color: theme.text,
          opacity: pill,
          transform: `scale(${0.96 + pill * 0.04})`,
        }}
      >
        <span style={{ color: theme.accent }}>$ </span>npx github:awlevin/codecal
      </div>
      <div
        style={{
          marginTop: 34,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.muted,
          opacity: footer,
        }}
      >
        Claude Code and Codex, on one calendar. Reads your machine, uploads nothing.
      </div>
    </AbsoluteFill>
  );
};
