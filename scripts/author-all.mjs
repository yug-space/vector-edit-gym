// Author all 300 tasks — every task uses a UNIQUE base icon.
//
// Source pool: data/icon-pool.txt (one icon path per line, 300 entries).
// The icon at line N becomes the base of task N (1-indexed) for its tier.
//
// Tier assignment:
//   1..60     → very_easy  (single-icon corruption only)
//   61..130   → easy       (single decoration: missing/extra/miscolor/displaced/duplicate)
//   131..210  → medium     (more decorations, subtler corruptions)
//   211..270  → hard       (multi-step or flipped on a single decoration)
//   271..300  → very_hard  (multi-issue: base color + decoration mishap)
//
// Each task's instruction is composed from a small bank of natural phrasings
// (chosen by task index, no double-substitution). Because every task has a
// unique icon name slotted into the sentence, no two instructions are
// identical.

import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderScene, sceneIds, cloneSpec } from "./lib/icon-render.mjs";
import {
  corruptIconColor,
  corruptStrokeWidth,
  corruptScale,
  corruptClippedViewBox,
  corruptMissingPart,
  corruptExtraPart,
  corruptDisplacedPart,
  corruptMiscolorPart,
  corruptFlippedPart,
  corruptDuplicatePart,
  corruptMulti,
} from "./lib/corruptions.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const OUT = join(DATA, "tasks");

