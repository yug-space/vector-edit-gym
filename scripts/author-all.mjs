// Author 100 tasks across 3 tiers:
//
//   easy        20  — single-attribute manipulation on a real icon (recolor,
//                     stroke-width, scale, viewBox).
//   hard        20  — complex editing on a real icon (multi-issue: wrong color
//                     base + clipped viewBox; subtle scale + recolor; etc.).
//   very_hard   60  — step-by-step CREATION workflow. 10 composite scenes,
//                     each broken into 6 ordered drawing steps. At each
//                     step the model sees the partial scene and must add
//                     ONE new element at exact coordinates.
//
// No two tasks share a base icon for the easy/hard tiers. Workflow tasks
// share scene labels across their steps (that's the point — they show the
// scene being built).

import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderScene, sceneIds, cloneSpec } from "./lib/icon-render.mjs";
import {
  corruptIconColor,
  corruptStrokeWidth,
  corruptScale,
  corruptClippedViewBox,
  corruptMulti,
} from "./lib/corruptions.mjs";
import { WORKFLOWS, workflowNames } from "./lib/workflow-scenes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const OUT = join(DATA, "tasks");

// ---- pool of real icons (single-icon tiers) -----------------------------
const POOL = readFileSync(join(DATA, "icon-pool.txt"), "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const friendlyName = (sourcePath) => {
  const file = sourcePath.split("/").pop().replace(/\.svg$/, "");
  return file.replace(/-/g, " ");
};

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

// ---- TASKS accumulator --------------------------------------------------
const TASKS = [];
const usedSources = new Set();
const usedInstructions = new Set();

const add = (id, difficulty, category, sceneBuilder, corruption, instruction, sourceTag) => {
  if (sourceTag && usedSources.has(sourceTag)) throw new Error(`source reused: ${sourceTag}`);
  if (usedInstructions.has(instruction)) throw new Error(`duplicate instruction: ${instruction}`);
  if (sourceTag) usedSources.add(sourceTag);
  usedInstructions.add(instruction);
  TASKS.push({ id, difficulty, category, sceneBuilder, corruption, instruction });
};

let poolIdx = 0;
const nextIcon = () => POOL[poolIdx++];

// ==========================================================================
// EASY (20) — single-attribute manipulation
// ==========================================================================
const EASY_RECIPES = [
  // 6 wrong_color
  { kind: "wrong_color", hex: "#e63946", cn: "red" },
  { kind: "wrong_color", hex: "#3b82f6", cn: "blue" },
  { kind: "wrong_color", hex: "#22c55e", cn: "green" },
  { kind: "wrong_color", hex: "#fde047", cn: "yellow" },
  { kind: "wrong_color", hex: "#a855f7", cn: "purple" },
  { kind: "wrong_color", hex: "#f97316", cn: "orange" },
  // 6 wrong_stroke_width
  { kind: "wrong_stroke_width", wrong: 4,   dir: "too thick" },
  { kind: "wrong_stroke_width", wrong: 0.5, dir: "too thin" },
  { kind: "wrong_stroke_width", wrong: 3,   dir: "too heavy" },
  { kind: "wrong_stroke_width", wrong: 0.7, dir: "too faint" },
  { kind: "wrong_stroke_width", wrong: 4.5, dir: "too thick" },
  { kind: "wrong_stroke_width", wrong: 0.4, dir: "too thin" },
  // 4 wrong_scale
  { kind: "wrong_scale", wrong: 64, dir: "small" },
  { kind: "wrong_scale", wrong: 124, dir: "large" },
  { kind: "wrong_scale", wrong: 56, dir: "small" },
  { kind: "wrong_scale", wrong: 120, dir: "large" },
  // 4 clipped_viewbox
  { kind: "clipped_viewbox", w: 80, h: 80 },
  { kind: "clipped_viewbox", w: 96, h: 80 },
  { kind: "clipped_viewbox", w: 72, h: 72 },
  { kind: "clipped_viewbox", w: 64, h: 64 },
];

