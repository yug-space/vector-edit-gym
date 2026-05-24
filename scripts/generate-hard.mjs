// Hard — 60 tasks.
//
// Composite real-icon scenes (Heroicon base + 3-4 detail parts) PLUS dense
// real-icon scenes (6+ icons). Preservation matters: most parts must stay
// exactly identical.
//
//   15 local preservation     — edit ONE specific composite part among many
//   15 align/restore          — composite repair with non-obvious offsets
//   10 simplify-down          — keep only listed parts; drop everything else
//   10 multi-icon preservation — recolor/move one icon in a 6+ icon scene
//   10 surgical add           — add an exact primitive into a composite scene

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { place } from "./lib/icon-catalog.mjs";
import { recolor, restroke, move, resize, addPart, deletePart } from "./lib/icon-edits.mjs";
import { cloneSpec, sceneIds } from "./lib/icon-render.mjs";
import { SCENES } from "./lib/icon-scenes.mjs";
import { iconTaskBuilder } from "./lib/icon-emit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "tasks");

const { make, write } = iconTaskBuilder("ha", "hard");

// keepOnly: delete every part except the listed ids; returns {spec, diff}.
const keepOnly = (spec, keepIds) => {
  const next = cloneSpec(spec);
  const keep = new Set(keepIds);
  const diff = [];
  const survivors = [];
  for (const p of next.parts ?? []) {
    if (keep.has(p.id)) {
      survivors.push(p);
    } else {
      diff.push({ part: p.id, attribute: "exists", before: true, after: false, removed: p });
    }
  }
  next.parts = survivors;
  // base is never dropped by simplification
  return { spec: next, diff };
};

// ---- 15 LOCAL PRESERVATION ----------------------------------------------
const LOCAL = [
  ["house",    "door",     { kind: "color",  value: "#3b82f6" }, "Make ONLY the door blue (#3b82f6). The home outline, window, chimney, doorknob must remain pixel-identical."],
  ["house",    "window",   { kind: "color",  value: "#fde047" }, "Make ONLY the window yellow (#fde047). Door, chimney, doorknob, home outline unchanged."],
  ["house",    "chimney",  { kind: "resize", value: 0.6      }, "Shrink ONLY the chimney to 60% of its original size (around its own center). Door, window, doorknob, home outline unchanged."],
  ["clock",    "minute-hand", { kind: "move", value: { dx: 0, dy: -24 } }, "Point ONLY the minute hand straight UP at 12 (shift its y2 by -24, from 64 to 40). Hour-hand + pivot + clock outline unchanged."],
  ["clock",    "hour-hand", { kind: "move",  value: { dx: 26, dy: 26 } }, "Point ONLY the hour hand toward 4:30 (shift x2 by +26, y2 by +26). Minute-hand + pivot + clock outline unchanged."],
  ["envelope", "stamp",    { kind: "resize", value: 1.25     }, "Enlarge ONLY the stamp by 25% (around its own center). Urgent, address, envelope outline unchanged."],
  ["bell",     "badge",    { kind: "color",  value: "#3b82f6" }, "Repaint ONLY the badge blue (#3b82f6). Bell outline, ringer, badge-count unchanged."],
  ["face",     "blush-left", { kind: "color", value: "#a855f7" }, "Repaint ONLY the left blush purple (#a855f7). Right blush + tear + face unchanged."],
  ["face",     "tear-left", { kind: "color", value: "#22c55e" }, "Repaint ONLY the tear-left green (#22c55e) — change its stroke. Blushes + face unchanged."],
  ["cart",     "item-1",   { kind: "resize", value: 1.5      }, "Enlarge ONLY item-1 (the rectangle inside the cart) by 50%. Item-2, wheels, base cart unchanged."],
  ["pin",      "pin-dot",  { kind: "resize", value: 1.5      }, "Enlarge ONLY the pin-dot by 50% (around its own center). Shadow + map-pin outline unchanged."],
  ["gift",     "bow-knot", { kind: "color",  value: "#3b82f6" }, "Repaint ONLY the bow-knot blue (#3b82f6). Both bow circles + gift outline unchanged."],
  ["flag",     "windline", { kind: "color",  value: "#22c55e" }, "Repaint ONLY the windline green (#22c55e) — change its stroke. Pole-tip + flag outline unchanged."],
  ["bulb",     "halo",     { kind: "resize", value: 1.3      }, "Enlarge ONLY the halo by 30% (around its own center). Filament + bulb outline unchanged."],
  ["cog",      "center-dot", { kind: "color", value: "#22c55e" }, "Repaint ONLY the center-dot green (#22c55e). Rotation-arrow + cog outline unchanged."],
];