// ---- load icon pool ------------------------------------------------------
const POOL = readFileSync(join(DATA, "icon-pool.txt"), "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

if (POOL.length < 300) throw new Error(`pool has only ${POOL.length} icons`);

// Derive a friendly display name from the icon file path.
const friendlyName = (sourcePath) => {
  const file = sourcePath.split("/").pop().replace(/\.svg$/, "");
  return file.replace(/-/g, " ");
};

// Build a scene with one base icon (no decorations).
const sceneBase = (sourcePath, opts = {}) => ({
  canvas: [128, 128],
  bg: "white",
  parts: [
    {
      id: "icon",
      type: "icon",
      source: sourcePath,
      name: friendlyName(sourcePath),
      x: 8, y: 8, size: 112,
      color: "#222", strokeWidth: 1.5,
      ...opts,
    },
  ],
});

// Build a scene with a base icon + ONE labeled decoration primitive.
const sceneWithDecoration = (sourcePath, decoration) => ({
  canvas: [128, 128],
  bg: "white",
  parts: [
    {
      id: "icon",
      type: "icon",
      source: sourcePath,
      name: friendlyName(sourcePath),
      x: 8, y: 8, size: 112,
      color: "#222", strokeWidth: 1.5,
    },
    decoration,
  ],
});

// ---- color + word vocabularies -----------------------------------------
const WRONG_COLORS = [
  ["#e63946", "red"], ["#3b82f6", "blue"], ["#22c55e", "green"], ["#fde047", "yellow"],
  ["#a855f7", "purple"], ["#f97316", "orange"], ["#ec4899", "pink"], ["#06b6d4", "cyan"],
  ["#92400e", "brown"], ["#9ca3af", "gray"],
];

// ---- decoration recipes (positioned within the 128x128 canvas) ----------
//
// Each task's decoration is chosen by index so the same recipe rarely
// hits the same icon. Coords are absolute on the canvas; the icon sits at
// (8,8) at size 112, so the visual center is (64,64).
const DECORATIONS = [
  // [id, partSpec, friendly noun, "added" instruction, "remove" instruction]
  ["badge-tr",       { id: "badge",      type: "circle", cx: 104, cy: 24, r: 6, fill: "#e63946" },                                            "red notification badge",   "in the top-right corner (cx=104, cy=24, r=6, fill #e63946)" ],
  ["badge-bl",       { id: "badge",      type: "circle", cx: 24,  cy: 104, r: 5, fill: "#22c55e" },                                           "green status dot",         "in the bottom-left (cx=24, cy=104, r=5, fill #22c55e)" ],
  ["underline",      { id: "underline",  type: "line",   x1: 16, y1: 116, x2: 112, y2: 116, stroke: "#222", strokeWidth: 2 },                  "black underline",          "below the icon (line from (16,116) to (112,116), stroke #222, stroke-width 2)" ],
  ["overstrike",     { id: "overstrike", type: "line",   x1: 16, y1: 64,  x2: 112, y2: 64,  stroke: "#e63946", strokeWidth: 2 },               "red horizontal strikethrough", "across the center (line (16,64)→(112,64), stroke #e63946, stroke-width 2)" ],
  ["watermark",      { id: "watermark",  type: "rect",   x: 8,   y: 8,    width: 14, height: 14, fill: "#9ca3af", opacity: 0.4 },              "gray watermark square",    "in the top-left (rect x=8, y=8, 14x14, fill #9ca3af, opacity 0.4)" ],
  ["highlight-halo", { id: "halo",       type: "circle", cx: 64,  cy: 64, r: 56, fill: "none", stroke: "#fde047", strokeWidth: 2 },            "yellow highlight ring",    "around the icon (circle cx=64, cy=64, r=56, fill none, stroke #fde047, stroke-width 2)" ],
  ["price-tag",      { id: "price-tag",  type: "rect",   x: 84,  y: 96,   width: 28, height: 14, fill: "#fde047", stroke: "#222", strokeWidth: 1 }, "yellow price tag",      "in the bottom-right (rect x=84, y=96, 28x14, fill #fde047, stroke #222, stroke-width 1)" ],
  ["corner-cross",   { id: "x",          type: "polyline", points: [[100, 16], [112, 28], [106, 22], [112, 16], [100, 28]], stroke: "#e63946", strokeWidth: 2, fill: "none" }, "red X mark", "in the top-right (polyline (100,16)→(112,28)→(106,22)→(112,16)→(100,28), stroke #e63946, stroke-width 2, no fill)" ],
  ["star-stamp",     { id: "star-stamp", type: "polygon", points: [[20, 16], [22, 22], [28, 22], [23, 26], [25, 32], [20, 28], [15, 32], [17, 26], [12, 22], [18, 22]], fill: "#fde047" }, "yellow star stamp", "in the top-left (polygon at x≈20, y≈22, fill #fde047)" ],
  ["bottom-bar",     { id: "bar",        type: "rect",   x: 16,  y: 110,  width: 96, height: 6,  fill: "#3b82f6" },                            "blue progress bar",        "along the bottom (rect x=16, y=110, 96x6, fill #3b82f6)" ],
  ["top-bar",        { id: "bar",        type: "rect",   x: 16,  y: 12,   width: 96, height: 6,  fill: "#3b82f6" },                            "blue header bar",          "along the top (rect x=16, y=12, 96x6, fill #3b82f6)" ],
  ["left-stripe",    { id: "stripe",     type: "rect",   x: 12,  y: 16,   width: 4,  height: 96, fill: "#e63946" },                            "red side stripe",          "on the left edge (rect x=12, y=16, 4x96, fill #e63946)" ],
  ["circle-frame",   { id: "frame",      type: "circle", cx: 64,  cy: 64, r: 60, fill: "none", stroke: "#222", strokeWidth: 1 },               "thin black frame circle",  "around the icon (circle cx=64, cy=64, r=60, fill none, stroke #222, stroke-width 1)" ],
  ["square-frame",   { id: "frame",      type: "rect",   x: 4,   y: 4,    width: 120, height: 120, fill: "none", stroke: "#222", strokeWidth: 1 }, "thin black frame square","around the icon (rect x=4, y=4, 120x120, fill none, stroke #222, stroke-width 1)" ],
  ["dot-grid-1",     { id: "dot",        type: "circle", cx: 16, cy: 16, r: 2, fill: "#a855f7" },                                              "small purple dot",         "in the top-left (circle cx=16, cy=16, r=2, fill #a855f7)" ],
  ["dot-grid-2",     { id: "dot",        type: "circle", cx: 112, cy: 16, r: 2, fill: "#06b6d4" },                                             "small cyan dot",           "in the top-right (circle cx=112, cy=16, r=2, fill #06b6d4)" ],
  ["dot-grid-3",     { id: "dot",        type: "circle", cx: 16, cy: 112, r: 2, fill: "#22c55e" },                                             "small green dot",          "in the bottom-left (circle cx=16, cy=112, r=2, fill #22c55e)" ],
  ["dot-grid-4",     { id: "dot",        type: "circle", cx: 112, cy: 112, r: 2, fill: "#ec4899" },                                            "small pink dot",           "in the bottom-right (circle cx=112, cy=112, r=2, fill #ec4899)" ],
  ["check-overlay",  { id: "check",      type: "polyline", points: [[88, 24], [98, 34], [114, 18]], stroke: "#22c55e", strokeWidth: 3, fill: "none" }, "green checkmark", "in the top-right (polyline (88,24)→(98,34)→(114,18), stroke #22c55e, stroke-width 3, no fill)" ],
  ["arrow-mark",     { id: "arrow",      type: "polyline", points: [[100, 100], [112, 112], [108, 104], [112, 112], [104, 108]], stroke: "#222", strokeWidth: 2, fill: "none" }, "arrow mark", "in the bottom-right (polyline arrow at (100,100), stroke #222, stroke-width 2)" ],
  ["sparkle",        { id: "sparkle",    type: "polyline", points: [[20, 64], [24, 60], [28, 64], [24, 68], [20, 64]], stroke: "#fde047", strokeWidth: 2, fill: "none" }, "yellow sparkle", "on the left (polyline diamond at (24,64), stroke #fde047, stroke-width 2, no fill)" ],
  ["question-dot",   { id: "qdot",       type: "circle", cx: 110, cy: 110, r: 5, fill: "#06b6d4" },                                            "cyan question dot",        "in the bottom-right (circle cx=110, cy=110, r=5, fill #06b6d4)" ],
];

const decAt = (i) => DECORATIONS[i % DECORATIONS.length];

// ---- instruction phrasings ---------------------------------------------
//
// Templates are chosen by task index so adjacent tasks vary in style. Every
// instruction is unique because the icon name slotted in varies on every
// row.

const PHRASE_WRONG_COLOR = [
  (n, cn) => `The ${n} icon has been tinted ${cn} by mistake. Restore its default black outline.`,
  (n, cn) => `Someone repainted the ${n} icon ${cn}. Set the color back to the standard black.`,
  (n, cn) => `This ${n} icon is wrongly colored ${cn}. Fix it back to the default black.`,
  (n, cn) => `A ${cn} ${n} icon doesn't fit the design system. Restore the default black look.`,
  (n, cn) => `Reset this ${n} icon's color from ${cn} back to the default black outline.`,
  (n, cn) => `The ${n} icon should be black, not ${cn}. Restore the original color.`,
];

const PHRASE_WRONG_STROKE = [
  (n, dir) => `The ${n} icon's stroke is too ${dir}. Restore the default stroke-width of 1.5.`,
  (n, dir) => `This ${n} icon is drawn too ${dir}. Reset its stroke-width to 1.5.`,
  (n, dir) => `Someone changed the ${n} icon's line weight — it's too ${dir} now. Restore to 1.5.`,
  (n, dir) => `The ${n} icon's lines look ${dir}. Fix the stroke-width back to the default 1.5.`,
];

const PHRASE_WRONG_SCALE = [
  (n, dir) => `The ${n} icon is rendered too ${dir}. Restore it to size 112.`,
  (n, dir) => `This ${n} icon was scaled ${dir == "small" ? "down" : "up"} by mistake. Reset to size 112.`,
  (n, dir) => `Resize this ${n} icon back to its proper 112 dimensions (it's currently too ${dir}).`,
  (n, dir) => `${n[0].toUpperCase() + n.slice(1)} icon ended up too ${dir}. Restore the default size of 112.`,
];

const PHRASE_CLIPPED = [
  (n) => `The ${n} icon is being cut off by the canvas. Expand the viewBox to 128x128 so it fits.`,
  (n) => `Part of this ${n} icon is clipped. Restore the canvas to 128x128.`,
  (n) => `The viewBox is too small — the ${n} icon doesn't fit. Make it 128x128.`,
  (n) => `Resize the canvas so this ${n} icon stops being cropped.`,
];

const PHRASE_MISSING = [
  (n, noun, where) => `The ${n} icon is missing a ${noun}. Add one back ${where}.`,
  (n, noun, where) => `Add a ${noun} to the ${n} icon ${where}.`,
  (n, noun, where) => `This ${n} icon needs a ${noun} added back ${where}.`,
  (n, noun, where) => `Restore the ${noun} on the ${n} icon ${where}.`,
];

const PHRASE_EXTRA = [
  (n, noun) => `There's a stray ${noun} on the ${n} icon. Remove it.`,
  (n, noun) => `Someone added an unwanted ${noun} to the ${n} icon. Delete it.`,
  (n, noun) => `Clean up this ${n} icon: remove the extra ${noun}.`,
  (n, noun) => `The ${n} icon has a ${noun} it shouldn't. Get rid of it.`,
];

const PHRASE_MISCOLOR = [
  (n, noun, fromName) => `The ${noun} on the ${n} icon got recolored ${fromName}. Restore its original color.`,
  (n, noun, fromName) => `Fix the color of the ${noun} on this ${n} icon — it's the wrong shade (${fromName}).`,
  (n, noun, fromName) => `Someone repainted the ${noun} on the ${n} icon ${fromName}. Set it back to the original.`,
  (n, noun, fromName) => `The ${noun} should not be ${fromName}. Restore its proper color on the ${n} icon.`,
];

const PHRASE_DISPLACED = [
  (n, noun) => `The ${noun} on the ${n} icon has slipped out of place. Move it back to its original position.`,
  (n, noun) => `Restore the ${noun} on the ${n} icon to where it should be.`,
  (n, noun) => `Reset the position of the ${noun} on the ${n} icon.`,
  (n, noun) => `The ${noun} on this ${n} icon drifted. Put it back exactly where it belongs.`,
];

const PHRASE_DUPLICATE = [
  (n, noun) => `The ${n} icon has two copies of the ${noun}. Remove the duplicate.`,
  (n, noun) => `Someone duplicated the ${noun} on this ${n} icon. Delete the extra copy.`,
  (n, noun) => `This ${n} icon should have only one ${noun}, not two. Get rid of the duplicate.`,
];

const PHRASE_FLIPPED = [
  (n, noun) => `The ${noun} on the ${n} icon has been mirrored. Flip it back to its proper orientation.`,
  (n, noun) => `Someone reversed the ${noun} on this ${n} icon. Restore the original direction.`,
  (n, noun) => `The ${noun} on the ${n} icon faces the wrong way. Mirror it back.`,
];

const PHRASE_MULTI = [
  (n) => `Two things are wrong with the ${n} icon. Fix both.`,
  (n) => `Several issues with this ${n} icon — restore it to a clean state.`,
  (n) => `Multiple problems with the ${n} icon. Repair everything that's off.`,
  (n) => `The ${n} icon has more than one defect. Fix all of them.`,
];

const pick = (arr, i) => arr[i % arr.length];

// ---- task builders ------------------------------------------------------

const TASKS = [];
const usedSources = new Set();

const addTask = (id, difficulty, category, scene, corruption, instruction, source) => {
  if (usedSources.has(source)) throw new Error(`source reused: ${source}`);
  usedSources.add(source);
  TASKS.push({ id, difficulty, category, scene, corruption, instruction });
};

// Iterate the pool in order; each task gets the next icon.
let poolIdx = 0;
const nextIcon = () => {
  if (poolIdx >= POOL.length) throw new Error("ran out of icons");
  return POOL[poolIdx++];
};

// ==========================================================================
// VERY EASY (60) — single-icon attribute corruption
// ==========================================================================

// 25 wrong_color
for (let i = 0; i < 25; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [hex, cn] = WRONG_COLORS[i % WRONG_COLORS.length];
  addTask(
    `ve_${String(i + 1).padStart(3, "0")}`,
    "very_easy", "wrong_color",
    () => sceneBase(src),
    (s) => corruptIconColor(s, hex, "#222"),
    pick(PHRASE_WRONG_COLOR, i)(name, cn),
    src,
  );
}

// 15 wrong_stroke_width
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const thick = i % 2 === 0;
  const wrong = thick ? 4 : 0.5;
  addTask(
    `ve_${String(25 + i + 1).padStart(3, "0")}`,
    "very_easy", "wrong_stroke_width",
    () => sceneBase(src),
    (s) => corruptStrokeWidth(s, wrong, 1.5),
    pick(PHRASE_WRONG_STROKE, i)(name, thick ? "thick" : "thin"),
    src,
  );
}

