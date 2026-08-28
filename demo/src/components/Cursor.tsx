import React from "react";

export const Cursor: React.FC<{ x: number; y: number; pressed: number }> = ({ x, y, pressed }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${1 - pressed * 0.14})`,
      transformOrigin: "4px 4px",
      filter: "drop-shadow(0 6px 14px rgba(0,0,0,.55))",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: -17,
        top: -17,
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "rgba(122,162,247,.30)",
        opacity: pressed,
        transform: `scale(${0.5 + pressed * 0.6})`,
      }}
    />
    <svg width="30" height="34" viewBox="0 0 24 28" fill="none">
      <path d="M3 2 L3 21.5 L8.4 16.6 L12.1 24.6 L15.6 22.9 L12 15.2 L19.4 14.6 Z" fill="#fff" stroke="#0b0b0d" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  </div>
);
