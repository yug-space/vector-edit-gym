// Very Easy — 60 tasks.
//
// One real Heroicon. ONE thing is wrong with it. Restore the icon to its
// canonical state. Instructions are natural language; no coordinate-heavy
// specs.
//
//   20 wrong_color           — icon tinted some wrong color
//   15 wrong_stroke_width    — too thick / too thin
//   10 wrong_scale           — too big / too small
//   10 clipped_viewbox       — canvas too small, icon cropped
//    5 wrong_color           — extra batch with a different palette

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { place } from "./lib/icon-catalog.mjs";
import {
  corruptIconColor,
  corruptStrokeWidth,
  corruptScale,
  corruptClippedViewBox,
} from "./lib/corruptions.mjs";
import { instructionFor } from "./lib/nl.mjs";
import { iconTaskBuilder } from "./lib/icon-emit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "tasks");

const { make, write } = iconTaskBuilder("ve", "very_easy");

const POOL = [
  "home", "heart", "star", "sun", "moon", "cloud", "fire", "bell",
  "envelope", "shopping-cart", "cog", "user", "users", "camera",
  "phone", "microphone", "magnifying-glass", "map-pin", "globe-alt",
  "document", "folder", "bookmark", "trash", "key", "lock-closed",
  "eye", "check", "x-mark", "plus", "minus", "chart-bar", "chart-pie",
  "clock", "calendar", "face-smile", "light-bulb", "gift", "tag",
  "flag", "truck", "beaker", "photo",
];

const WRONG_COLORS = ["#e63946", "#3b82f6", "#22c55e", "#fde047", "#a855f7", "#f97316", "#ec4899", "#06b6d4"];

const cleanScene = (name) => ({
  canvas: [128, 128],
  bg: "white",
  parts: [place(name, { id: name, x: 8, y: 8, size: 112, color: "#222", strokeWidth: 1.5 })],
});

// ---- 20 wrong_color ------------------------------------------------------
for (let i = 0; i < 20; i++) {
  const name = POOL[i % POOL.length];
  const wrong = WRONG_COLORS[i % WRONG_COLORS.length];
  const clean = cleanScene(name);
  const { corrupted, fix, params } = corruptIconColor(clean, wrong, "#222");
  make({
    category: "wrong_color",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "wrong_color", params, iconName: name, seed: i }),
  });
}

// ---- 15 wrong_stroke_width -----------------------------------------------
for (let i = 0; i < 15; i++) {
  const name = POOL[(i + 17) % POOL.length];
  const wrongW = i % 2 === 0 ? 4 : 0.5;
  const clean = cleanScene(name);
  const { corrupted, fix, params } = corruptStrokeWidth(clean, wrongW, 1.5);
  make({
    category: "wrong_stroke_width",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "wrong_stroke_width", params, iconName: name, seed: i }),
  });
}

// ---- 10 wrong_scale ------------------------------------------------------
for (let i = 0; i < 10; i++) {
  const name = POOL[(i + 31) % POOL.length];
  const wrongSize = i % 2 === 0 ? 64 : 124;
  const clean = cleanScene(name);
  const { corrupted, fix, params } = corruptScale(clean, wrongSize, 112);
  make({
    category: "wrong_scale",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "wrong_scale", params, iconName: name, seed: i }),
  });
}

// ---- 10 clipped_viewbox --------------------------------------------------
for (let i = 0; i < 10; i++) {
  const name = POOL[(i + 7) % POOL.length];
  const clean = cleanScene(name);
  // shrink to 80x80 so the 112-size icon sticks out
  const { corrupted, fix, params } = corruptClippedViewBox(clean, 80, 80);
  make({
    category: "clipped_viewbox",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "clipped_viewbox", params, iconName: name, seed: i }),
  });
}

// ---- 5 wrong_color (extra batch with brown/cyan palette) -----------------
const EXTRA_COLORS = ["#92400e", "#06b6d4", "#0f172a", "#9ca3af", "#ec4899"];
for (let i = 0; i < 5; i++) {
  const name = POOL[(i + 22) % POOL.length];
  const wrong = EXTRA_COLORS[i];
  const clean = cleanScene(name);
  const { corrupted, fix, params } = corruptIconColor(clean, wrong, "#222");
  make({
    category: "wrong_color",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "wrong_color", params, iconName: name, seed: i + 20 }),
  });
}

const tasks = write(OUT);
console.log(`very_easy: wrote ${tasks.length} tasks`);