// 10 wrong_scale
for (let i = 0; i < 10; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const bigger = i % 2 === 0;
  const wrong = bigger ? 124 : 56;
  addTask(
    `ve_${String(40 + i + 1).padStart(3, "0")}`,
    "very_easy", "wrong_scale",
    () => sceneBase(src),
    (s) => corruptScale(s, wrong, 112),
    pick(PHRASE_WRONG_SCALE, i)(name, bigger ? "large" : "small"),
    src,
  );
}

// 10 clipped_viewbox
for (let i = 0; i < 10; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [w, h] = [[80, 80], [64, 64], [96, 80], [80, 96], [72, 72]][i % 5];
  addTask(
    `ve_${String(50 + i + 1).padStart(3, "0")}`,
    "very_easy", "clipped_viewbox",
    () => sceneBase(src),
    (s) => corruptClippedViewBox(s, w, h),
    pick(PHRASE_CLIPPED, i)(name),
    src,
  );
}

// ==========================================================================
// EASY (70) — single decoration: missing / extra / miscolor / displaced
// ==========================================================================

// 25 missing decoration
for (let i = 0; i < 25; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun, where] = decAt(i);
  addTask(
    `ea_${String(i + 1).padStart(3, "0")}`,
    "easy", "missing_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMissingPart(s, deco.id),
    pick(PHRASE_MISSING, i)(name, noun, where),
    src,
  );
}

