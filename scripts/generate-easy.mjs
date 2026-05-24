// Easy — 70 tasks.
//
// Composite real-icon scene (e.g. house, clock, smiley) with ONE obvious
// thing wrong. NL instructions only.
//
//   25 missing_part
//   20 extra_part
//   15 miscolor_part
//   10 displaced_part        (obvious offsets, easy to spot)

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES, sceneNames } from "./lib/icon-scenes.mjs";
import {
  corruptMissingPart,
  corruptExtraPart,
  corruptMiscolorPart,
  corruptDisplacedPart,
} from "./lib/corruptions.mjs";
import { instructionFor } from "./lib/nl.mjs";
import { iconTaskBuilder } from "./lib/icon-emit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "tasks");

const { make, write } = iconTaskBuilder("ea", "easy");

// Friendly scene names for instruction templates.
const SCENE_LABEL = {
  house: "house", clock: "clock face", envelope: "envelope", bell: "bell",
  face: "smiley face", heart: "heart", cart: "shopping cart", pin: "map pin",
  gift: "gift box", flag: "flag", bulb: "light bulb", cog: "settings cog",
};

// Each scene exposes which of its parts are good candidates for each kind
// of corruption. (Some parts are too small or visually meaningless to remove.)
const PARTS = {
  house:    ["door", "window", "chimney", "doorknob"],
  clock:    ["hour-hand", "minute-hand", "pivot"],
  envelope: ["stamp", "urgent", "address"],
  bell:     ["badge", "ringer", "badge-count"],
  face:     ["tear-left", "blush-left", "blush-right"],
  heart:    ["crack", "arrow"],
  cart:     ["wheel-left", "wheel-right", "item-1", "item-2"],
  pin:      ["pin-dot", "shadow"],
  gift:     ["bow-left", "bow-right", "bow-knot"],
  flag:     ["pole-tip", "windline"],
  bulb:     ["halo", "filament"],
  cog:      ["center-dot", "rotation-arrow"],
};

const allScenes = sceneNames();

// Round-robin scene/part picker that varies by tier counter.
const pickSceneAndPart = (i) => {
  // step through scenes deterministically; for each scene cycle through its parts
  let count = 0;
  for (let pass = 0; pass < 100; pass++) {
    for (const s of allScenes) {
      const parts = PARTS[s];
      for (const p of parts) {
        if (count === i) return { scene: s, part: p };
        count++;
      }
    }
  }
  throw new Error("out of pairs");
};

// ---- 25 missing_part -----------------------------------------------------
for (let i = 0; i < 25; i++) {
  const { scene, part } = pickSceneAndPart(i);
  const clean = SCENES[scene]();
  const { corrupted, fix, params } = corruptMissingPart(clean, part);
  make({
    category: "missing_part",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "missing_part", params, sceneName: SCENE_LABEL[scene], seed: i }),
    targetIds: [part],
  });
}

