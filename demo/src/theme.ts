export const theme = {
  bg: "#0b0b0d",
  panel: "#141418",
  panelSoft: "#191920",
  line: "#26262e",
  lineSoft: "#1c1c22",
  text: "#eaeaee",
  muted: "#8a8a95",
  accent: "#7aa2f7",
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
};

/** Project palette: hue per project, echoing the app's per-project colors. */
export const hues = [188, 44, 268, 340, 152];

export const projectColor = (index: number) => {
  const hue = hues[index % hues.length];
  return {
    fill: `hsl(${hue} 44% 27%)`,
    edge: `hsl(${hue} 64% 63%)`,
    text: `hsl(${hue} 58% 93%)`,
  };
};
