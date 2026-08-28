import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { Terminal } from "./scenes/Terminal";
import { CalendarScene } from "./scenes/CalendarScene";
import { EndCard } from "./scenes/EndCard";
import { theme } from "./theme";

export const DEMO_DURATION = 585;

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1200px 620px at 50% 12%, rgba(122,162,247,.10), transparent 70%), radial-gradient(900px 520px at 82% 96%, rgba(126,226,184,.06), transparent 70%)",
      }}
    />
    <Sequence durationInFrames={54}>
      <Intro />
    </Sequence>
    <Sequence from={48} durationInFrames={146}>
      <Terminal />
    </Sequence>
    <Sequence from={186} durationInFrames={300}>
      <CalendarScene />
    </Sequence>
    <Sequence from={478} durationInFrames={107}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