for (const [sceneName, target, op, instr] of LOCAL) {
  const initial = SCENES[sceneName]();
  let editFn;
  if (op.kind === "color") {
    // for line/polyline targets that have stroke instead of fill, route to restroke
    const part = initial.parts.find((p) => p.id === target);
    if (part && (part.type === "line" || part.type === "polyline")) {
      editFn = (s) => restroke(s, target, { stroke: op.value });
    } else {
      editFn = (s) => recolor(s, target, op.value);
    }
  } else if (op.kind === "resize") {
    editFn = (s) => resize(s, target, { factor: op.value });
  } else if (op.kind === "move") {
    editFn = (s) => move(s, target, op.value);
  }
  make({
    category: "local_preservation",
    initialSpec: initial,
    edit: editFn,
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: [target],
  });
}

// ---- 15 ALIGN / RESTORE --------------------------------------------------
// Composite scenes with one part offset; the task is to slide it back
// EXACTLY (off-by-one tolerance only).
const ALIGN = [
  ["house",    "door",     { dx: -16, dy: 0 }, "The door has slipped 16px to the left (x is now 40). Slide it back to x=56. Other parts pixel-identical."],
  ["house",    "window",   { dx:  16, dy: 0 }, "The window is 16px too far right (x=48). Move it back to x=32."],
  ["house",    "chimney",  { dx:   0, dy:14 }, "The chimney sank 14px (y=40). Raise it back to y=26."],
  ["house",    "doorknob", { dx:  -6, dy: 0 }, "The doorknob slipped 6px left (cx=64). Restore it to cx=70."],
  ["clock",    "hour-hand", { dx: 12, dy: 0 }, "The hour-hand tip has drifted right (x2=76). Restore it to x2=64."],
  ["clock",    "minute-hand", { dx: 0, dy: 14 }, "The minute-hand tip dropped (y2=78). Restore it to y2=64."],
  ["clock",    "pivot",    { dx:   4, dy: 4 }, "The pivot is off-center (cx=68, cy=68). Restore it to cx=64, cy=64."],
  ["envelope", "stamp",    { dx:   0, dy:10 }, "The stamp slid down (y=42). Move it back to y=32."],
  ["envelope", "urgent",   { dx:  10, dy: 0 }, "The urgent dot drifted right (cx=110). Restore it to cx=100."],
  ["bell",     "ringer",   { dx:  -8, dy: 0 }, "The ringer is off-center (cx=56). Restore it to cx=64."],
  ["bell",     "badge",    { dx: -10, dy: 6 }, "The badge slipped down-left (cx=82, cy=34). Restore it to cx=92, cy=28."],
  ["face",     "blush-left", { dx: 8, dy: 0 }, "The left blush slid right (cx=44). Restore it to cx=36."],
  ["face",     "blush-right", { dx: -8, dy: 0 }, "The right blush slid left (cx=84). Restore it to cx=92."],
  ["cart",     "wheel-left", { dx: -8, dy: 4 }, "Left wheel rolled down-left (cx=44, cy=114). Restore to cx=52, cy=110."],
  ["cart",     "wheel-right", { dx: 8, dy: 4 }, "Right wheel rolled down-right (cx=100, cy=114). Restore to cx=92, cy=110."],
];

