// Medium — 80 tasks.
//
// 4-6 real icons per scene OR composite real-icon scenes from icon-scenes.
// Tasks emphasize disambiguation + small dexterous edits.
//
//   20 spatial selection  — "leftmost", "third", "the one between X and Y"
//   20 named selection    — among many real icons, recolor/restroke the named one
//   15 composite recolor  — composite scene; recolor one specific accessory
//   15 composite move/add — shift or add a single accessory at exact coords
//   10 repair             — accessory or icon offset; restore exact position

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { place } from "./lib/icon-catalog.mjs";
import { recolor, restroke, move, addPart, deletePart, resize } from "./lib/icon-edits.mjs";
import { SCENES, sceneNames } from "./lib/icon-scenes.mjs";
import { iconTaskBuilder } from "./lib/icon-emit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "tasks");

const { make, write } = iconTaskBuilder("me", "medium");

const PALETTE = ["#e63946", "#3b82f6", "#22c55e", "#fde047", "#a855f7", "#f97316", "#ec4899"];
const CN = { "#e63946": "red", "#3b82f6": "blue", "#22c55e": "green", "#fde047": "yellow", "#a855f7": "purple", "#f97316": "orange", "#ec4899": "pink" };

// Row of N icons.
const row = (names, { size = 48, gap = 16, color = "#222" } = {}) => {
  const w = names.length * size + (names.length - 1) * gap + 32;
  const h = size + 32;
  const objects = [];
  let x = 16;
  for (const n of names) {
    objects.push(place(n, { id: n, x, y: 16, size, color }));
    x += size + gap;
  }
  return { canvas: [w, h], bg: "white", parts: objects };
};

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

// ---- 20 SPATIAL SELECTION ------------------------------------------------
const SPATIAL_SCENES = [
  ["home", "heart", "star", "sun"],
  ["bell", "envelope", "phone", "microphone", "cog"],
  ["shopping-cart", "gift", "tag", "truck"],
  ["user", "users", "face-smile", "cog"],
  ["document", "folder", "bookmark", "trash", "key"],
  ["chart-bar", "chart-pie", "clock", "calendar"],
  ["map-pin", "globe-alt", "camera", "photo"],
  ["check", "x-mark", "plus", "minus", "eye"],
  ["fire", "light-bulb", "key", "lock-closed"],
  ["heart", "bell", "star", "moon", "sun"],
];

for (let i = 0; i < 10; i++) {
  // pick "ordinal" recolor — first / second / third / last
  const names = SPATIAL_SCENES[i % SPATIAL_SCENES.length];
  const isLast = i % 4 === 3;
  const ordIdx = isLast ? names.length - 1 : i % Math.min(names.length, 3);
  const target = names[ordIdx];
  const colorHex = PALETTE[i % PALETTE.length];
  const initial = row(names);
  const phrase = isLast ? "last" : ORDINALS[ordIdx];
  make({
    category: "spatial_select",
    initialSpec: initial,
    edit: (s) => recolor(s, target, colorHex),
    instruction: `Five icons in a row (${names.join(", ")}). Recolor ONLY the ${phrase} one (${target}) ${CN[colorHex]} (${colorHex}).`,
    targetIds: [target],
  });
}

for (let i = 0; i < 10; i++) {
  // "the one between X and Y" — needs to identify positionally
  const names = SPATIAL_SCENES[(i + 3) % SPATIAL_SCENES.length];
  if (names.length < 3) continue;
  const midIdx = 1 + (i % (names.length - 2));
  const target = names[midIdx];
  const before = names[midIdx - 1];
  const after = names[midIdx + 1];
  const colorHex = PALETTE[(i + 2) % PALETTE.length];
  const initial = row(names);
  make({
    category: "spatial_select",
    initialSpec: initial,
    edit: (s) => recolor(s, target, colorHex),
    instruction: `Recolor ONLY the icon between ${before} and ${after} (the ${target}) ${CN[colorHex]} (${colorHex}).`,
    targetIds: [target],
  });
}

// ---- 20 NAMED SELECTION --------------------------------------------------
for (let i = 0; i < 20; i++) {
  const names = SPATIAL_SCENES[i % SPATIAL_SCENES.length];
  // pick a non-trivial target index so it's not always the first
  const targetIdx = (i * 3) % names.length;
  const target = names[targetIdx];
  const colorHex = PALETTE[(i + 1) % PALETTE.length];
  const newWidth = 1.5 + (i % 3) * 0.5; // 1.5 / 2.0 / 2.5
  const initial = row(names);
  for (const p of initial.parts) p.strokeWidth = 1.5;
  // half recolor, half restroke
  if (i % 2 === 0) {
    make({
      category: "named_recolor",
      initialSpec: initial,
      edit: (s) => recolor(s, target, colorHex),
      instruction: `Among these icons (${names.join(", ")}), recolor ONLY the ${target} ${CN[colorHex]} (${colorHex}).`,
      targetIds: [target],
    });
  } else {
    make({
      category: "named_restroke",
      initialSpec: initial,
      edit: (s) => restroke(s, target, { strokeWidth: newWidth }),
      instruction: `Among these icons (${names.join(", ")}), set the stroke-width of ONLY the ${target} to exactly ${newWidth}. The others stay at 1.5.`,
      targetIds: [target],
    });
  }
}

