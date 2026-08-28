import React from "react";
import { AbsoluteFill } from "remotion";
import { Calendar } from "../components/Calendar";
import { theme } from "../theme";

/** The still used as the README hero. */
export const Poster: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1200px 620px at 50% 10%, rgba(122,162,247,.12), transparent 70%), radial-gradient(900px 520px at 82% 96%, rgba(126,226,184,.07), transparent 70%)",
      }}
    />
    <Calendar gapMin={15} reveal={1} />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 52,
        textAlign: "center",
        fontFamily: theme.sans,
        fontSize: 32,
        color: theme.muted,
      }}
    >
      Every Claude Code and Codex session you ran this week, on one grid.
    </div>
  </AbsoluteFill>
);