for (const [sceneName, target, breakDelta, instr] of ALIGN) {
  const broken = SCENES[sceneName]();
  const part = broken.parts.find((p) => p.id === target);
  for (const k of ["cx", "x", "x1", "x2"]) if (part[k] !== undefined) part[k] += breakDelta.dx;
  for (const k of ["cy", "y", "y1", "y2"]) if (part[k] !== undefined) part[k] += breakDelta.dy;
  if (part.points) part.points = part.points.map(([x, y]) => [x + breakDelta.dx, y + breakDelta.dy]);
  const fix = { dx: -breakDelta.dx, dy: -breakDelta.dy };
  make({
    category: "align_restore",
    initialSpec: broken,
    edit: (s) => move(s, target, fix),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: [target],
  });
}

// ---- 10 SIMPLIFY-DOWN ----------------------------------------------------
const SIMPLIFY = [
  ["house",    ["door", "window"],          "Strip the house back to its essentials. Keep ONLY door and window (drop chimney + doorknob). The home outline (base) always stays."],
  ["clock",    ["minute-hand"],             "Strip the clock: keep ONLY the minute-hand (drop hour-hand and pivot). The clock outline always stays."],
  ["envelope", ["address"],                 "Strip the envelope: keep ONLY the address line (drop stamp and urgent). Envelope outline stays."],
  ["bell",     ["ringer"],                  "Strip the bell: keep ONLY the ringer (drop badge and badge-count). Bell outline stays."],
  ["face",     ["blush-left", "blush-right"], "Wipe the tear: keep ONLY blush-left and blush-right. Tear-left is dropped. Face outline stays."],
  ["cart",     ["wheel-left", "wheel-right"], "Empty the cart: keep ONLY both wheels (drop item-1 and item-2). Cart outline stays."],
  ["pin",      ["pin-dot"],                 "Drop the shadow: keep ONLY pin-dot. Map-pin outline stays."],
  ["gift",     ["bow-knot"],                "Tighten the bow: keep ONLY bow-knot (drop bow-left and bow-right). Gift outline stays."],
  ["bulb",     ["filament"],                "Dim the bulb: keep ONLY filament (drop halo). Bulb outline stays."],
  ["cog",      ["center-dot"],              "Strip the cog: keep ONLY center-dot (drop rotation-arrow). Cog outline stays."],
];

for (const [sceneName, keepList, instr] of SIMPLIFY) {
  const initial = SCENES[sceneName]();
  const allParts = initial.parts.map((p) => p.id);
  const dropped = allParts.filter((id) => !keepList.includes(id));
  make({
    category: "simplify",
    initialSpec: initial,
    edit: (s) => keepOnly(s, keepList),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: dropped,
  });
}

// ---- 10 MULTI-ICON PRESERVATION -----------------------------------------
// Dense scenes of 6 real icons; recolor or move one.
const DENSE = [
  ["home", "heart", "star", "sun", "moon", "cloud"],
  ["bell", "envelope", "phone", "microphone", "cog", "user"],
  ["shopping-cart", "gift", "tag", "truck", "key", "lock-closed"],
  ["document", "folder", "bookmark", "trash", "magnifying-glass", "globe-alt"],
  ["chart-bar", "chart-pie", "clock", "calendar", "camera", "photo"],
];

