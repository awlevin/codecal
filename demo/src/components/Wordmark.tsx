import React from "react";
import { theme } from "../theme";

export const Wordmark: React.FC<{ size?: number; showMark?: boolean }> = ({
  size = 34,
  showMark = true,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.36 }}>
    {showMark ? (
      <div
        style={{
          width: size * 1.06,
          height: size * 1.06,
          borderRadius: size * 0.28,
          background: theme.panelSoft,
          border: `1px solid ${theme.line}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: size * 0.1,
          padding: size * 0.19,
        }}
      >
        <div style={{ background: theme.accent, borderRadius: size * 0.07 }} />
        <div style={{ background: "hsl(188 64% 63%)", borderRadius: size * 0.07, opacity: 0.5 }} />
        <div style={{ background: "hsl(44 64% 63%)", borderRadius: size * 0.07, opacity: 0.5 }} />
        <div style={{ background: "hsl(268 64% 68%)", borderRadius: size * 0.07 }} />
      </div>
    ) : null}
    <div
      style={{
        fontFamily: theme.sans,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: -size * 0.03,
        color: theme.text,
      }}
    >
      code<span style={{ color: theme.accent }}>cal</span>
    </div>
  </div>
);