EASY_RECIPES.forEach((recipe, i) => {
  const src = nextIcon();
  const name = friendlyName(src);
  const id = `ea_${String(i + 1).padStart(3, "0")}`;
  let corruption, instruction;
  switch (recipe.kind) {
    case "wrong_color":
      corruption = (s) => corruptIconColor(s, recipe.hex, "#222");
      instruction = `The ${name} icon has been tinted ${recipe.cn}. Restore its default black outline.`;
      break;
    case "wrong_stroke_width":
      corruption = (s) => corruptStrokeWidth(s, recipe.wrong, 1.5);
      instruction = `The ${name} icon's stroke is ${recipe.dir} (currently ${recipe.wrong}). Reset stroke-width to 1.5.`;
      break;
    case "wrong_scale":
      corruption = (s) => corruptScale(s, recipe.wrong, 112);
      instruction = `The ${name} icon is too ${recipe.dir} (currently size ${recipe.wrong}). Restore it to size 112.`;
      break;
    case "clipped_viewbox":
      corruption = (s) => corruptClippedViewBox(s, recipe.w, recipe.h);
      instruction = `The ${name} icon is being clipped by a ${recipe.w}x${recipe.h} canvas. Expand the viewBox to 128x128.`;
      break;
  }
  add(id, "easy", recipe.kind, () => sceneBase(src), corruption, instruction, src);
});

// ==========================================================================
// HARD (20) — complex multi-issue editing
// ==========================================================================
const HARD_RECIPES = [
  // 8 wrong_color + clipped_viewbox combo
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#e63946", cn: "red",    w: 80,  h: 80 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#3b82f6", cn: "blue",   w: 96,  h: 80 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#22c55e", cn: "green",  w: 72,  h: 72 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#fde047", cn: "yellow", w: 80,  h: 96 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#a855f7", cn: "purple", w: 64,  h: 64 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#f97316", cn: "orange", w: 88,  h: 80 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#ec4899", cn: "pink",   w: 80,  h: 88 },
  { kinds: ["wrong_color", "clipped_viewbox"], hex: "#06b6d4", cn: "cyan",   w: 72,  h: 80 },
  // 6 wrong_color + wrong_stroke_width combo
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#e63946", cn: "red",    wrong: 4,   dir: "too thick" },
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#3b82f6", cn: "blue",   wrong: 0.5, dir: "too thin" },
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#22c55e", cn: "green",  wrong: 3.5, dir: "too heavy" },
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#a855f7", cn: "purple", wrong: 0.6, dir: "too faint" },
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#f97316", cn: "orange", wrong: 4,   dir: "too thick" },
  { kinds: ["wrong_color", "wrong_stroke_width"], hex: "#ec4899", cn: "pink",   wrong: 0.5, dir: "too thin" },
  // 6 wrong_scale + wrong_stroke_width combo
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 64,  size_dir: "small", wrong_sw: 4,   sw_dir: "too thick" },
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 124, size_dir: "large", wrong_sw: 0.5, sw_dir: "too thin" },
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 56,  size_dir: "small", wrong_sw: 3,   sw_dir: "too heavy" },
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 120, size_dir: "large", wrong_sw: 0.6, sw_dir: "too faint" },
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 60,  size_dir: "small", wrong_sw: 4,   sw_dir: "too thick" },
  { kinds: ["wrong_scale", "wrong_stroke_width"], wrong_size: 116, size_dir: "large", wrong_sw: 0.4, sw_dir: "too thin" },
];