for (let i = 0; i < 10; i++) {
  const names = DENSE[i % DENSE.length];
  const targetIdx = (i * 3) % names.length;
  const target = names[targetIdx];
  // 3x2 layout on a 256x128 canvas
  const initial = {
    canvas: [256, 128],
    bg: "white",
    parts: names.map((n, idx) =>
      place(n, {
        id: n,
        x: 16 + (idx % 3) * 80,
        y: 16 + Math.floor(idx / 3) * 56,
        size: 48,
        color: "#222",
      }),
    ),
  };
  if (i % 2 === 0) {
    const color = ["#e63946", "#3b82f6", "#22c55e", "#fde047", "#a855f7"][i % 5];
    make({
      category: "multi_icon_preserve",
      initialSpec: initial,
      edit: (s) => recolor(s, target, color),
      instruction: `Six icons in a 3×2 grid (${names.join(", ")}). Recolor ONLY the ${target} to ${color}. The other five must remain at #222.`,
      targetIds: [target],
    });
  } else {
    make({
      category: "multi_icon_preserve",
      initialSpec: initial,
      edit: (s) => restroke(s, target, { strokeWidth: 3 }),
      instruction: `Six icons in a 3×2 grid (${names.join(", ")}). Bolden ONLY the ${target} to stroke-width 3. The other five must remain at the default 1.5.`,
      targetIds: [target],
    });
  }
}

// ---- 10 SURGICAL ADD ----------------------------------------------------
// Add an exact primitive into a composite scene at named coordinates.
const ADDS = [
  ["house",    { id: "fence-post-1", type: "rect",   x: 20,  y: 100, width: 2,  height: 12, fill: "#92400e" }, "Add a fence post next to the house: rect x=20, y=100, w=2, h=12, fill #92400e."],
  ["house",    { id: "smoke", type: "ellipse", cx: 88, cy: 18, rx: 5, ry: 3, fill: "#9ca3af" }, "Add smoke above the chimney: ellipse cx=88, cy=18, rx=5, ry=3, fill #9ca3af."],
  ["clock",    { id: "second-hand", type: "line", x1: 64, y1: 64, x2: 64, y2: 28, stroke: "#e63946", strokeWidth: 1 }, "Add a second-hand: line (64,64)→(64,28), stroke #e63946, stroke-width 1."],
  ["clock",    { id: "mark-12", type: "rect", x: 62, y: 18, width: 4, height: 6, fill: "#222" }, "Add a 12-o'clock tick mark: rect x=62, y=18, w=4, h=6, fill #222."],
  ["envelope", { id: "wax-seal", type: "circle", cx: 64, cy: 80, r: 5, fill: "#e63946" }, "Add a wax seal in the center of the envelope: circle cx=64, cy=80, r=5, fill #e63946."],
  ["bell",     { id: "wave-1", type: "polyline", points: [[14, 60], [20, 56], [14, 52]], stroke: "#222", strokeWidth: 1, fill: "none" }, "Add a sound wave on the left of the bell: polyline (14,60)→(20,56)→(14,52), stroke #222, stroke-width 1, no fill."],
  ["face",     { id: "monocle", type: "circle", cx: 80, cy: 56, r: 10, fill: "none", stroke: "#222", strokeWidth: 2 }, "Add a monocle around the right eye: circle cx=80, cy=56, r=10, fill none, stroke #222, stroke-width 2."],
  ["cart",     { id: "price-tag", type: "rect", x: 56, y: 30, width: 16, height: 10, fill: "#fde047", stroke: "#222", strokeWidth: 1 }, "Add a price-tag above the cart: rect x=56, y=30, w=16, h=10, fill #fde047, stroke #222, stroke-width 1."],
  ["gift",     { id: "ribbon-horiz", type: "line", x1: 20, y1: 70, x2: 108, y2: 70, stroke: "#e63946", strokeWidth: 3 }, "Add a horizontal ribbon across the gift: line (20,70)→(108,70), stroke #e63946, stroke-width 3."],
  ["flag",     { id: "stripe", type: "rect", x: 38, y: 38, width: 52, height: 6, fill: "#3b82f6" }, "Add a blue stripe on the flag: rect x=38, y=38, w=52, h=6, fill #3b82f6."],
];

for (const [sceneName, partSpec, instr] of ADDS) {
  const initial = SCENES[sceneName]();
  make({
    category: "surgical_add",
    initialSpec: initial,
    edit: (s) => addPart(s, partSpec),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds: [partSpec.id],
  });
}

const tasks = write(OUT);
console.log(`hard: wrote ${tasks.length} tasks`);