// ---- 15 COMPOSITE RECOLOR -----------------------------------------------
const sceneList = sceneNames();
const COMPOSITE_RECOLOR = [
  ["house",    "door",     "#3b82f6", "Make only the door blue (#3b82f6). The home outline + window + chimney must remain untouched."],
  ["house",    "window",   "#fde047", "Make only the window yellow (#fde047). Everything else stays the same."],
  ["house",    "chimney",  "#22c55e", "Make only the chimney green (#22c55e). Don't touch the home, door, window, or doorknob."],
  ["clock",    "hour-hand-color", null, "skip"], // placeholder, replaced below
  ["envelope", "stamp",    "#22c55e", "Make only the stamp green (#22c55e). Envelope outline, address, urgent dot unchanged."],
  ["envelope", "urgent",   "#fde047", "Make only the urgent dot yellow (#fde047). Other parts unchanged."],
  ["bell",     "badge",    "#3b82f6", "Make only the notification badge blue (#3b82f6). Bell outline, ringer, badge-count unchanged."],
  ["face",     "blush-left", "#e63946", "Make only the left blush red (#e63946). Right blush stays pink, face stays black."],
  ["cart",     "item-1",   "#22c55e", "Make only item-1 (the rectangle inside the cart) green (#22c55e). Item-2 + base cart + wheels unchanged."],
  ["pin",      "pin-dot",  "#3b82f6", "Make only the pin-dot blue (#3b82f6). Map-pin outline + shadow unchanged."],
  ["gift",     "bow-knot", "#3b82f6", "Make only the bow-knot blue (#3b82f6). Bows + gift outline unchanged."],
  ["flag",     "pole-tip", "#e63946", "Make only the pole-tip red (#e63946). Flag outline + windline unchanged."],
  ["bulb",     "halo",     "#3b82f6", "Make only the halo around the bulb blue (#3b82f6). Filament + bulb outline unchanged."],
  ["cog",      "center-dot", "#3b82f6", "Make only the center-dot blue (#3b82f6). Cog outline + rotation-arrow unchanged."],
  ["heart",    "crack",    "#e63946", "Make only the crack line red (#e63946). Heart outline + arrow unchanged."],
];

// fix placeholder: clock hour-hand recolor (uses restroke since hour-hand is a line)
COMPOSITE_RECOLOR[3] = ["clock", "hour-hand-color", "#e63946", "Recolor only the hour-hand red (#e63946) by changing its stroke. Minute-hand + pivot + clock outline unchanged."];

for (const [sceneName, partId, color, instr] of COMPOSITE_RECOLOR) {
  const initial = SCENES[sceneName]();
  const isStroke = partId === "hour-hand-color";
  make({
    category: "composite_recolor",
    initialSpec: initial,
    edit: (s) => isStroke
      ? restroke(s, "hour-hand", { stroke: color })
      : recolor(s, partId, color),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: [isStroke ? "hour-hand" : partId],
  });
}

// ---- 15 COMPOSITE MOVE / ADD --------------------------------------------
const COMPOSITE_DEX = [
  // [sceneName, kind: "move"|"add"|"delete", params, instruction]
  ["house",    "move",   { target: "door", dx: 4, dy: 0 }, "Nudge the door 4px to the right (x: 56→60). Nothing else moves."],
  ["house",    "move",   { target: "window", dx: 30, dy: 0 }, "Move the window to the right side of the wall: shift x by +30 (32→62). Other parts unchanged."],
  ["house",    "delete", { target: "doorknob" }, "Remove the doorknob (the tiny yellow circle at cx=70, cy=94, r=1.5). Everything else stays."],
  ["clock",    "move",   { target: "minute-hand", dx: -24, dy: 0 }, "Set the minute hand to 9 o'clock: shift x2 by -24 (88→64). Hour-hand and pivot unchanged."],
  ["clock",    "move",   { target: "hour-hand", dx: 0, dy: 26 }, "Rotate the hour hand to point down at 6: shift y2 by +26 (38→64). Minute-hand and pivot unchanged."],
  ["envelope", "move",   { target: "stamp", dx: -56, dy: 0 }, "Move the stamp from the right side to the left side: shift x by -56 (92→36). Other parts unchanged."],
  ["face",     "delete", { target: "tear-left" }, "Wipe the tear: remove the tear-left polyline. Blushes + face unchanged."],
  ["face",     "add",    { partSpec: { id: "tear-right", type: "polyline", points: [[84, 72], [82, 84], [86, 84]], stroke: "#3b82f6", strokeWidth: 2, fill: "none" } }, "Add a symmetric right tear: polyline (84,72)→(82,84)→(86,84), stroke #3b82f6, stroke-width 2, no fill."],
  ["cart",     "delete", { target: "item-2" }, "Remove item-2 (the yellow circle cx=80, cy=65, r=5) from the cart. Item-1, wheels, base cart unchanged."],
  ["cart",     "add",    { partSpec: { id: "item-3", type: "rect", x: 68, y: 60, width: 10, height: 10, fill: "#22c55e" } }, "Add a third item: green rect x=68, y=60, 10×10, fill #22c55e."],
  ["pin",      "delete", { target: "shadow" }, "Remove the ground shadow (ellipse cx=64, cy=112, rx=18, ry=3). Pin + dot unchanged."],
  ["bell",     "delete", { target: "badge-count" }, "Remove the small white dot inside the badge (badge-count). Badge + bell + ringer unchanged."],
  ["bulb",     "delete", { target: "halo" }, "Remove the yellow halo around the bulb. Filament + bulb outline unchanged."],
  ["heart",    "delete", { target: "arrow" }, "Pull out the arrow: remove the arrow line. Crack + heart outline unchanged."],
  ["cog",      "delete", { target: "rotation-arrow" }, "Remove the rotation-arrow polyline. Cog outline + center-dot unchanged."],
];