// 20 extra decoration
for (let i = 0; i < 20; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 7);
  addTask(
    `ea_${String(25 + i + 1).padStart(3, "0")}`,
    "easy", "extra_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptExtraPart(s, deco),
    pick(PHRASE_EXTRA, i)(name, noun),
    src,
  );
}

// 15 miscolor decoration
const NICE_WRONG_COLORS = [["#3b82f6", "blue"], ["#22c55e", "green"], ["#a855f7", "purple"], ["#f97316", "orange"], ["#ec4899", "pink"], ["#06b6d4", "cyan"]];
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 3);
  const [hex, cn] = NICE_WRONG_COLORS[i % NICE_WRONG_COLORS.length];
  addTask(
    `ea_${String(45 + i + 1).padStart(3, "0")}`,
    "easy", "miscolor_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMiscolorPart(s, deco.id, hex),
    pick(PHRASE_MISCOLOR, i)(name, noun, cn),
    src,
  );
}

// 10 displaced decoration
const OBVIOUS_OFFSETS = [{ dx: 20, dy: 0 }, { dx: -20, dy: 0 }, { dx: 0, dy: 20 }, { dx: 0, dy: -20 }];
for (let i = 0; i < 10; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 11);
  const offset = OBVIOUS_OFFSETS[i % OBVIOUS_OFFSETS.length];
  addTask(
    `ea_${String(60 + i + 1).padStart(3, "0")}`,
    "easy", "displaced_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptDisplacedPart(s, deco.id, offset),
    pick(PHRASE_DISPLACED, i)(name, noun),
    src,
  );
}