HARD_RECIPES.forEach((recipe, i) => {
  const src = nextIcon();
  const name = friendlyName(src);
  const id = `ha_${String(i + 1).padStart(3, "0")}`;
  let corruption, instruction;
  if (recipe.kinds[0] === "wrong_color" && recipe.kinds[1] === "clipped_viewbox") {
    corruption = (s) => corruptMulti(s, [
      (x) => corruptIconColor(x, recipe.hex, "#222"),
      (x) => corruptClippedViewBox(x, recipe.w, recipe.h),
    ]);
    instruction = `The ${name} icon has two problems: it's been tinted ${recipe.cn} AND the canvas is clipping it (currently ${recipe.w}x${recipe.h}). Restore the original black color and expand the viewBox to 128x128.`;
  } else if (recipe.kinds[0] === "wrong_color" && recipe.kinds[1] === "wrong_stroke_width") {
    corruption = (s) => corruptMulti(s, [
      (x) => corruptIconColor(x, recipe.hex, "#222"),
      (x) => corruptStrokeWidth(x, recipe.wrong, 1.5),
    ]);
    instruction = `The ${name} icon has two issues: it's been tinted ${recipe.cn} AND its stroke is ${recipe.dir} (${recipe.wrong}). Restore black color and stroke-width 1.5.`;
  } else if (recipe.kinds[0] === "wrong_scale" && recipe.kinds[1] === "wrong_stroke_width") {
    corruption = (s) => corruptMulti(s, [
      (x) => corruptScale(x, recipe.wrong_size, 112),
      (x) => corruptStrokeWidth(x, recipe.wrong_sw, 1.5),
    ]);
    instruction = `The ${name} icon was scaled wrong (size ${recipe.wrong_size}, too ${recipe.size_dir}) AND its stroke is ${recipe.sw_dir} (${recipe.wrong_sw}). Restore size 112 and stroke-width 1.5.`;
  }
  add(id, "hard", recipe.kinds.join("+"), () => sceneBase(src), corruption, instruction, src);
});

// ==========================================================================
// VERY HARD (60) — step-by-step creation workflow
// ==========================================================================
//
// Each scene has 7 parts. The FIRST part is the start state (drawn already).
// We emit one task per "middle" step (parts[1]..parts[6]):
//
//   step N task: initial = parts[0..N-1], target = parts[0..N], add parts[N]
//
// 10 scenes × 6 middle steps = 60 tasks. Instructions are simple natural
// language ("Add the front door.") — the model has to infer the exact
// shape/position from what's already on the canvas + the prompt.

let vhCounter = 0;

for (const scene of workflowNames()) {
  const wf = WORKFLOWS[scene];
  const total = wf.parts.length;
  // Start at index 1 (skip the base part). Each iteration generates one task.
  for (let n = 1; n < total; n++) {
    vhCounter++;
    const id = `vh_${String(vhCounter).padStart(3, "0")}`;
    const partialParts = wf.parts.slice(0, n);
    const fullParts = wf.parts.slice(0, n + 1);
    const newPart = wf.parts[n];

    const initialSpec = { canvas: wf.canvas, bg: wf.bg, parts: partialParts.map(cloneSpec) };
    const targetSpec  = { canvas: wf.canvas, bg: wf.bg, parts: fullParts.map(cloneSpec)    };

    const corruption = () => ({
      corrupted: cloneSpec(initialSpec),
      fix: (corrInput) => {
        const next = cloneSpec(corrInput);
        next.parts = [...(next.parts ?? []), cloneSpec(newPart)];
        return {
          spec: next,
          diff: [{ part: newPart.id, attribute: "exists", before: false, after: true, added: newPart }],
        };
      },
    });

    add(id, "very_hard", "creation_step", () => initialSpec, corruption, newPart.prompt, `wf:${scene}:${n}`);
  }
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

for (const t of TASKS) {
  const clean = t.sceneBuilder();
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
console.log(`authored ${TASKS.length} tasks (${byDiff.easy} easy + ${byDiff.hard} hard + ${byDiff.very_hard} very_hard workflow steps)`);
console.log(`unique base icons (easy/hard tiers): ${usedSources.size - 60} ... wait, includes wf tags`);
console.log(`unique instructions: ${usedInstructions.size}`);