for (const [sceneName, kind, params, instr] of COMPOSITE_DEX) {
  const initial = SCENES[sceneName]();
  if (kind === "move") {
    make({
      category: "composite_move",
      initialSpec: initial,
      edit: (s) => move(s, params.target, params),
      instruction: `[${sceneName} scene] ${instr}`,
      targetIds: [params.target],
    });
  } else if (kind === "delete") {
    make({
      category: "composite_delete",
      initialSpec: initial,
      edit: (s) => deletePart(s, params.target),
      instruction: `[${sceneName} scene] ${instr}`,
      targetIds: [params.target],
    });
  } else if (kind === "add") {
    make({
      category: "composite_add",
      initialSpec: initial,
      edit: (s) => addPart(s, params.partSpec),
      instruction: `[${sceneName} scene] ${instr}`,
      targetIds: [params.partSpec.id],
    });
  }
}

// ---- 10 REPAIR -----------------------------------------------------------
// A part is offset; the task is to restore it to its original position. We
// build the broken scene by displacing one part, then the fix moves it back.
const REPAIRS = [
  ["house",    "door",     { dx: -20, dy: 0 }, "The door has slipped 20px to the left of the wall. Slide it back into place (x: 36→56). Wall + window + chimney unchanged."],
  ["house",    "window",   { dx:  20, dy: 0 }, "The window is 20px off to the right. Slide it back to its proper position (x: 52→32)."],
  ["clock",    "minute-hand", { dx: 0, dy: -20 }, "The minute hand has rotated up off the clock face. Restore it to 3 o'clock (y2: 44→64, x2: stays at 88)."],
  ["envelope", "stamp",    { dx:  20, dy:  10 }, "The stamp drifted down-right. Move it back to x=92, y=32."],
  ["face",     "blush-right", { dx: 0, dy: -20 }, "The right blush floated up. Move it back to cy=70 (currently cy=50)."],
  ["cart",     "wheel-left", { dx: -16, dy: 0 }, "The left wheel rolled left. Restore it under the cart (cx: 36→52)."],
  ["cart",     "wheel-right", { dx: 16, dy: 0 }, "The right wheel rolled right. Restore it under the cart (cx: 108→92)."],
  ["pin",      "pin-dot",  { dx: 0, dy: 18 }, "The pin-dot slid down off the head of the pin. Move it back up (cy: 64→46)."],
  ["bell",     "badge",    { dx: 0, dy: 24 }, "The badge fell down off the bell. Restore it to cx=92, cy=28."],
  ["gift",     "bow-knot", { dx: 24, dy: 0 }, "The bow-knot shifted right. Restore it to cx=64 (currently cx=88)."],
];

for (const [sceneName, target, breakDelta, instr] of REPAIRS) {
  const broken = SCENES[sceneName]();
  const part = broken.parts.find((p) => p.id === target);
  if (!part) throw new Error(`${sceneName} has no part ${target}`);
  // Apply the displacement in-place to construct the broken initial spec.
  for (const k of ["cx", "x", "x1", "x2"]) if (part[k] !== undefined) part[k] += breakDelta.dx;
  for (const k of ["cy", "y", "y1", "y2"]) if (part[k] !== undefined) part[k] += breakDelta.dy;
  if (part.points) part.points = part.points.map(([x, y]) => [x + breakDelta.dx, y + breakDelta.dy]);
  const fix = { dx: -breakDelta.dx, dy: -breakDelta.dy };
  make({
    category: "repair",
    initialSpec: broken,
    edit: (s) => move(s, target, fix),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: [target],
  });
}

const tasks = write(OUT);
console.log(`medium: wrote ${tasks.length} tasks`);
