export const FPS = 30;

export const SCENES = {
  intro: { from: 0, duration: 120 },
  brief: { from: 120, duration: 150 },
  agents: { from: 270, duration: 240 },
  verifier: { from: 510, duration: 240 },
  results: { from: 750, duration: 150 },
  outro: { from: 900, duration: 180 },
} as const;

export const TOTAL_FRAMES = 1080;

export const COLORS = {
  ink: "#090909",
  paper: "#fffdf9",
  white: "#ffffff",
  orange: "#ff8c1a",
  orangeStrong: "#d96800",
  orangeSoft: "#fff0dd",
  gray100: "#f4f2ee",
  gray200: "#e5e1db",
  gray400: "#9a948b",
  gray600: "#655f57",
  green: "#137c4a",
  greenSoft: "#dcf8e8",
  red: "#c73a32",
  redSoft: "#ffebe8",
  blue: "#2877c7",
  violet: "#7658c7",
} as const;

export const LEADERBOARD = [
  { name: "Claude Sonnet 5", provider: "Anthropic", score: 15 },
  { name: "KAT Coder Air V2.5", provider: "KwaiPilot", score: 12.5 },
  { name: "MiniMax M3", provider: "MiniMax", score: 10 },
] as const;

export const TASK_PROMPT =
  "The amber signal has gone dark, the train door is sitting too far to the right, and the overhead cable has an awkward sag. Put those three details back in place and leave the rest of the station alone.";
