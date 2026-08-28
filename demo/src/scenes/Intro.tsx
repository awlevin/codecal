import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "../components/Wordmark";
import { theme } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const tagline = interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [34, 46], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exit,
        transform: `scale(${interpolate(frame, [34, 46], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
      }}
    >
      <div style={{ transform: `scale(${0.94 + enter * 0.06})`, opacity: enter }}>
        <Wordmark size={92} />
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.muted,
          opacity: tagline,
          transform: `translateY(${(1 - tagline) * 10}px)`,
        }}
      >
        Your coding agents, on a calendar.
      </div>
    </AbsoluteFill>
  );
};