// ---- 20 extra_part -------------------------------------------------------
// We inject a stray annotation primitive (red dot / blue line / etc.) into a
// composite scene. The model must remove ONLY that primitive.
const EXTRAS = [
  ["house",    { id: "stray-dot", type: "circle", cx: 24, cy: 100, r: 4, fill: "#e63946" }, "stray red dot"],
  ["clock",    { id: "stray-line", type: "line", x1: 16, y1: 16, x2: 112, y2: 112, stroke: "#e63946", strokeWidth: 2 }, "diagonal red line"],
  ["envelope", { id: "smudge", type: "rect", x: 88, y: 88, width: 10, height: 8, fill: "#9ca3af" }, "gray smudge"],
  ["bell",     { id: "scribble", type: "line", x1: 30, y1: 30, x2: 60, y2: 50, stroke: "#3b82f6", strokeWidth: 2 }, "blue scribble"],
  ["face",     { id: "extra-eye", type: "circle", cx: 64, cy: 38, r: 4, fill: "#222" }, "extra dark dot above the eyes"],
  ["heart",    { id: "stray-x", type: "line", x1: 24, y1: 24, x2: 104, y2: 104, stroke: "#222", strokeWidth: 2 }, "diagonal cross-out line"],
  ["cart",     { id: "stray-square", type: "rect", x: 90, y: 30, width: 8, height: 8, fill: "#a855f7" }, "stray purple square"],
  ["pin",      { id: "scribble", type: "circle", cx: 30, cy: 30, r: 5, fill: "#fde047" }, "extra yellow dot"],
  ["gift",     { id: "extra-mark", type: "line", x1: 20, y1: 110, x2: 108, y2: 110, stroke: "#e63946", strokeWidth: 2 }, "red baseline"],
  ["flag",     { id: "smudge", type: "circle", cx: 96, cy: 80, r: 4, fill: "#9ca3af" }, "gray smudge"],
  ["bulb",     { id: "extra-dot", type: "circle", cx: 40, cy: 110, r: 3, fill: "#3b82f6" }, "extra blue dot"],
  ["cog",      { id: "scribble", type: "rect", x: 100, y: 100, width: 10, height: 10, fill: "#22c55e" }, "stray green square"],
  ["house",    { id: "graffiti", type: "rect", x: 40, y: 110, width: 30, height: 4, fill: "#a855f7" }, "purple graffiti bar"],
  ["face",     { id: "mole", type: "circle", cx: 88, cy: 86, r: 2, fill: "#222" }, "extra dark dot on the cheek"],
  ["envelope", { id: "extra-dot", type: "circle", cx: 24, cy: 24, r: 3, fill: "#e63946" }, "extra red dot in the corner"],
  ["clock",    { id: "extra-tick", type: "rect", x: 100, y: 20, width: 4, height: 6, fill: "#e63946" }, "extra red tick mark"],
  ["bell",     { id: "extra-line", type: "line", x1: 16, y1: 120, x2: 112, y2: 120, stroke: "#222", strokeWidth: 2 }, "extra horizontal line at the bottom"],
  ["heart",    { id: "extra-dot", type: "circle", cx: 100, cy: 24, r: 3, fill: "#fde047" }, "extra yellow dot"],
  ["cart",     { id: "extra-handle", type: "line", x1: 30, y1: 30, x2: 50, y2: 50, stroke: "#92400e", strokeWidth: 3 }, "extra brown handle"],
  ["bulb",     { id: "extra-line", type: "line", x1: 16, y1: 16, x2: 30, y2: 30, stroke: "#222", strokeWidth: 1 }, "extra short line in the corner"],
];

for (let i = 0; i < 20; i++) {
  const [scene, extraPart, label] = EXTRAS[i];
  const clean = SCENES[scene]();
  const { corrupted, fix, params } = corruptExtraPart(clean, extraPart);
  // For NL phrasing, we want "{part}" to read like "stray red dot" — override
  // by passing a friendlier params.part.
  const friendlyParams = { ...params, part: label };
  make({
    category: "extra_part",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "extra_part", params: friendlyParams, sceneName: SCENE_LABEL[scene], seed: i }),
    targetIds: [extraPart.id],
  });
}

// ---- 15 miscolor_part ----------------------------------------------------
const MISCOLORS = ["#e63946", "#3b82f6", "#22c55e", "#fde047", "#a855f7", "#f97316", "#ec4899"];

for (let i = 0; i < 15; i++) {
  const { scene, part } = pickSceneAndPart(i + 7);
  const wrong = MISCOLORS[i % MISCOLORS.length];
  const clean = SCENES[scene]();
  const { corrupted, fix, params } = corruptMiscolorPart(clean, part, wrong);
  make({
    category: "miscolor_part",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "miscolor", params, sceneName: SCENE_LABEL[scene], seed: i }),
    targetIds: [part],
  });
}

// ---- 10 displaced_part ---------------------------------------------------
// Obvious offsets (16-24px) so the misalignment is unmistakable.
const OBVIOUS_OFFSETS = [
  { dx:  20, dy:   0 }, { dx: -20, dy:   0 },
  { dx:   0, dy:  20 }, { dx:   0, dy: -20 },
  { dx:  16, dy:  12 }, { dx: -16, dy:  12 },
  { dx: -16, dy: -12 }, { dx:  16, dy: -12 },
  { dx:  24, dy:   0 }, { dx: -24, dy:   0 },
];

for (let i = 0; i < 10; i++) {
  const { scene, part } = pickSceneAndPart(i + 13);
  const offset = OBVIOUS_OFFSETS[i];
  const clean = SCENES[scene]();
  const { corrupted, fix, params } = corruptDisplacedPart(clean, part, offset);
  make({
    category: "displaced_part",
    initialSpec: corrupted,
    edit: fix,
    instruction: instructionFor({ kind: "displaced", params, sceneName: SCENE_LABEL[scene], seed: i }),
    targetIds: [part],
  });
}

const tasks = write(OUT);
console.log(`easy: wrote ${tasks.length} tasks`);