// ==========================================================================
// MEDIUM (80) — subtler corruptions + duplicate_part
// ==========================================================================

// 20 displaced (subtler 6-12px)
const SUBTLE_OFFSETS = [{ dx: 8, dy: 0 }, { dx: -8, dy: 0 }, { dx: 0, dy: 8 }, { dx: 0, dy: -8 }, { dx: 6, dy: 6 }, { dx: -6, dy: -6 }];
for (let i = 0; i < 20; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 5);
  const offset = SUBTLE_OFFSETS[i % SUBTLE_OFFSETS.length];
  addTask(
    `me_${String(i + 1).padStart(3, "0")}`,
    "medium", "displaced_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptDisplacedPart(s, deco.id, offset),
    pick(PHRASE_DISPLACED, i)(name, noun) + " (subtler offset — read the original coordinates carefully).",
    src,
  );
}

// 20 miscolor (near-correct colors)
const SUBTLE_WRONG_COLORS = [["#d33036", "muted red"], ["#2c70ec", "muted blue"], ["#1ba84c", "muted green"], ["#dac030", "muted yellow"], ["#8c44d0", "muted purple"]];
for (let i = 0; i < 20; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 9);
  const [hex, cn] = SUBTLE_WRONG_COLORS[i % SUBTLE_WRONG_COLORS.length];
  addTask(
    `me_${String(20 + i + 1).padStart(3, "0")}`,
    "medium", "miscolor_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMiscolorPart(s, deco.id, hex),
    pick(PHRASE_MISCOLOR, i)(name, noun, cn),
    src,
  );
}

// 15 missing decoration
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun, where] = decAt(i + 13);
  addTask(
    `me_${String(40 + i + 1).padStart(3, "0")}`,
    "medium", "missing_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMissingPart(s, deco.id),
    pick(PHRASE_MISSING, i)(name, noun, where),
    src,
  );
}

// 15 extra decoration
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 17);
  addTask(
    `me_${String(55 + i + 1).padStart(3, "0")}`,
    "medium", "extra_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptExtraPart(s, deco),
    pick(PHRASE_EXTRA, i)(name, noun),
    src,
  );
}

// 10 duplicate_part
const DUP_OFFSETS = [{ dx: 12, dy: 0 }, { dx: -12, dy: 0 }, { dx: 0, dy: 12 }, { dx: 0, dy: -12 }];
for (let i = 0; i < 10; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 4);
  const offset = DUP_OFFSETS[i % DUP_OFFSETS.length];
  addTask(
    `me_${String(70 + i + 1).padStart(3, "0")}`,
    "medium", "duplicate_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptDuplicatePart(s, deco.id, offset),
    pick(PHRASE_DUPLICATE, i)(name, noun),
    src,
  );
}

// ==========================================================================
// HARD (60) — multi-step, flipped, very subtle corruption
// ==========================================================================

// 15 multi (two issues): wrong_color base + miscolored decoration
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i);
  const [hexBase, cnBase] = WRONG_COLORS[i % WRONG_COLORS.length];
  const [hexDeco, cnDeco] = NICE_WRONG_COLORS[(i + 2) % NICE_WRONG_COLORS.length];
  addTask(
    `ha_${String(i + 1).padStart(3, "0")}`,
    "hard", "multi",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMulti(s, [
      (x) => corruptIconColor(x, hexBase, "#222"),
      (x) => corruptMiscolorPart(x, deco.id, hexDeco),
    ]),
    `Two issues on the ${name} icon: the base outline is wrongly tinted ${cnBase}, AND the ${noun} on top is the wrong color (${cnDeco}). Fix both.`,
    src,
  );
}

// 15 flipped_part (only on flippable decoration types: line, polyline, polygon)
const FLIPPABLE = DECORATIONS.filter((d) => ["line", "polyline", "polygon"].includes(d[1].type));
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = FLIPPABLE[i % FLIPPABLE.length];
  addTask(
    `ha_${String(15 + i + 1).padStart(3, "0")}`,
    "hard", "flipped_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptFlippedPart(s, deco.id),
    pick(PHRASE_FLIPPED, i)(name, noun),
    src,
  );
}

// 15 very subtle displaced (2-4px)
const TINY_OFFSETS = [{ dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 }, { dx: 2, dy: 2 }, { dx: -2, dy: -2 }, { dx: 4, dy: 0 }];
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 8);
  const offset = TINY_OFFSETS[i % TINY_OFFSETS.length];
  addTask(
    `ha_${String(30 + i + 1).padStart(3, "0")}`,
    "hard", "displaced_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptDisplacedPart(s, deco.id, offset),
    pick(PHRASE_DISPLACED, i)(name, noun) + ` (very subtle — only ${Math.max(Math.abs(offset.dx), Math.abs(offset.dy))}px off).`,
    src,
  );
}

// 15 near-color miscolor (hard-to-detect shades)
const NEAR_COLORS = [["#1a1a1a", "very dark gray"], ["#444444", "dark gray"], ["#fcfcfc", "near-white"], ["#fafafa", "off-white"], ["#212121", "slightly-darker black"]];
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 14);
  const [hex, cn] = NEAR_COLORS[i % NEAR_COLORS.length];
  addTask(
    `ha_${String(45 + i + 1).padStart(3, "0")}`,
    "hard", "miscolor_part",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMiscolorPart(s, deco.id, hex),
    pick(PHRASE_MISCOLOR, i)(name, noun, cn),
    src,
  );
}

// ==========================================================================
// VERY HARD (30) — three-issue multi-corruption
// ==========================================================================

// 15 three-issue multi
for (let i = 0; i < 15; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 6);
  const [hexBase, cnBase] = WRONG_COLORS[i % WRONG_COLORS.length];
  const [hexDeco, cnDeco] = NICE_WRONG_COLORS[i % NICE_WRONG_COLORS.length];
  const offset = SUBTLE_OFFSETS[i % SUBTLE_OFFSETS.length];
  addTask(
    `vh_${String(i + 1).padStart(3, "0")}`,
    "very_hard", "multi",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMulti(s, [
      (x) => corruptIconColor(x, hexBase, "#222"),
      (x) => corruptMiscolorPart(x, deco.id, hexDeco),
      (x) => corruptDisplacedPart(x, deco.id, offset),
    ]),
    `Three things wrong with the ${name} icon: the base outline is ${cnBase}, the ${noun} is ${cnDeco} (wrong color), AND the ${noun} has drifted out of place. Fix everything.`,
    src,
  );
}

// 10 subtle two-issue multi
for (let i = 0; i < 10; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [, deco, noun] = decAt(i + 2);
  const [hex, cn] = NEAR_COLORS[i % NEAR_COLORS.length];
  const offset = TINY_OFFSETS[i % TINY_OFFSETS.length];
  addTask(
    `vh_${String(15 + i + 1).padStart(3, "0")}`,
    "very_hard", "multi",
    () => sceneWithDecoration(src, deco),
    (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, deco.id, hex),
      (x) => corruptDisplacedPart(x, deco.id, offset),
    ]),
    `Two subtle issues on the ${name} icon: the ${noun} is the wrong shade (${cn}) AND it has drifted slightly (~${Math.max(Math.abs(offset.dx), Math.abs(offset.dy))}px). Restore it precisely.`,
    src,
  );
}

// 5 wrong_color + clipped combos
for (let i = 0; i < 5; i++) {
  const src = nextIcon();
  const name = friendlyName(src);
  const [hex, cn] = WRONG_COLORS[i % WRONG_COLORS.length];
  const [w, h] = [[80, 80], [96, 80], [72, 72], [64, 64], [80, 96]][i];
  addTask(
    `vh_${String(25 + i + 1).padStart(3, "0")}`,
    "very_hard", "multi",
    () => sceneBase(src),
    (s) => corruptMulti(s, [
      (x) => corruptIconColor(x, hex, "#222"),
      (x) => corruptClippedViewBox(x, w, h),
    ]),
    `The ${name} icon has two problems: it's been tinted ${cn} AND the canvas is clipping it (${w}x${h}). Restore both the color and the viewBox.`,
    src,
  );
}

// ==========================================================================
// EMIT
// ==========================================================================

if (existsSync(OUT)) {
  for (const f of readdirSync(OUT)) {
    if (/^[a-z]+_\d+\.json$/.test(f)) rmSync(join(OUT, f));
  }
} else {
  mkdirSync(OUT, { recursive: true });
}

const seenIds = new Set();
const seenInstructions = new Set();
for (const t of TASKS) {
  if (seenIds.has(t.id)) throw new Error(`duplicate id: ${t.id}`);
  if (seenInstructions.has(t.instruction)) throw new Error(`duplicate instruction: ${t.instruction}`);
  seenIds.add(t.id);
  seenInstructions.add(t.instruction);

  const clean = t.scene();
  const { corrupted, fix } = t.corruption(clean);
  const { spec: target, diff } = fix(corrupted);
  const initialIds = sceneIds(corrupted);
  const targetIds = sceneIds(target);
  const allIds = [...new Set([...initialIds, ...targetIds])];
  const changed = new Set(diff.map((d) => d.part).filter((p) => p !== "__svg"));

  writeFileSync(join(OUT, `${t.id}.json`), JSON.stringify({
    task_id: t.id,
    difficulty: t.difficulty,
    category: t.category,
    instruction: t.instruction,
    initial_svg: renderScene(corrupted),
    target_svg: renderScene(target),
    parts: allIds,
    target_parts: [...changed],
    expected_diff: diff,
    should_preserve: allIds.filter((id) => !changed.has(id)),
    authored_at: new Date().toISOString(),
  }, null, 2));
}

const byDiff = TASKS.reduce((acc, t) => ((acc[t.difficulty] = (acc[t.difficulty] ?? 0) + 1), acc), {});
console.log(`authored ${TASKS.length} tasks; every task uses a unique base icon.`);
console.log(`by difficulty:`, byDiff);
console.log(`unique base icons used: ${usedSources.size}`);
console.log(`unique instructions: ${seenInstructions.size}`);
