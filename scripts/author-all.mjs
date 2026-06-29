// Author exactly 106 hand-curated v1 tasks.
//
// V2 intentionally emits a separate scenic minimal-editing curriculum. Each
// task starts from a busy SVG scene with a small programmatic corruption and a
// known minimal repair. The prompt exposes exact repair values, then scoring
// checks both the expected local fix and whether unrelated scene parts changed.
//
// This file intentionally uses one named task function per task. The helpers
// keep rendering/corruption mechanics consistent, while the task functions
// make the curriculum easy to audit for uniqueness and prompt quality.

import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderScene, sceneIds, cloneSpec } from "./lib/icon-render.mjs";
import {
  corruptMissingPart,
  corruptExtraPart,
  corruptDisplacedPart,
  corruptMiscolorPart,
  corruptIconColor,
  corruptStrokeWidth,
  corruptScale,
  corruptClippedViewBox,
  corruptFlippedPart,
  corruptDuplicatePart,
  corruptMulti,
} from "./lib/corruptions.mjs";
import { WORKFLOWS } from "./lib/workflow-scenes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const PROMPT_VERSION = argValue("--prompt-version") ?? (process.argv.includes("--v2") ? "v2" : "v1");
if (!["v1", "v2"].includes(PROMPT_VERSION)) {
  throw new Error(`unknown prompt version: ${PROMPT_VERSION}`);
}

const SCENIC_V2_EXPECTED_COUNT = 20;

const OUT = argValue("--out")
  ? resolve(process.cwd(), argValue("--out"))
  : join(DATA, PROMPT_VERSION === "v2" ? "tasks_v2" : "tasks");

const POOL = readFileSync(join(DATA, "icon-pool.txt"), "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const friendlyName = (sourcePath) => {
  const file = sourcePath.split("/").pop().replace(/\.svg$/, "");
  return file.replace(/-/g, " ");
};

const iconSource = (index) => {
  const src = POOL[index];
  if (!src) throw new Error(`icon pool is missing index ${index}`);
  return src;
};

const iconScene = (sourcePath) => ({
  canvas: [128, 128],
  bg: "white",
  parts: [
    {
      id: "icon",
      type: "icon",
      source: sourcePath,
      name: friendlyName(sourcePath),
      x: 8,
      y: 8,
      size: 112,
      color: "#222",
      strokeWidth: 1.5,
    },
  ],
});

const workflowSpec = (scene, end = undefined) => {
  const wf = WORKFLOWS[scene];
  if (!wf) throw new Error(`unknown workflow scene ${scene}`);
  return {
    canvas: wf.canvas,
    bg: wf.bg,
    parts: wf.parts.slice(0, end).map(cloneSpec),
  };
};

const workflowPart = (scene, partIndex) => {
  const part = WORKFLOWS[scene]?.parts[partIndex];
  if (!part) throw new Error(`unknown workflow part ${scene}[${partIndex}]`);
  return part;
};

const TASKS = [];
const usedTaskIds = new Set();
const usedSourceTags = new Set();
const usedBaseIconSources = new Set();
const usedInstructions = new Set();

const add = (id, difficulty, category, sceneBuilder, corruption, instruction, sourceTag) => {
  if (usedTaskIds.has(id)) throw new Error(`duplicate task id: ${id}`);
  if (sourceTag && usedSourceTags.has(sourceTag)) throw new Error(`source reused: ${sourceTag}`);
  if (usedInstructions.has(instruction)) throw new Error(`duplicate instruction: ${instruction}`);
  usedTaskIds.add(id);
  if (sourceTag) {
    usedSourceTags.add(sourceTag);
    if (!sourceTag.includes(":")) usedBaseIconSources.add(sourceTag);
  }
  usedInstructions.add(instruction);
  TASKS.push({ id, difficulty, category, sceneBuilder, corruption, instruction });
};

const addIconTask = ({ id, difficulty, category, iconIndex, instruction, corruption }) => {
  const src = iconSource(iconIndex);
  add(id, difficulty, category, () => iconScene(src), corruption, instruction, src);
};

const addLogoTask = ({ id, source, instruction, corruption }) => {
  add(id, "hard", "company_logo_multi_repair", () => iconScene(source), corruption, instruction, source);
};

const addWorkflowRepairTask = ({ id, difficulty = "medium", category, scene, instruction, corruption }) => {
  add(id, difficulty, category, () => workflowSpec(scene), corruption, instruction, `repair:${id}`);
};

const addCreationTask = ({ id, scene, partIndex, instruction }) => {
  const added = workflowPart(scene, partIndex);
  const initialSpec = workflowSpec(scene, partIndex);
  const targetSpec = workflowSpec(scene, partIndex + 1);
  add(
    id,
    "very_hard",
    "creation_step",
    () => targetSpec,
    () => ({
      corrupted: cloneSpec(initialSpec),
      fix: () => ({
        spec: cloneSpec(targetSpec),
        diff: [{ part: added.id, attribute: "exists", before: false, after: true, added: cloneSpec(added) }],
      }),
    }),
    instruction,
    `creation:${id}`,
  );
};

const diffAttributeName = (attr) => attr === "strokeWidth" ? "stroke-width" : attr;

const corruptPartAttr = (clean, partId, attr, wrongValue) => {
  const corrupted = cloneSpec(clean);
  const p = corrupted.parts.find((x) => x.id === partId);
  if (!p) throw new Error(`no part ${partId}`);
  const originalValue = p[attr];
  p[attr] = wrongValue;
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.parts.find((x) => x.id === partId);
      t[attr] = originalValue;
      return {
        spec: next,
        diff: [{
          part: partId,
          attribute: diffAttributeName(attr),
          before: wrongValue,
          after: originalValue,
        }],
      };
    },
    params: { kind: "wrong_attr", part: partId, attr: diffAttributeName(attr), wrongValue, originalValue },
  };
};

const HEX_RE = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const COLOR_ATTRS = new Set(["color", "fill", "stroke"]);

const formatValue = (value) => JSON.stringify(value);
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const svgElementForPart = (p) => {
  const base = `id="${escAttr(p.id)}"`;
  const paint = [];
  if (p.fill !== undefined) paint.push(`fill="${escAttr(p.fill)}"`);
  if (p.stroke !== undefined) paint.push(`stroke="${escAttr(p.stroke)}"`);
  if (p.strokeWidth !== undefined) paint.push(`stroke-width="${escAttr(p.strokeWidth)}"`);
  if (p.opacity !== undefined) paint.push(`opacity="${escAttr(p.opacity)}"`);
  switch (p.type) {
    case "rect":
      return `<rect ${base} ${paint.join(" ")} x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"${p.rx !== undefined ? ` rx="${p.rx}"` : ""}${p.ry !== undefined ? ` ry="${p.ry}"` : ""} />`;
    case "circle":
      return `<circle ${base} ${paint.join(" ")} cx="${p.cx}" cy="${p.cy}" r="${p.r}" />`;
    case "ellipse":
      return `<ellipse ${base} ${paint.join(" ")} cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" />`;
    case "polygon":
      return `<polygon ${base} ${paint.join(" ")} points="${p.points.map((q) => q.join(",")).join(" ")}" />`;
    case "line":
      return `<line ${base} ${paint.join(" ")} x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" />`;
    case "polyline": {
      const attrs = p.fill === undefined ? [...paint, `fill="none"`] : paint;
      return `<polyline ${base} ${attrs.join(" ")} points="${p.points.map((q) => q.join(",")).join(" ")}" />`;
    }
    case "path":
      return `<path ${base} ${paint.join(" ")} d="${escAttr(p.d)}" />`;
    default:
      return null;
  }
};

const augmentV2Diff = (diff, corrupted, target) => {
  const out = [];
  const targetIds = sceneIds(target);
  for (const entry of diff) {
    const next = { ...entry };
    if (entry.added) {
      const index = targetIds.indexOf(entry.part);
      next.insert_index = index;
      next.insert_after = index > 0 ? targetIds[index - 1] : null;
      next.insert_before = index >= 0 && index < targetIds.length - 1 ? targetIds[index + 1] : null;
      next.final_part_order = targetIds;
      const svgElement = svgElementForPart(entry.added);
      if (svgElement) next.svg_element = svgElement;
    }
    out.push(next);

    if (entry.part === "__svg" && entry.attribute === "viewBox") {
      const [beforeW, beforeH] = corrupted.canvas;
      const [afterW, afterH] = target.canvas;
      out.push({ part: "__svg", attribute: "width", before: beforeW, after: afterW });
      out.push({ part: "__svg", attribute: "height", before: beforeH, after: afterH });
      if (target.bg) {
        out.push({ part: "__bg", attribute: "width", before: beforeW, after: afterW });
        out.push({ part: "__bg", attribute: "height", before: beforeH, after: afterH });
      }
    }
  }
  return out;
};

const collectHexValues = (value, out = new Set()) => {
  if (typeof value === "string") {
    if (HEX_RE.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHexValues(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectHexValues(item, out);
  }
  return out;
};

const targetHexValues = (diff) => {
  const values = new Set();
  for (const entry of diff) {
    collectHexValues(entry.after, values);
    collectHexValues(entry.added, values);
  }
  return [...values];
};

const changeLine = (entry) => {
  if (entry.attribute === "exists" && entry.after === true) {
    return `add ${entry.part}: ${entry.svg_element ?? formatValue(entry.added)}`;
  }
  if (entry.attribute === "exists" && entry.after === false) {
    return `remove ${entry.part}`;
  }
  return `${entry.part}.${entry.attribute}: ${formatValue(entry.before)} -> ${formatValue(entry.after)}`;
};

const v2Instruction = (baseInstruction, diff) => {
  const lines = [
    baseInstruction,
    "",
    "Patch:",
    ...diff.map((entry) => `- ${changeLine(entry)}`),
  ];
  return lines.join("\n");
};

// Easy: single-icon visual repairs.
function task001() { addIconTask({ id: "ea_001", difficulty: "easy", category: "wrong_color", iconIndex: 0, instruction: "The academic cap picked up a red accent. Put it back as a plain black outline.", corruption: (s) => corruptIconColor(s, "#e63946", "#222") }); }
function task002() { addIconTask({ id: "ea_002", difficulty: "easy", category: "wrong_color", iconIndex: 1, instruction: "The adjustment sliders should not be blue. Restore the standard monochrome outline.", corruption: (s) => corruptIconColor(s, "#3b82f6", "#222") }); }
function task003() { addIconTask({ id: "ea_003", difficulty: "easy", category: "wrong_color", iconIndex: 2, instruction: "The vertical adjustment control has an accidental green tint. Make it look like a normal outline icon again.", corruption: (s) => corruptIconColor(s, "#22c55e", "#222") }); }
function task004() { addIconTask({ id: "ea_004", difficulty: "easy", category: "wrong_color", iconIndex: 3, instruction: "The archive download icon was highlighted yellow by mistake. Return it to the usual black outline.", corruption: (s) => corruptIconColor(s, "#fde047", "#222") }); }
function task005() { addIconTask({ id: "ea_005", difficulty: "easy", category: "wrong_color", iconIndex: 4, instruction: "The archive removal icon has a purple cast. Remove the tint and keep the outline style.", corruption: (s) => corruptIconColor(s, "#a855f7", "#222") }); }
function task006() { addIconTask({ id: "ea_006", difficulty: "easy", category: "wrong_color", iconIndex: 5, instruction: "The archive box should be a neutral outline, not orange. Restore its default look.", corruption: (s) => corruptIconColor(s, "#f97316", "#222") }); }
function task007() { addIconTask({ id: "ea_007", difficulty: "easy", category: "wrong_color", iconIndex: 6, instruction: "The at-sign has a pink tint that does not belong. Make it a clean black outline again.", corruption: (s) => corruptIconColor(s, "#ec4899", "#222") }); }
function task008() { addIconTask({ id: "ea_008", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 7, instruction: "The backspace icon's lines look too bold. Bring the outline weight back to normal.", corruption: (s) => corruptStrokeWidth(s, 4, 1.5) }); }
function task009() { addIconTask({ id: "ea_009", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 8, instruction: "The banknotes icon is too faint to match the set. Restore the usual line weight.", corruption: (s) => corruptStrokeWidth(s, 0.5, 1.5) }); }
function task010() { addIconTask({ id: "ea_010", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 9, instruction: "The empty battery outline is heavier than it should be. Match the normal icon weight.", corruption: (s) => corruptStrokeWidth(s, 3.5, 1.5) }); }
function task011() { addIconTask({ id: "ea_011", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 10, instruction: "The full battery icon looks unusually delicate. Restore the standard outline thickness.", corruption: (s) => corruptStrokeWidth(s, 0.6, 1.5) }); }
function task012() { addIconTask({ id: "ea_012", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 11, instruction: "The half battery icon has oversized strokes. Make the line weight consistent with the default set.", corruption: (s) => corruptStrokeWidth(s, 4.5, 1.5) }); }
function task013() { addIconTask({ id: "ea_013", difficulty: "easy", category: "wrong_scale", iconIndex: 12, instruction: "The beaker is undersized on the canvas. Restore its normal centered presence.", corruption: (s) => corruptScale(s, 64, 112) }); }
function task014() { addIconTask({ id: "ea_014", difficulty: "easy", category: "wrong_scale", iconIndex: 13, instruction: "The alert bell is crowding the canvas. Resize it back to the standard icon fit.", corruption: (s) => corruptScale(s, 124, 112) }); }
function task015() { addIconTask({ id: "ea_015", difficulty: "easy", category: "wrong_scale", iconIndex: 14, instruction: "The muted bell looks shrunken. Return it to the usual centered scale.", corruption: (s) => corruptScale(s, 56, 112) }); }
function task016() { addIconTask({ id: "ea_016", difficulty: "easy", category: "wrong_scale", iconIndex: 15, instruction: "The snooze bell is slightly too large for the canvas. Restore the balanced icon size.", corruption: (s) => corruptScale(s, 120, 112) }); }
function task017() { addIconTask({ id: "ea_017", difficulty: "easy", category: "wrong_scale", iconIndex: 16, instruction: "The regular bell no longer matches the icon set's sizing. Put it back to the normal fit.", corruption: (s) => corruptScale(s, 68, 112) }); }
function task018() { addIconTask({ id: "ea_018", difficulty: "easy", category: "clipped_viewbox", iconIndex: 17, instruction: "The bold text icon is cropped. Fix the canvas so the entire mark is visible.", corruption: (s) => corruptClippedViewBox(s, 80, 80) }); }
function task019() { addIconTask({ id: "ea_019", difficulty: "easy", category: "clipped_viewbox", iconIndex: 18, instruction: "The disabled lightning bolt is cut off at the edges. Restore the full visible icon.", corruption: (s) => corruptClippedViewBox(s, 96, 80) }); }
function task020() { addIconTask({ id: "ea_020", difficulty: "easy", category: "clipped_viewbox", iconIndex: 19, instruction: "The lightning bolt does not fit inside its viewport. Make the complete outline show again.", corruption: (s) => corruptClippedViewBox(s, 72, 72) }); }
function task021() { addIconTask({ id: "ea_021", difficulty: "easy", category: "wrong_color", iconIndex: 20, instruction: "The open book has been colored cyan. Return it to a simple black outline.", corruption: (s) => corruptIconColor(s, "#06b6d4", "#222") }); }
function task022() { addIconTask({ id: "ea_022", difficulty: "easy", category: "wrong_stroke_width", iconIndex: 21, instruction: "The slashed bookmark's outline is barely visible. Restore the normal stroke weight.", corruption: (s) => corruptStrokeWidth(s, 0.4, 1.5) }); }
function task023() { addIconTask({ id: "ea_023", difficulty: "easy", category: "wrong_scale", iconIndex: 22, instruction: "The square bookmark is a little oversized. Bring it back to the standard centered scale.", corruption: (s) => corruptScale(s, 116, 112) }); }
function task024() { addIconTask({ id: "ea_024", difficulty: "easy", category: "clipped_viewbox", iconIndex: 23, instruction: "The bookmark is partly outside the visible area. Repair the viewport so the whole shape appears.", corruption: (s) => corruptClippedViewBox(s, 88, 96) }); }
function task025() { addIconTask({ id: "ea_025", difficulty: "easy", category: "wrong_color", iconIndex: 24, instruction: "The briefcase picked up a red tint. Restore the icon to the neutral outline style.", corruption: (s) => corruptIconColor(s, "#e63946", "#222") }); }

// Medium: varied composite-scene repairs.
function task026() { addWorkflowRepairTask({ id: "me_001", category: "missing_part", scene: "house", instruction: "The house lost its roof. Rebuild the missing top piece.", corruption: (s) => corruptMissingPart(s, "roof") }); }
function task027() { addWorkflowRepairTask({ id: "me_002", category: "missing_part", scene: "smiley", instruction: "The face has eyes and cheeks but no smile. Add the missing mouth back.", corruption: (s) => corruptMissingPart(s, "mouth") }); }
function task028() { addWorkflowRepairTask({ id: "me_003", category: "missing_part", scene: "car", instruction: "The car body is missing its windshield. Restore the glass area.", corruption: (s) => corruptMissingPart(s, "window") }); }
function task029() { addWorkflowRepairTask({ id: "me_004", category: "missing_part", scene: "cake", instruction: "The birthday cake needs its candle restored on top.", corruption: (s) => corruptMissingPart(s, "candle") }); }
function task030() { addWorkflowRepairTask({ id: "me_005", category: "missing_part", scene: "rocket", instruction: "The rocket is missing its round porthole. Put the window back.", corruption: (s) => corruptMissingPart(s, "window") }); }
function task031() { addWorkflowRepairTask({ id: "me_006", category: "extra_part", scene: "house", instruction: "A stray blue spot was added to the house wall. Remove the unwanted mark.", corruption: (s) => corruptExtraPart(s, { id: "stray-wall-dot", type: "circle", cx: 64, cy: 74, r: 4, fill: "#3b82f6" }) }); }
function task032() { addWorkflowRepairTask({ id: "me_007", category: "extra_part", scene: "smiley", instruction: "The smiley has an extra eyebrow-like stroke above one eye. Clean it off.", corruption: (s) => corruptExtraPart(s, { id: "extra-brow", type: "line", x1: 43, y1: 42, x2: 58, y2: 39, stroke: "#222", strokeWidth: 2 }) }); }
function task033() { addWorkflowRepairTask({ id: "me_008", category: "extra_part", scene: "clock", instruction: "The clock face has a stray side tick that should not be there. Remove the extra mark.", corruption: (s) => corruptExtraPart(s, { id: "extra-tick", type: "rect", x: 18, y: 62, width: 8, height: 4, fill: "#222" }) }); }
function task034() { addWorkflowRepairTask({ id: "me_009", category: "extra_part", scene: "boat", instruction: "A loose rock appeared in the water under the boat. Delete the stray shape.", corruption: (s) => corruptExtraPart(s, { id: "stray-rock", type: "ellipse", cx: 46, cy: 116, rx: 7, ry: 3, fill: "#777777" }) }); }
function task035() { addWorkflowRepairTask({ id: "me_010", category: "extra_part", scene: "flower", instruction: "The flower has an extra petal that breaks the simple four-petal bloom. Remove it.", corruption: (s) => corruptExtraPart(s, { id: "extra-petal", type: "ellipse", cx: 78, cy: 38, rx: 9, ry: 15, fill: "#ec4899" }) }); }
function task036() { addWorkflowRepairTask({ id: "me_011", category: "displaced_part", scene: "house", instruction: "The front door slid away from the center of the house. Move it back into place.", corruption: (s) => corruptDisplacedPart(s, "door", { dx: 18, dy: 0 }) }); }
function task037() { addWorkflowRepairTask({ id: "me_012", category: "displaced_part", scene: "car", instruction: "The car's right wheel floated upward. Put it back under the body.", corruption: (s) => corruptDisplacedPart(s, "wheel-right", { dx: 0, dy: -12 }) }); }
function task038() { addWorkflowRepairTask({ id: "me_013", category: "displaced_part", scene: "tree", instruction: "The leafy crown no longer sits on the trunk. Recenter it above the tree.", corruption: (s) => corruptDisplacedPart(s, "crown", { dx: -14, dy: 0 }) }); }
function task039() { addWorkflowRepairTask({ id: "me_014", category: "displaced_part", scene: "cup", instruction: "The cup handle drifted into the body. Move it back to the outside edge.", corruption: (s) => corruptDisplacedPart(s, "handle", { dx: -16, dy: 0 }) }); }
function task040() { addWorkflowRepairTask({ id: "me_015", category: "displaced_part", scene: "rocket", instruction: "The rocket flame is tucked too high into the body. Place it back underneath.", corruption: (s) => corruptDisplacedPart(s, "flame", { dx: 0, dy: -12 }) }); }
function task041() { addWorkflowRepairTask({ id: "me_016", category: "wrong_part_color", scene: "house", instruction: "The house window no longer reads as glass. Restore its original window color.", corruption: (s) => corruptMiscolorPart(s, "window", "#e63946") }); }
function task042() { addWorkflowRepairTask({ id: "me_017", category: "wrong_part_color", scene: "smiley", instruction: "The left cheek blush turned into a dark mark. Restore the soft blush color.", corruption: (s) => corruptMiscolorPart(s, "blush-left", "#222") }); }
function task043() { addWorkflowRepairTask({ id: "me_018", category: "wrong_part_color", scene: "tree", instruction: "The fruit on the right blends into the leaves. Make it match the other fruit again.", corruption: (s) => corruptMiscolorPart(s, "fruit-2", "#3a9d5d") }); }
function task044() { addWorkflowRepairTask({ id: "me_019", category: "wrong_part_color", scene: "boat", instruction: "The sail was painted like the water. Restore the sail's warm color.", corruption: (s) => corruptMiscolorPart(s, "sail", "#3b82f6") }); }
function task045() { addWorkflowRepairTask({ id: "me_020", category: "wrong_part_color", scene: "rocket", instruction: "The rocket nose cone lost its accent color. Repaint it to match the fins.", corruption: (s) => corruptMiscolorPart(s, "nose-cone", "#cccccc") }); }
function task046() { addWorkflowRepairTask({ id: "me_021", category: "duplicate_part", scene: "smiley", instruction: "The face has one eye mark too many. Remove the copied eye.", corruption: (s) => corruptDuplicatePart(s, "eye-left", { dx: 10, dy: 2 }) }); }
function task047() { addWorkflowRepairTask({ id: "me_022", category: "duplicate_part", scene: "clock", instruction: "A second minute hand was copied onto the clock. Keep only the intended hand.", corruption: (s) => corruptDuplicatePart(s, "minute-hand", { dx: 0, dy: 8 }) }); }
function task048() { addWorkflowRepairTask({ id: "me_023", category: "duplicate_part", scene: "car", instruction: "The car has an extra wheel mark near the left side. Remove the duplicate.", corruption: (s) => corruptDuplicatePart(s, "wheel-left", { dx: 16, dy: 0 }) }); }
function task049() { addWorkflowRepairTask({ id: "me_024", category: "duplicate_part", scene: "cup", instruction: "There is one steam wisp too many above the cup. Delete the copied wisp.", corruption: (s) => corruptDuplicatePart(s, "steam-2", { dx: 10, dy: 0 }) }); }
function task050() { addWorkflowRepairTask({ id: "me_025", category: "duplicate_part", scene: "flower", instruction: "A second leaf was accidentally added to the stem. Remove the duplicate leaf.", corruption: (s) => corruptDuplicatePart(s, "leaf", { dx: -16, dy: -4 }) }); }
function task051() { addWorkflowRepairTask({ id: "me_026", category: "flipped_part", scene: "boat", instruction: "The sail leans the wrong way. Flip it back so it attaches naturally to the mast.", corruption: (s) => corruptFlippedPart(s, "sail") }); }
function task052() { addWorkflowRepairTask({ id: "me_027", category: "flipped_part", scene: "rocket", instruction: "The left fin faces inward instead of bracing the rocket. Turn it back around.", corruption: (s) => corruptFlippedPart(s, "fin-left") }); }
function task053() { addWorkflowRepairTask({ id: "me_028", category: "flipped_part", scene: "rocket", instruction: "The right fin is mirrored away from its proper stance. Restore its orientation.", corruption: (s) => corruptFlippedPart(s, "fin-right") }); }
function task054() { addWorkflowRepairTask({ id: "me_029", category: "flipped_part", scene: "cup", instruction: "The left steam curl bends the wrong direction. Mirror it back into the rising steam pattern.", corruption: (s) => corruptFlippedPart(s, "steam-1") }); }
function task055() { addWorkflowRepairTask({ id: "me_030", category: "flipped_part", scene: "rocket", instruction: "The small corner star has been mirrored. Restore its original sparkle shape.", corruption: (s) => corruptFlippedPart(s, "star") }); }
function task056() { addWorkflowRepairTask({ id: "me_031", category: "multi_repair", scene: "house", instruction: "Fix the house details: the window color is wrong and the chimney was copied.", corruption: (s) => corruptMulti(s, [(x) => corruptMiscolorPart(x, "window", "#f97316"), (x) => corruptDuplicatePart(x, "chimney", { dx: -18, dy: 4 })]) }); }
function task057() { addWorkflowRepairTask({ id: "me_032", category: "multi_repair", scene: "car", instruction: "Repair the car's front details by restoring the headlight and bringing back the plate.", corruption: (s) => corruptMulti(s, [(x) => corruptMiscolorPart(x, "headlight", "#222"), (x) => corruptMissingPart(x, "license-plate")]) }); }
function task058() { addWorkflowRepairTask({ id: "me_033", category: "multi_repair", scene: "clock", instruction: "Clean up the clock face: the center dot color is wrong and one side mark was duplicated.", corruption: (s) => corruptMulti(s, [(x) => corruptMiscolorPart(x, "pivot", "#222"), (x) => corruptDuplicatePart(x, "mark-3", { dx: -10, dy: 0 })]) }); }
function task059() { addWorkflowRepairTask({ id: "me_034", category: "multi_repair", scene: "tree", instruction: "Restore the tree's fruit details: one fruit moved and another lost its ripe color.", corruption: (s) => corruptMulti(s, [(x) => corruptDisplacedPart(x, "fruit-1", { dx: -10, dy: 8 }), (x) => corruptMiscolorPart(x, "fruit-3", "#3a9d5d")]) }); }
function task060() { addWorkflowRepairTask({ id: "me_035", category: "multi_repair", scene: "cake", instruction: "Finish repairing the cake by restoring the cherry and the white frosting.", corruption: (s) => corruptMulti(s, [(x) => corruptMissingPart(x, "cherry"), (x) => corruptMiscolorPart(x, "frosting", "#b85c38")]) }); }

// Hard: multi-issue real-icon repairs without exact SVG values in prompts.
function task061() { addIconTask({ id: "ha_001", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 25, instruction: "The bug icon is both tinted and cropped. Restore the plain outline and make the full insect visible.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#22c55e", "#222"), (x) => corruptClippedViewBox(x, 80, 80)]) }); }
function task062() { addIconTask({ id: "ha_002", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 26, instruction: "The library building icon has the wrong color and weight. Bring it back to the standard black outline style.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#3b82f6", "#222"), (x) => corruptStrokeWidth(x, 3.5, 1.5)]) }); }
function task063() { addIconTask({ id: "ha_003", difficulty: "hard", category: "wrong_scale+wrong_stroke_width", iconIndex: 27, instruction: "The office tower looks shrunken and too heavy. Restore its normal size and outline balance.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 62, 112), (x) => corruptStrokeWidth(x, 4, 1.5)]) }); }
function task064() { addIconTask({ id: "ha_004", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 28, instruction: "The office building was recolored and clipped. Return the black outline and show the entire icon.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#f97316", "#222"), (x) => corruptClippedViewBox(x, 96, 80)]) }); }
function task065() { addIconTask({ id: "ha_005", difficulty: "hard", category: "wrong_scale+wrong_stroke_width", iconIndex: 29, instruction: "The storefront icon is oversized and too faint. Restore the usual centered outline appearance.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 124, 112), (x) => corruptStrokeWidth(x, 0.5, 1.5)]) }); }
function task066() { addIconTask({ id: "ha_006", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 30, instruction: "The cake icon should not be colored or extra bold. Reset it to the standard outline style.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#ec4899", "#222"), (x) => corruptStrokeWidth(x, 3, 1.5)]) }); }
function task067() { addIconTask({ id: "ha_007", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 31, instruction: "The calculator icon is tinted and partly cut off. Make it a complete neutral outline again.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#a855f7", "#222"), (x) => corruptClippedViewBox(x, 72, 88)]) }); }
function task068() { addIconTask({ id: "ha_008", difficulty: "hard", category: "wrong_scale+wrong_stroke_width", iconIndex: 32, instruction: "The date-range calendar has the wrong size and line weight. Put it back into the default icon style.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 58, 112), (x) => corruptStrokeWidth(x, 0.6, 1.5)]) }); }
function task069() { addIconTask({ id: "ha_009", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 33, instruction: "The calendar days icon is colored and too heavy. Restore the regular black outline.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#fde047", "#222"), (x) => corruptStrokeWidth(x, 4, 1.5)]) }); }
function task070() { addIconTask({ id: "ha_010", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 34, instruction: "The calendar is both green and cropped. Return it to a full black outline icon.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#22c55e", "#222"), (x) => corruptClippedViewBox(x, 80, 96)]) }); }
function task071() { addIconTask({ id: "ha_011", difficulty: "hard", category: "wrong_scale+clipped_viewbox", iconIndex: 35, instruction: "The camera is mis-sized and clipped by its canvas. Restore the normal fit with the whole camera visible.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 122, 112), (x) => corruptClippedViewBox(x, 88, 80)]) }); }
function task072() { addIconTask({ id: "ha_012", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 36, instruction: "The chart tile has an unwanted blue tint and thin lines. Restore the default outline treatment.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#3b82f6", "#222"), (x) => corruptStrokeWidth(x, 0.5, 1.5)]) }); }
function task073() { addIconTask({ id: "ha_013", difficulty: "hard", category: "wrong_scale+wrong_stroke_width", iconIndex: 37, instruction: "The bar chart looks too small and too bold. Bring it back to the normal icon proportions.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 64, 112), (x) => corruptStrokeWidth(x, 3.5, 1.5)]) }); }
function task074() { addIconTask({ id: "ha_014", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 38, instruction: "The pie chart icon was tinted and cropped. Restore the complete black outline.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#e63946", "#222"), (x) => corruptClippedViewBox(x, 76, 76)]) }); }
function task075() { addIconTask({ id: "ha_015", difficulty: "hard", category: "wrong_stroke_width+clipped_viewbox", iconIndex: 39, instruction: "The text chat bubble has the wrong line weight and is cut off. Fix the outline and viewport together.", corruption: (s) => corruptMulti(s, [(x) => corruptStrokeWidth(x, 4, 1.5), (x) => corruptClippedViewBox(x, 96, 72)]) }); }
function task076() { addIconTask({ id: "ha_016", difficulty: "hard", category: "wrong_color+wrong_scale", iconIndex: 40, instruction: "The centered chat bubble is tinted and no longer fits the canvas correctly. Restore the default look.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#06b6d4", "#222"), (x) => corruptScale(x, 60, 112)]) }); }
function task077() { addIconTask({ id: "ha_017", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 41, instruction: "The chat bubble with ellipsis has the wrong color and heavy strokes. Return it to the regular outline style.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#f97316", "#222"), (x) => corruptStrokeWidth(x, 4.2, 1.5)]) }); }
function task078() { addIconTask({ id: "ha_018", difficulty: "hard", category: "wrong_scale+clipped_viewbox", iconIndex: 42, instruction: "The left-right chat icon is oversized and clipped. Make it fit normally with no edges cut off.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 126, 112), (x) => corruptClippedViewBox(x, 88, 88)]) }); }
function task079() { addIconTask({ id: "ha_019", difficulty: "hard", category: "wrong_color+clipped_viewbox", iconIndex: 43, instruction: "The single chat bubble is purple and cropped. Restore the full neutral outline.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#a855f7", "#222"), (x) => corruptClippedViewBox(x, 80, 72)]) }); }
function task080() { addIconTask({ id: "ha_020", difficulty: "hard", category: "wrong_color+wrong_stroke_width", iconIndex: 44, instruction: "The oval chat bubble has a stray tint and weak strokes. Put it back to the default outline weight and color.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#ec4899", "#222"), (x) => corruptStrokeWidth(x, 0.45, 1.5)]) }); }

// Hard: company logo repairs from the bundled Feather brand SVGs.
function task101() { addLogoTask({ id: "ha_021", source: "feather/github.svg", instruction: "The GitHub logo has a bad tint, heavy outline, and a stray slash through it. Restore the clean original mark.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#3b82f6", "#222"), (x) => corruptStrokeWidth(x, 4, 1.5), (x) => corruptExtraPart(x, { id: "stray-slash", type: "line", x1: 20, y1: 108, x2: 108, y2: 20, stroke: "#e63946", strokeWidth: 5 })]) }); }
function task102() { addLogoTask({ id: "ha_022", source: "feather/gitlab.svg", instruction: "The GitLab logo is cropped, recolored, and has a ghost copy behind it. Return it to one complete neutral outline.", corruption: (s) => corruptMulti(s, [(x) => corruptIconColor(x, "#f97316", "#222"), (x) => corruptDuplicatePart(x, "icon", { dx: 10, dy: 8 }), (x) => corruptClippedViewBox(x, 92, 92)]) }); }
function task103() { addLogoTask({ id: "ha_023", source: "feather/figma.svg", instruction: "The Figma logo is too small, colored incorrectly, and has an extra dot beside it. Restore the single balanced outline.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 64, 112), (x) => corruptIconColor(x, "#a855f7", "#222"), (x) => corruptExtraPart(x, { id: "extra-dot", type: "circle", cx: 100, cy: 32, r: 6, fill: "#22c55e" })]) }); }
function task104() { addLogoTask({ id: "ha_024", source: "feather/chrome.svg", instruction: "The Chrome logo outline is faint, clipped, and has an extra center ring. Restore the complete original icon.", corruption: (s) => corruptMulti(s, [(x) => corruptStrokeWidth(x, 0.45, 1.5), (x) => corruptClippedViewBox(x, 86, 86), (x) => corruptExtraPart(x, { id: "extra-center-ring", type: "circle", cx: 64, cy: 64, r: 18, fill: "none", stroke: "#e63946", strokeWidth: 3 })]) }); }
function task105() { addLogoTask({ id: "ha_025", source: "feather/instagram.svg", instruction: "The Instagram logo is oversized, tinted, and duplicated slightly off-center. Keep one normal outline logo.", corruption: (s) => corruptMulti(s, [(x) => corruptScale(x, 124, 112), (x) => corruptIconColor(x, "#ec4899", "#222"), (x) => corruptDuplicatePart(x, "icon", { dx: -8, dy: 8 })]) }); }
function task106() { addLogoTask({ id: "ha_026", source: "feather/slack.svg", instruction: "The Slack logo is cropped, too bold, and has an unwanted corner mark. Restore the full clean outline.", corruption: (s) => corruptMulti(s, [(x) => corruptStrokeWidth(x, 4.2, 1.5), (x) => corruptClippedViewBox(x, 88, 96), (x) => corruptExtraPart(x, { id: "corner-mark", type: "rect", x: 94, y: 14, width: 16, height: 16, fill: "#fde047" })]) }); }

// Very hard: contextual creation steps.
function task081() { addCreationTask({ id: "vh_001", scene: "house", partIndex: 1, instruction: "Finish the basic house silhouette by adding the roof." }); }
function task082() { addCreationTask({ id: "vh_002", scene: "house", partIndex: 4, instruction: "Add the chimney that belongs on the roof." }); }
function task083() { addCreationTask({ id: "vh_003", scene: "smiley", partIndex: 1, instruction: "Give the face its first eye." }); }
function task084() { addCreationTask({ id: "vh_004", scene: "smiley", partIndex: 4, instruction: "Add the smile so the expression reads happy." }); }
function task085() { addCreationTask({ id: "vh_005", scene: "clock", partIndex: 1, instruction: "Add the top tick mark to start the clock face." }); }
function task086() { addCreationTask({ id: "vh_006", scene: "clock", partIndex: 4, instruction: "Add the shorter hand pointing upward from the center." }); }
function task087() { addCreationTask({ id: "vh_007", scene: "car", partIndex: 1, instruction: "Build the top cabin of the car." }); }
function task088() { addCreationTask({ id: "vh_008", scene: "car", partIndex: 4, instruction: "Add the second wheel so the car stands evenly." }); }
function task089() { addCreationTask({ id: "vh_009", scene: "tree", partIndex: 1, instruction: "Add the leafy canopy above the trunk." }); }
function task090() { addCreationTask({ id: "vh_010", scene: "tree", partIndex: 4, instruction: "Place one small fruit in the open space on the lower crown." }); }
function task091() { addCreationTask({ id: "vh_011", scene: "cake", partIndex: 1, instruction: "Add the lower cake layer on the plate." }); }
function task092() { addCreationTask({ id: "vh_012", scene: "cake", partIndex: 4, instruction: "Put a candle on top of the cake." }); }
function task093() { addCreationTask({ id: "vh_013", scene: "boat", partIndex: 1, instruction: "Raise the mast from the boat." }); }
function task094() { addCreationTask({ id: "vh_014", scene: "boat", partIndex: 2, instruction: "Add the sail attached to the mast." }); }
function task095() { addCreationTask({ id: "vh_015", scene: "cup", partIndex: 1, instruction: "Set the cup on a saucer." }); }
function task096() { addCreationTask({ id: "vh_016", scene: "cup", partIndex: 3, instruction: "Add steam rising above the cup." }); }
function task097() { addCreationTask({ id: "vh_017", scene: "flower", partIndex: 1, instruction: "Add the first petal above the stem." }); }
function task098() { addCreationTask({ id: "vh_018", scene: "flower", partIndex: 5, instruction: "Complete the bloom with its center." }); }
function task099() { addCreationTask({ id: "vh_019", scene: "rocket", partIndex: 1, instruction: "Cap the rocket with a nose cone." }); }
function task100() { addCreationTask({ id: "vh_020", scene: "rocket", partIndex: 5, instruction: "Add the flame below the rocket." }); }

const TASK_AUTHORS = [
  task001, task002, task003, task004, task005, task006, task007, task008, task009, task010,
  task011, task012, task013, task014, task015, task016, task017, task018, task019, task020,
  task021, task022, task023, task024, task025, task026, task027, task028, task029, task030,
  task031, task032, task033, task034, task035, task036, task037, task038, task039, task040,
  task041, task042, task043, task044, task045, task046, task047, task048, task049, task050,
  task051, task052, task053, task054, task055, task056, task057, task058, task059, task060,
  task061, task062, task063, task064, task065, task066, task067, task068, task069, task070,
  task071, task072, task073, task074, task075, task076, task077, task078, task079, task080,
  task101, task102, task103, task104, task105, task106,
  task081, task082, task083, task084, task085, task086, task087, task088, task089, task090,
  task091, task092, task093, task094, task095, task096, task097, task098, task099, task100,
];

for (const author of TASK_AUTHORS) author();

if (TASKS.length !== 106) throw new Error(`expected 106 tasks, got ${TASKS.length}`);
if (usedInstructions.size !== 106) throw new Error(`expected 106 unique instructions, got ${usedInstructions.size}`);
if (usedTaskIds.size !== 106) throw new Error(`expected 106 unique task ids, got ${usedTaskIds.size}`);

const scenicTransitScene = () => ({
  canvas: [220, 140],
  bg: "#f8fafc",
  parts: [
    { id: "sky-band", type: "rect", x: 0, y: 0, width: 220, height: 64, fill: "#e0f2fe" },
    { id: "overhead-wire", type: "path", d: "M8 18 C42 10 74 10 108 18 S176 26 212 18", fill: "none", stroke: "#334155", strokeWidth: 1 },
    { id: "station-wall", type: "rect", x: 0, y: 64, width: 220, height: 30, fill: "#f1f5f9" },
    { id: "platform", type: "rect", x: 0, y: 94, width: 220, height: 46, fill: "#d1d5db" },
    { id: "platform-edge", type: "rect", x: 0, y: 94, width: 220, height: 5, fill: "#facc15" },
    { id: "platform-crack", type: "path", d: "M18 108 C32 104 42 111 56 108 S82 106 96 110", fill: "none", stroke: "#94a3b8", strokeWidth: 1 },
    { id: "rail-back", type: "line", x1: 0, y1: 118, x2: 220, y2: 118, stroke: "#64748b", strokeWidth: 3 },
    { id: "rail-front", type: "line", x1: 0, y1: 130, x2: 220, y2: 130, stroke: "#475569", strokeWidth: 3 },
    { id: "track-tie-1", type: "rect", x: 18, y: 116, width: 7, height: 18, fill: "#7c2d12" },
    { id: "track-tie-2", type: "rect", x: 56, y: 116, width: 7, height: 18, fill: "#7c2d12" },
    { id: "track-tie-3", type: "rect", x: 94, y: 116, width: 7, height: 18, fill: "#7c2d12" },
    { id: "track-tie-4", type: "rect", x: 132, y: 116, width: 7, height: 18, fill: "#7c2d12" },
    { id: "track-tie-5", type: "rect", x: 170, y: 116, width: 7, height: 18, fill: "#7c2d12" },
    { id: "train-body", type: "rect", x: 26, y: 38, width: 126, height: 46, rx: 6, ry: 6, fill: "#f97316", stroke: "#222", strokeWidth: 1.5 },
    { id: "train-roof", type: "rect", x: 34, y: 30, width: 110, height: 12, rx: 4, ry: 4, fill: "#ea580c", stroke: "#222", strokeWidth: 1 },
    { id: "window-left", type: "rect", x: 38, y: 46, width: 24, height: 16, fill: "#bfdbfe", stroke: "#222", strokeWidth: 1 },
    { id: "window-center", type: "rect", x: 68, y: 46, width: 24, height: 16, fill: "#bfdbfe", stroke: "#222", strokeWidth: 1 },
    { id: "window-right", type: "rect", x: 98, y: 46, width: 24, height: 16, fill: "#bfdbfe", stroke: "#222", strokeWidth: 1 },
    { id: "train-door", type: "rect", x: 128, y: 44, width: 16, height: 34, fill: "#fef3c7", stroke: "#222", strokeWidth: 1 },
    { id: "door-handle", type: "circle", cx: 140, cy: 61, r: 1.6, fill: "#222" },
    { id: "wheel-left", type: "circle", cx: 48, cy: 86, r: 6, fill: "#111827" },
    { id: "wheel-right", type: "circle", cx: 126, cy: 86, r: 6, fill: "#111827" },
    { id: "signal-post", type: "line", x1: 170, y1: 32, x2: 170, y2: 94, stroke: "#334155", strokeWidth: 4 },
    { id: "signal-box", type: "rect", x: 162, y: 22, width: 16, height: 34, rx: 3, ry: 3, fill: "#111827" },
    { id: "signal-red", type: "circle", cx: 170, cy: 30, r: 3, fill: "#ef4444" },
    { id: "signal-amber", type: "circle", cx: 170, cy: 39, r: 3, fill: "#f59e0b" },
    { id: "signal-green", type: "circle", cx: 170, cy: 48, r: 3, fill: "#22c55e" },
    { id: "clock-face", type: "circle", cx: 196, cy: 31, r: 12, fill: "#ffffff", stroke: "#222", strokeWidth: 1.5 },
    { id: "clock-hour", type: "line", x1: 196, y1: 31, x2: 196, y2: 23, stroke: "#222", strokeWidth: 1.5 },
    { id: "clock-minute", type: "line", x1: 196, y1: 31, x2: 203, y2: 31, stroke: "#222", strokeWidth: 1 },
    { id: "poster-blue", type: "rect", x: 178, y: 62, width: 14, height: 20, fill: "#60a5fa", stroke: "#222", strokeWidth: 0.8 },
    { id: "poster-pink", type: "rect", x: 198, y: 64, width: 12, height: 18, fill: "#f9a8d4", stroke: "#222", strokeWidth: 0.8 },
    { id: "bench-seat", type: "rect", x: 38, y: 100, width: 42, height: 5, fill: "#92400e" },
    { id: "bench-leg-left", type: "line", x1: 46, y1: 105, x2: 43, y2: 114, stroke: "#451a03", strokeWidth: 2 },
    { id: "bench-leg-right", type: "line", x1: 72, y1: 105, x2: 75, y2: 114, stroke: "#451a03", strokeWidth: 2 },
    { id: "passenger-head", type: "circle", cx: 98, cy: 96, r: 4, fill: "#f2c078" },
    { id: "passenger-body", type: "rect", x: 94, y: 100, width: 8, height: 16, fill: "#2563eb" },
    { id: "passenger-bag", type: "rect", x: 104, y: 108, width: 8, height: 7, fill: "#a16207" },
  ],
});

const scenicHarborScene = () => ({
  canvas: [220, 140],
  bg: "#eff6ff",
  parts: [
    { id: "sky", type: "rect", x: 0, y: 0, width: 220, height: 70, fill: "#bae6fd" },
    { id: "water", type: "rect", x: 0, y: 70, width: 220, height: 70, fill: "#38bdf8" },
    { id: "horizon", type: "line", x1: 0, y1: 70, x2: 220, y2: 70, stroke: "#0284c7", strokeWidth: 2 },
    { id: "sun", type: "circle", cx: 190, cy: 22, r: 12, fill: "#fde047" },
    { id: "cloud-left", type: "ellipse", cx: 36, cy: 26, rx: 18, ry: 7, fill: "#ffffff" },
    { id: "cloud-right", type: "ellipse", cx: 56, cy: 25, rx: 14, ry: 6, fill: "#ffffff" },
    { id: "pier-deck", type: "rect", x: 0, y: 88, width: 72, height: 10, fill: "#92400e" },
    { id: "rope-coil", type: "path", d: "M48 82 C58 72 70 74 70 84 C70 94 54 96 50 88 C46 80 60 78 62 86", fill: "none", stroke: "#f8fafc", strokeWidth: 2 },
    { id: "pier-leg-1", type: "line", x1: 16, y1: 96, x2: 13, y2: 132, stroke: "#451a03", strokeWidth: 4 },
    { id: "pier-leg-2", type: "line", x1: 56, y1: 96, x2: 60, y2: 132, stroke: "#451a03", strokeWidth: 4 },
    { id: "boat-hull", type: "polygon", points: [[84, 84], [158, 84], [146, 104], [96, 104]], fill: "#be123c", stroke: "#222", strokeWidth: 1 },
    { id: "boat-cabin", type: "rect", x: 106, y: 62, width: 30, height: 20, fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "cabin-window", type: "rect", x: 114, y: 67, width: 14, height: 8, fill: "#93c5fd", stroke: "#222", strokeWidth: 0.8 },
    { id: "mast", type: "line", x1: 126, y1: 84, x2: 126, y2: 26, stroke: "#222", strokeWidth: 3 },
    { id: "sail-main", type: "polygon", points: [[126, 30], [154, 76], [126, 76]], fill: "#fef3c7", stroke: "#222", strokeWidth: 1 },
    { id: "sail-small", type: "polygon", points: [[124, 34], [100, 76], [124, 76]], fill: "#e0f2fe", stroke: "#222", strokeWidth: 1 },
    { id: "flag", type: "polygon", points: [[126, 25], [140, 29], [126, 33]], fill: "#ef4444" },
    { id: "lighthouse-body", type: "polygon", points: [[176, 82], [206, 82], [200, 28], [182, 28]], fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "lighthouse-stripe-1", type: "rect", x: 181, y: 48, width: 20, height: 7, fill: "#ef4444" },
    { id: "lighthouse-stripe-2", type: "rect", x: 179, y: 64, width: 24, height: 7, fill: "#ef4444" },
    { id: "lighthouse-cap", type: "rect", x: 180, y: 22, width: 22, height: 8, fill: "#0f172a" },
    { id: "lighthouse-window", type: "rect", x: 188, y: 34, width: 6, height: 8, fill: "#fde047", stroke: "#222", strokeWidth: 0.7 },
    { id: "light-beam", type: "polygon", points: [[180, 30], [132, 18], [132, 42]], fill: "#fde68a", opacity: 0.45 },
    { id: "buoy-red", type: "circle", cx: 42, cy: 112, r: 8, fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "buoy-red-stripe", type: "rect", x: 35, y: 110, width: 14, height: 4, fill: "#ef4444" },
    { id: "buoy-green", type: "circle", cx: 184, cy: 112, r: 7, fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "buoy-green-stripe", type: "rect", x: 178, y: 110, width: 12, height: 4, fill: "#22c55e" },
    { id: "wave-1", type: "polyline", points: [[6, 122], [22, 118], [38, 122], [54, 118], [70, 122]], stroke: "#0ea5e9", strokeWidth: 2, fill: "none" },
    { id: "harbor-wave-long", type: "path", d: "M82 118 C98 112 112 124 128 118 S158 112 174 118", fill: "none", stroke: "#0ea5e9", strokeWidth: 2 },
    { id: "wave-2", type: "polyline", points: [[128, 120], [146, 116], [164, 120], [182, 116], [200, 120]], stroke: "#0ea5e9", strokeWidth: 2, fill: "none" },
    { id: "crate-left", type: "rect", x: 12, y: 76, width: 14, height: 12, fill: "#a16207", stroke: "#451a03", strokeWidth: 1 },
    { id: "crate-right", type: "rect", x: 28, y: 76, width: 14, height: 12, fill: "#b45309", stroke: "#451a03", strokeWidth: 1 },
  ],
});

const scenicCampScene = () => ({
  canvas: [220, 140],
  bg: "#111827",
  parts: [
    { id: "night-sky", type: "rect", x: 0, y: 0, width: 220, height: 88, fill: "#0f172a" },
    { id: "ground", type: "rect", x: 0, y: 88, width: 220, height: 52, fill: "#166534" },
    { id: "far-hill", type: "polygon", points: [[0, 88], [42, 50], [88, 88]], fill: "#14532d" },
    { id: "mid-hill", type: "polygon", points: [[46, 88], [104, 42], [166, 88]], fill: "#166534" },
    { id: "moon", type: "circle", cx: 184, cy: 24, r: 11, fill: "#fef3c7" },
    { id: "star-1", type: "circle", cx: 28, cy: 20, r: 2, fill: "#fde68a" },
    { id: "star-2", type: "circle", cx: 72, cy: 16, r: 1.8, fill: "#fde68a" },
    { id: "star-3", type: "circle", cx: 130, cy: 22, r: 2.2, fill: "#fde68a" },
    { id: "star-4", type: "circle", cx: 204, cy: 45, r: 1.8, fill: "#fde68a" },
    { id: "tent-body", type: "polygon", points: [[46, 96], [92, 48], [138, 96]], fill: "#f97316", stroke: "#222", strokeWidth: 1 },
    { id: "tent-side", type: "polygon", points: [[92, 48], [138, 96], [112, 96]], fill: "#ea580c", stroke: "#222", strokeWidth: 1 },
    { id: "tent-flap", type: "polygon", points: [[82, 96], [96, 66], [110, 96]], fill: "#7c2d12", stroke: "#222", strokeWidth: 1 },
    { id: "tent-line-left", type: "line", x1: 54, y1: 92, x2: 30, y2: 110, stroke: "#f8fafc", strokeWidth: 1 },
    { id: "tent-line-right", type: "line", x1: 130, y1: 92, x2: 154, y2: 110, stroke: "#f8fafc", strokeWidth: 1 },
    { id: "tree-left-trunk", type: "rect", x: 20, y: 74, width: 8, height: 34, fill: "#854d0e" },
    { id: "tree-left-crown", type: "polygon", points: [[24, 42], [8, 80], [40, 80]], fill: "#15803d" },
    { id: "tree-right-trunk", type: "rect", x: 178, y: 72, width: 8, height: 36, fill: "#854d0e" },
    { id: "tree-right-crown", type: "polygon", points: [[182, 40], [164, 82], [176, 76], [170, 94], [198, 92], [190, 76], [202, 82]], fill: "#15803d" },
    { id: "log-left", type: "line", x1: 150, y1: 112, x2: 176, y2: 122, stroke: "#92400e", strokeWidth: 5 },
    { id: "log-right", type: "line", x1: 176, y1: 112, x2: 150, y2: 122, stroke: "#92400e", strokeWidth: 5 },
    { id: "flame-back", type: "polygon", points: [[163, 110], [152, 88], [172, 101], [181, 86], [180, 114]], fill: "#f97316" },
    { id: "flame-front", type: "polygon", points: [[166, 111], [160, 96], [170, 104], [175, 96], [174, 114]], fill: "#fde047" },
    { id: "smoke-1", type: "ellipse", cx: 160, cy: 80, rx: 6, ry: 3, fill: "#94a3b8", opacity: 0.65 },
    { id: "smoke-2", type: "ellipse", cx: 174, cy: 72, rx: 7, ry: 4, fill: "#94a3b8", opacity: 0.5 },
    { id: "smoke-curl", type: "path", d: "M168 80 C154 72 178 64 164 56 C154 50 174 46 166 38", fill: "none", stroke: "#cbd5e1", strokeWidth: 1.4 },
    { id: "backpack", type: "rect", x: 36, y: 104, width: 14, height: 18, rx: 3, ry: 3, fill: "#2563eb", stroke: "#111827", strokeWidth: 1 },
    { id: "path", type: "polyline", points: [[96, 100], [108, 114], [118, 140]], stroke: "#a3e635", strokeWidth: 5, fill: "none" },
    { id: "trail-curve", type: "path", d: "M86 104 C100 112 98 126 112 140", fill: "none", stroke: "#bef264", strokeWidth: 2 },
  ],
});

const scenicMarketScene = () => ({
  canvas: [220, 140],
  bg: "#fff7ed",
  parts: [
    { id: "back-wall", type: "rect", x: 0, y: 0, width: 220, height: 82, fill: "#fed7aa" },
    { id: "street", type: "rect", x: 0, y: 82, width: 220, height: 58, fill: "#e5e7eb" },
    { id: "left-stall-counter", type: "rect", x: 18, y: 76, width: 74, height: 34, fill: "#92400e", stroke: "#451a03", strokeWidth: 1 },
    { id: "left-awning-base", type: "rect", x: 14, y: 42, width: 82, height: 18, fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "left-awning-red-1", type: "rect", x: 14, y: 42, width: 14, height: 18, fill: "#ef4444" },
    { id: "left-awning-red-2", type: "rect", x: 42, y: 42, width: 14, height: 18, fill: "#ef4444" },
    { id: "left-awning-red-3", type: "rect", x: 70, y: 42, width: 14, height: 18, fill: "#ef4444" },
    { id: "left-awning-scallop", type: "path", d: "M14 60 C22 68 30 52 38 60 S54 68 62 60 S78 52 86 60 S94 68 96 60", fill: "none", stroke: "#222", strokeWidth: 1 },
    { id: "left-post", type: "line", x1: 22, y1: 60, x2: 22, y2: 118, stroke: "#451a03", strokeWidth: 3 },
    { id: "left-post-right", type: "line", x1: 88, y1: 60, x2: 88, y2: 118, stroke: "#451a03", strokeWidth: 3 },
    { id: "right-stall-counter", type: "rect", x: 128, y: 78, width: 72, height: 32, fill: "#7c2d12", stroke: "#451a03", strokeWidth: 1 },
    { id: "right-awning-base", type: "rect", x: 124, y: 44, width: 80, height: 18, fill: "#f8fafc", stroke: "#222", strokeWidth: 1 },
    { id: "right-awning-blue-1", type: "rect", x: 124, y: 44, width: 16, height: 18, fill: "#2563eb" },
    { id: "right-awning-blue-2", type: "rect", x: 156, y: 44, width: 16, height: 18, fill: "#2563eb" },
    { id: "right-awning-blue-3", type: "rect", x: 188, y: 44, width: 16, height: 18, fill: "#2563eb" },
    { id: "right-post-left", type: "line", x1: 134, y1: 62, x2: 134, y2: 118, stroke: "#451a03", strokeWidth: 3 },
    { id: "right-post-right", type: "line", x1: 196, y1: 62, x2: 196, y2: 118, stroke: "#451a03", strokeWidth: 3 },
    { id: "apple-1", type: "circle", cx: 34, cy: 72, r: 5, fill: "#dc2626" },
    { id: "apple-2", type: "circle", cx: 48, cy: 70, r: 5, fill: "#dc2626" },
    { id: "apple-3", type: "circle", cx: 62, cy: 72, r: 5, fill: "#dc2626" },
    { id: "pear-1", type: "ellipse", cx: 148, cy: 72, rx: 5, ry: 7, fill: "#a3e635" },
    { id: "pear-2", type: "ellipse", cx: 164, cy: 70, rx: 5, ry: 7, fill: "#a3e635" },
    { id: "pear-3", type: "ellipse", cx: 180, cy: 72, rx: 5, ry: 7, fill: "#a3e635" },
    { id: "crate-apples", type: "rect", x: 28, y: 76, width: 44, height: 12, fill: "#a16207", stroke: "#451a03", strokeWidth: 1 },
    { id: "crate-pears", type: "rect", x: 140, y: 76, width: 48, height: 12, fill: "#a16207", stroke: "#451a03", strokeWidth: 1 },
    { id: "hanging-sign", type: "rect", x: 92, y: 18, width: 36, height: 18, fill: "#fde68a", stroke: "#222", strokeWidth: 1 },
    { id: "sign-pin-left", type: "line", x1: 100, y1: 18, x2: 100, y2: 8, stroke: "#222", strokeWidth: 1 },
    { id: "sign-pin-right", type: "line", x1: 120, y1: 18, x2: 120, y2: 8, stroke: "#222", strokeWidth: 1 },
    { id: "lamp", type: "circle", cx: 110, cy: 10, r: 5, fill: "#fde047", stroke: "#222", strokeWidth: 1 },
    { id: "bike-frame", type: "polyline", points: [[84, 114], [104, 96], [122, 114], [96, 114], [104, 96]], stroke: "#334155", strokeWidth: 2, fill: "none" },
    { id: "bike-handlebar", type: "path", d: "M122 96 C130 88 136 92 136 98", fill: "none", stroke: "#334155", strokeWidth: 2 },
    { id: "bike-wheel-left", type: "circle", cx: 84, cy: 114, r: 10, fill: "none", stroke: "#334155", strokeWidth: 2 },
    { id: "bike-wheel-right", type: "circle", cx: 122, cy: 114, r: 10, fill: "none", stroke: "#334155", strokeWidth: 2 },
    { id: "shopper-head", type: "circle", cx: 112, cy: 78, r: 4, fill: "#f2c078" },
    { id: "shopper-body", type: "rect", x: 108, y: 82, width: 8, height: 18, fill: "#16a34a" },
    { id: "shopper-bag", type: "rect", x: 118, y: 94, width: 8, height: 10, fill: "#f59e0b" },
  ],
});

const V2_VARIANTS = [
  { accent: "#0ea5e9", soft: "#e0f2fe", bg: "#f8fafc" },
  { accent: "#14b8a6", soft: "#ccfbf1", bg: "#f8fffb" },
  { accent: "#8b5cf6", soft: "#ede9fe", bg: "#faf8ff" },
  { accent: "#f97316", soft: "#ffedd5", bg: "#fffaf5" },
  { accent: "#22c55e", soft: "#dcfce7", bg: "#f7fff9" },
  { accent: "#ef4444", soft: "#fee2e2", bg: "#fff8f8" },
  { accent: "#06b6d4", soft: "#cffafe", bg: "#f4feff" },
  { accent: "#a855f7", soft: "#f3e8ff", bg: "#fdf9ff" },
  { accent: "#f59e0b", soft: "#fef3c7", bg: "#fffdf4" },
  { accent: "#10b981", soft: "#d1fae5", bg: "#f6fffb" },
  { accent: "#3b82f6", soft: "#dbeafe", bg: "#f8fbff" },
  { accent: "#ec4899", soft: "#fce7f3", bg: "#fff7fb" },
  { accent: "#84cc16", soft: "#ecfccb", bg: "#fbfff4" },
  { accent: "#6366f1", soft: "#e0e7ff", bg: "#f8f9ff" },
  { accent: "#f43f5e", soft: "#ffe4e6", bg: "#fff8fa" },
  { accent: "#0f766e", soft: "#ccfbf1", bg: "#f5fffd" },
  { accent: "#7c3aed", soft: "#ede9fe", bg: "#fbf8ff" },
  { accent: "#ca8a04", soft: "#fef9c3", bg: "#fffef5" },
  { accent: "#0284c7", soft: "#e0f2fe", bg: "#f5fbff" },
  { accent: "#be123c", soft: "#ffe4e6", bg: "#fff7f8" },
];

const v2IdentityMotifParts = (marker, variantNumber, variant) => {
  const id = (name) => `identity-${marker}-${name}`;
  switch (variantNumber) {
    case 1:
      return [
        { id: id("billboard"), type: "rect", x: 142, y: 9, width: 46, height: 19, rx: 2, fill: "#eff6ff", stroke: "#1d4ed8", strokeWidth: 1.2, opacity: 0.95 },
        { id: id("billboard-stripe-1"), type: "rect", x: 148, y: 14, width: 30, height: 3, fill: "#f97316" },
        { id: id("billboard-stripe-2"), type: "rect", x: 148, y: 21, width: 20, height: 3, fill: "#2563eb" },
      ];
    case 2:
      return [
        { id: id("harbor-sun-ring"), type: "circle", cx: 34, cy: 26, r: 13, fill: "#fde68a", stroke: "#f59e0b", strokeWidth: 2, opacity: 0.95 },
        { id: id("pennant-line"), type: "line", x1: 116, y1: 19, x2: 170, y2: 28, stroke: "#334155", strokeWidth: 1 },
        { id: id("pennant-a"), type: "polygon", points: [[122, 20], [130, 21], [125, 29]], fill: "#ef4444" },
        { id: id("pennant-b"), type: "polygon", points: [[142, 23], [150, 24], [145, 32]], fill: "#22c55e" },
        { id: id("pennant-c"), type: "polygon", points: [[160, 26], [168, 27], [163, 35]], fill: "#3b82f6" },
      ];
    case 3:
      return [
        { id: id("blossom-trunk"), type: "rect", x: 17, y: 58, width: 5, height: 31, fill: "#7c2d12" },
        { id: id("blossom-crown"), type: "circle", cx: 20, cy: 50, r: 18, fill: "#f9a8d4", opacity: 0.85 },
        { id: id("blossom-light"), type: "circle", cx: 29, cy: 43, r: 9, fill: "#fce7f3", opacity: 0.9 },
      ];
    case 4:
      return [
        { id: id("aurora-a"), type: "path", d: "M10 24 C38 6 62 42 90 22 S144 4 196 26", fill: "none", stroke: "#22d3ee", strokeWidth: 5, opacity: 0.42 },
        { id: id("aurora-b"), type: "path", d: "M12 38 C48 18 78 52 114 34 S166 22 208 42", fill: "none", stroke: "#a7f3d0", strokeWidth: 4, opacity: 0.4 },
      ];
    case 5:
      return [
        { id: id("balloon-red"), type: "circle", cx: 128, cy: 18, r: 9, fill: "#ef4444", stroke: "#7f1d1d", strokeWidth: 1 },
        { id: id("balloon-blue"), type: "circle", cx: 143, cy: 13, r: 8, fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 1 },
        { id: id("balloon-yellow"), type: "circle", cx: 157, cy: 20, r: 8, fill: "#fde047", stroke: "#854d0e", strokeWidth: 1 },
        { id: id("balloon-strings"), type: "polyline", points: [[128, 27], [134, 44], [143, 21], [138, 45], [157, 28], [143, 45]], stroke: "#475569", strokeWidth: 1, fill: "none" },
      ];
    case 6:
      return [
        { id: id("tiny-island"), type: "ellipse", cx: 182, cy: 112, rx: 25, ry: 8, fill: "#facc15", opacity: 0.85 },
        { id: id("palm-trunk"), type: "line", x1: 181, y1: 111, x2: 188, y2: 77, stroke: "#92400e", strokeWidth: 4 },
        { id: id("palm-leaf-a"), type: "polygon", points: [[188, 78], [166, 70], [185, 89]], fill: "#16a34a" },
        { id: id("palm-leaf-b"), type: "polygon", points: [[188, 78], [207, 67], [196, 90]], fill: "#15803d" },
      ];
    case 7:
      return [
        { id: id("rain-cloud-a"), type: "ellipse", cx: 42, cy: 23, rx: 19, ry: 9, fill: "#cbd5e1" },
        { id: id("rain-cloud-b"), type: "ellipse", cx: 58, cy: 22, rx: 15, ry: 11, fill: "#94a3b8" },
        { id: id("rain-1"), type: "line", x1: 38, y1: 38, x2: 33, y2: 51, stroke: "#0284c7", strokeWidth: 2 },
        { id: id("rain-2"), type: "line", x1: 55, y1: 38, x2: 50, y2: 52, stroke: "#0284c7", strokeWidth: 2 },
        { id: id("rain-3"), type: "line", x1: 70, y1: 36, x2: 65, y2: 49, stroke: "#0284c7", strokeWidth: 2 },
      ];
    case 8:
      return [
        { id: id("creek"), type: "path", d: "M8 132 C42 116 62 142 96 128 S154 112 212 132", fill: "none", stroke: "#38bdf8", strokeWidth: 7, opacity: 0.75 },
        { id: id("creek-highlight"), type: "path", d: "M14 128 C46 120 68 136 96 124 S152 118 204 128", fill: "none", stroke: "#e0f2fe", strokeWidth: 2, opacity: 0.8 },
      ];
    case 9:
      return [
        { id: id("light-wire"), type: "polyline", points: [[16, 26], [48, 18], [82, 26], [118, 18], [154, 26], [196, 18]], stroke: "#475569", strokeWidth: 1.3, fill: "none" },
        { id: id("light-a"), type: "circle", cx: 48, cy: 19, r: 4, fill: "#fde047", opacity: 0.95 },
        { id: id("light-b"), type: "circle", cx: 118, cy: 19, r: 4, fill: "#f97316", opacity: 0.95 },
        { id: id("light-c"), type: "circle", cx: 196, cy: 19, r: 4, fill: "#22c55e", opacity: 0.95 },
      ];
    case 10:
      return [
        { id: id("comet-trail"), type: "path", d: "M20 28 C58 14 86 20 120 10", fill: "none", stroke: "#fef3c7", strokeWidth: 4, opacity: 0.8 },
        { id: id("comet-core"), type: "circle", cx: 128, cy: 8, r: 7, fill: "#fde047" },
        { id: id("comet-glow"), type: "circle", cx: 128, cy: 8, r: 12, fill: "#fef08a", opacity: 0.28 },
      ];
    case 11:
      return [
        { id: id("beam-wide"), type: "polygon", points: [[161, 32], [212, 12], [212, 48]], fill: "#fde68a", opacity: 0.45 },
        { id: id("gull-a"), type: "polyline", points: [[24, 36], [30, 31], [36, 36]], stroke: "#334155", strokeWidth: 1.7, fill: "none" },
        { id: id("gull-b"), type: "polyline", points: [[48, 25], [55, 20], [62, 25]], stroke: "#334155", strokeWidth: 1.7, fill: "none" },
        { id: id("gull-c"), type: "polyline", points: [[76, 41], [82, 36], [88, 41]], stroke: "#334155", strokeWidth: 1.7, fill: "none" },
      ];
    case 12:
      return [
        { id: id("rug-base"), type: "rect", x: 86, y: 114, width: 58, height: 17, rx: 2, fill: "#f97316", opacity: 0.85 },
        { id: id("rug-band-a"), type: "rect", x: 92, y: 114, width: 7, height: 17, fill: "#fef3c7", opacity: 0.9 },
        { id: id("rug-band-b"), type: "rect", x: 116, y: 114, width: 7, height: 17, fill: "#fef3c7", opacity: 0.9 },
        { id: id("rug-band-c"), type: "rect", x: 137, y: 114, width: 7, height: 17, fill: "#fef3c7", opacity: 0.9 },
      ];
    case 13:
      return [
        { id: id("anchor-ring"), type: "circle", cx: 28, cy: 35, r: 8, fill: "none", stroke: "#334155", strokeWidth: 3 },
        { id: id("anchor-stem"), type: "line", x1: 28, y1: 43, x2: 28, y2: 86, stroke: "#334155", strokeWidth: 4 },
        { id: id("anchor-bar"), type: "line", x1: 15, y1: 58, x2: 41, y2: 58, stroke: "#334155", strokeWidth: 3 },
        { id: id("anchor-hook"), type: "path", d: "M8 76 C16 96 40 96 48 76", fill: "none", stroke: "#334155", strokeWidth: 4 },
      ];
    case 14:
      return [
        { id: id("ridge-left"), type: "polygon", points: [[2, 92], [38, 38], [80, 92]], fill: "#64748b", opacity: 0.75 },
        { id: id("ridge-snow"), type: "polygon", points: [[38, 38], [26, 56], [44, 52], [54, 66]], fill: "#e2e8f0", opacity: 0.95 },
        { id: id("ridge-right"), type: "polygon", points: [[124, 92], [170, 42], [218, 92]], fill: "#475569", opacity: 0.6 },
      ];
    case 15:
      return [
        { id: id("snowbank"), type: "path", d: "M0 124 C34 114 62 130 94 120 S158 112 220 124 L220 150 L0 150 Z", fill: "#e0f2fe", opacity: 0.9 },
        { id: id("flake-a"), type: "circle", cx: 44, cy: 31, r: 3, fill: "#f8fafc" },
        { id: id("flake-b"), type: "circle", cx: 128, cy: 22, r: 2.5, fill: "#f8fafc" },
        { id: id("flake-c"), type: "circle", cx: 186, cy: 38, r: 3, fill: "#f8fafc" },
      ];
    case 16:
      return [
        { id: id("sub-body"), type: "ellipse", cx: 52, cy: 112, rx: 28, ry: 11, fill: "#facc15", stroke: "#854d0e", strokeWidth: 1.5 },
        { id: id("sub-window"), type: "circle", cx: 43, cy: 110, r: 4, fill: "#bae6fd", stroke: "#075985", strokeWidth: 1 },
        { id: id("sub-tail"), type: "polygon", points: [[80, 112], [94, 104], [94, 120]], fill: "#f59e0b", stroke: "#854d0e", strokeWidth: 1 },
        { id: id("fish"), type: "polygon", points: [[152, 122], [166, 116], [166, 128]], fill: "#fb7185", opacity: 0.95 },
      ];
    case 17:
      return [
        { id: id("lantern-wire"), type: "polyline", points: [[18, 28], [58, 20], [98, 28], [138, 20], [182, 28]], stroke: "#64748b", strokeWidth: 1.4, fill: "none" },
        { id: id("lantern-a"), type: "rect", x: 51, y: 19, width: 11, height: 15, rx: 3, fill: "#fde047", stroke: "#854d0e", strokeWidth: 1 },
        { id: id("lantern-b"), type: "rect", x: 132, y: 19, width: 11, height: 15, rx: 3, fill: "#fb7185", stroke: "#881337", strokeWidth: 1 },
        { id: id("firefly-a"), type: "circle", cx: 36, cy: 84, r: 3, fill: "#fef08a", opacity: 0.9 },
        { id: id("firefly-b"), type: "circle", cx: 188, cy: 94, r: 3, fill: "#fef08a", opacity: 0.9 },
      ];
    case 18:
      return [
        { id: id("flower-cart"), type: "rect", x: 20, y: 103, width: 42, height: 17, rx: 2, fill: "#a855f7", stroke: "#581c87", strokeWidth: 1.3 },
        { id: id("cart-wheel-a"), type: "circle", cx: 29, cy: 123, r: 5, fill: "none", stroke: "#334155", strokeWidth: 1.6 },
        { id: id("cart-wheel-b"), type: "circle", cx: 54, cy: 123, r: 5, fill: "none", stroke: "#334155", strokeWidth: 1.6 },
        { id: id("flower-a"), type: "circle", cx: 31, cy: 99, r: 5, fill: "#f472b6" },
        { id: id("flower-b"), type: "circle", cx: 44, cy: 96, r: 5, fill: "#fde047" },
        { id: id("flower-c"), type: "circle", cx: 56, cy: 100, r: 5, fill: "#22c55e" },
      ];
    case 19:
      return [
        { id: id("storm-cloud-a"), type: "ellipse", cx: 92, cy: 24, rx: 24, ry: 11, fill: "#64748b", opacity: 0.95 },
        { id: id("storm-cloud-b"), type: "ellipse", cx: 118, cy: 27, rx: 20, ry: 13, fill: "#475569", opacity: 0.95 },
        { id: id("lightning"), type: "polygon", points: [[112, 37], [101, 62], [114, 57], [105, 82], [130, 48], [116, 52]], fill: "#fde047" },
        { id: id("storm-rain"), type: "line", x1: 86, y1: 45, x2: 78, y2: 65, stroke: "#38bdf8", strokeWidth: 2 },
      ];
    case 20:
      return [
        { id: id("skyline-a"), type: "rect", x: 9, y: 67, width: 16, height: 43, fill: "#334155", opacity: 0.78 },
        { id: id("skyline-b"), type: "rect", x: 29, y: 50, width: 21, height: 60, fill: "#1e293b", opacity: 0.78 },
        { id: id("skyline-c"), type: "rect", x: 55, y: 72, width: 18, height: 38, fill: "#475569", opacity: 0.78 },
        { id: id("skyline-window-a"), type: "rect", x: 35, y: 60, width: 4, height: 6, fill: "#fde68a" },
        { id: id("skyline-window-b"), type: "rect", x: 61, y: 82, width: 4, height: 6, fill: "#fde68a" },
      ];
    default:
      return [
        { id: id("badge"), type: "circle", cx: 24, cy: 24, r: 12, fill: variant.accent, opacity: 0.7 },
      ];
  }
};

const v2DominantSkinParts = (marker, variantNumber, variant) => {
  const id = (name) => `skin-${marker}-${name}`;
  switch (variantNumber) {
    case 1:
      return [
        { id: id("metro-arch"), type: "path", d: "M130 118 C134 48 206 48 210 118", fill: "none", stroke: "#2563eb", strokeWidth: 10, opacity: 0.45 },
        { id: id("metro-panel"), type: "rect", x: 136, y: 18, width: 64, height: 24, rx: 4, fill: "#eff6ff", stroke: "#1d4ed8", strokeWidth: 2, opacity: 0.92 },
      ];
    case 2:
      return [
        { id: id("sun-disc"), type: "circle", cx: 32, cy: 28, r: 26, fill: "#fde047", stroke: "#f59e0b", strokeWidth: 3, opacity: 0.9 },
        { id: id("sail-flags"), type: "polyline", points: [[92, 14], [126, 22], [160, 14], [198, 24]], stroke: "#334155", strokeWidth: 2, fill: "none", opacity: 0.9 },
      ];
    case 3:
      return [
        { id: id("pink-tree-trunk"), type: "rect", x: 4, y: 54, width: 12, height: 62, fill: "#7c2d12", opacity: 0.82 },
        { id: id("pink-tree-crown"), type: "circle", cx: 15, cy: 48, r: 33, fill: "#f9a8d4", opacity: 0.72 },
        { id: id("pink-tree-glow"), type: "circle", cx: 38, cy: 35, r: 18, fill: "#fce7f3", opacity: 0.8 },
      ];
    case 4:
      return [
        { id: id("aurora-wide-a"), type: "path", d: "M4 24 C42 0 70 50 108 24 S170 4 216 30", fill: "none", stroke: "#22d3ee", strokeWidth: 10, opacity: 0.48 },
        { id: id("aurora-wide-b"), type: "path", d: "M0 48 C54 16 92 68 138 38 S182 24 220 54", fill: "none", stroke: "#a7f3d0", strokeWidth: 8, opacity: 0.42 },
      ];
    case 5:
      return [
        { id: id("balloon-big-a"), type: "circle", cx: 126, cy: 24, r: 17, fill: "#ef4444", stroke: "#7f1d1d", strokeWidth: 2, opacity: 0.92 },
        { id: id("balloon-big-b"), type: "circle", cx: 151, cy: 17, r: 15, fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 2, opacity: 0.92 },
        { id: id("balloon-big-c"), type: "circle", cx: 176, cy: 29, r: 16, fill: "#fde047", stroke: "#854d0e", strokeWidth: 2, opacity: 0.92 },
      ];
    case 6:
      return [
        { id: id("island-wide"), type: "ellipse", cx: 180, cy: 114, rx: 40, ry: 13, fill: "#facc15", opacity: 0.85 },
        { id: id("palm-trunk-wide"), type: "line", x1: 176, y1: 111, x2: 190, y2: 48, stroke: "#92400e", strokeWidth: 7, opacity: 0.9 },
        { id: id("palm-leaf-wide-a"), type: "polygon", points: [[190, 49], [142, 34], [180, 68]], fill: "#16a34a", opacity: 0.86 },
        { id: id("palm-leaf-wide-b"), type: "polygon", points: [[190, 49], [220, 25], [205, 74]], fill: "#15803d", opacity: 0.86 },
      ];
    case 7:
      return [
        { id: id("storm-cloud-wide-a"), type: "ellipse", cx: 42, cy: 28, rx: 36, ry: 17, fill: "#cbd5e1", opacity: 0.9 },
        { id: id("storm-cloud-wide-b"), type: "ellipse", cx: 78, cy: 30, rx: 31, ry: 20, fill: "#94a3b8", opacity: 0.9 },
        { id: id("storm-rain-wide-a"), type: "line", x1: 34, y1: 52, x2: 20, y2: 90, stroke: "#0284c7", strokeWidth: 4, opacity: 0.82 },
        { id: id("storm-rain-wide-b"), type: "line", x1: 72, y1: 52, x2: 58, y2: 92, stroke: "#0284c7", strokeWidth: 4, opacity: 0.82 },
      ];
    case 8:
      return [
        { id: id("river-wide"), type: "path", d: "M-4 128 C42 104 68 150 112 126 S174 104 224 130", fill: "none", stroke: "#38bdf8", strokeWidth: 16, opacity: 0.72 },
        { id: id("river-shine"), type: "path", d: "M6 122 C50 112 80 138 112 120 S172 114 214 124", fill: "none", stroke: "#e0f2fe", strokeWidth: 4, opacity: 0.9 },
      ];
    case 9:
      return [
        { id: id("festival-wire"), type: "polyline", points: [[0, 34], [42, 18], [84, 34], [126, 18], [168, 34], [220, 18]], stroke: "#475569", strokeWidth: 2.4, fill: "none", opacity: 0.9 },
        { id: id("festival-light-a"), type: "circle", cx: 42, cy: 19, r: 8, fill: "#fde047", opacity: 0.95 },
        { id: id("festival-light-b"), type: "circle", cx: 126, cy: 19, r: 8, fill: "#f97316", opacity: 0.95 },
        { id: id("festival-light-c"), type: "circle", cx: 205, cy: 22, r: 8, fill: "#22c55e", opacity: 0.95 },
      ];
    case 10:
      return [
        { id: id("comet-wide-trail"), type: "path", d: "M-2 40 C54 14 94 30 150 8", fill: "none", stroke: "#fef3c7", strokeWidth: 10, opacity: 0.72 },
        { id: id("comet-wide-core"), type: "circle", cx: 163, cy: 6, r: 14, fill: "#fde047", opacity: 0.95 },
        { id: id("comet-wide-glow"), type: "circle", cx: 163, cy: 6, r: 25, fill: "#fef08a", opacity: 0.24 },
      ];
    case 11:
      return [
        { id: id("beacon-beam"), type: "polygon", points: [[150, 48], [220, 10], [220, 78]], fill: "#fde68a", opacity: 0.58 },
        { id: id("bird-wide-a"), type: "polyline", points: [[16, 40], [28, 30], [40, 40]], stroke: "#334155", strokeWidth: 3, fill: "none", opacity: 0.92 },
        { id: id("bird-wide-b"), type: "polyline", points: [[54, 28], [68, 18], [82, 28]], stroke: "#334155", strokeWidth: 3, fill: "none", opacity: 0.92 },
      ];
    case 12:
      return [
        { id: id("rug-wide"), type: "rect", x: 78, y: 105, width: 76, height: 31, rx: 3, fill: "#f97316", opacity: 0.82 },
        { id: id("rug-wide-a"), type: "rect", x: 90, y: 105, width: 10, height: 31, fill: "#fef3c7", opacity: 0.9 },
        { id: id("rug-wide-b"), type: "rect", x: 123, y: 105, width: 10, height: 31, fill: "#fef3c7", opacity: 0.9 },
        { id: id("rug-wide-c"), type: "rect", x: 146, y: 105, width: 8, height: 31, fill: "#fef3c7", opacity: 0.9 },
      ];
    case 13:
      return [
        { id: id("anchor-wide-ring"), type: "circle", cx: 28, cy: 40, r: 14, fill: "none", stroke: "#334155", strokeWidth: 5, opacity: 0.9 },
        { id: id("anchor-wide-stem"), type: "line", x1: 28, y1: 54, x2: 28, y2: 116, stroke: "#334155", strokeWidth: 7, opacity: 0.9 },
        { id: id("anchor-wide-bar"), type: "line", x1: 7, y1: 75, x2: 50, y2: 75, stroke: "#334155", strokeWidth: 5, opacity: 0.9 },
        { id: id("anchor-wide-hook"), type: "path", d: "M0 104 C18 136 52 136 66 104", fill: "none", stroke: "#334155", strokeWidth: 7, opacity: 0.9 },
      ];
    case 14:
      return [
        { id: id("mountain-wide-left"), type: "polygon", points: [[-8, 112], [44, 34], [104, 112]], fill: "#64748b", opacity: 0.74 },
        { id: id("mountain-wide-snow"), type: "polygon", points: [[44, 34], [25, 62], [50, 55], [66, 78]], fill: "#e2e8f0", opacity: 0.96 },
        { id: id("mountain-wide-right"), type: "polygon", points: [[116, 112], [176, 38], [230, 112]], fill: "#475569", opacity: 0.58 },
      ];
    case 15:
      return [
        { id: id("snowbank-wide"), type: "path", d: "M0 118 C38 104 72 130 110 114 S172 102 220 118 L220 150 L0 150 Z", fill: "#e0f2fe", opacity: 0.88 },
        { id: id("flake-wide-a"), type: "circle", cx: 38, cy: 34, r: 6, fill: "#f8fafc", opacity: 0.95 },
        { id: id("flake-wide-b"), type: "circle", cx: 132, cy: 24, r: 5, fill: "#f8fafc", opacity: 0.95 },
        { id: id("flake-wide-c"), type: "circle", cx: 196, cy: 42, r: 6, fill: "#f8fafc", opacity: 0.95 },
      ];
    case 16:
      return [
        { id: id("sub-wide-body"), type: "ellipse", cx: 53, cy: 112, rx: 43, ry: 18, fill: "#facc15", stroke: "#854d0e", strokeWidth: 2.2, opacity: 0.9 },
        { id: id("sub-wide-window"), type: "circle", cx: 42, cy: 109, r: 7, fill: "#bae6fd", stroke: "#075985", strokeWidth: 1.5, opacity: 0.95 },
        { id: id("sub-wide-tail"), type: "polygon", points: [[93, 112], [116, 96], [116, 128]], fill: "#f59e0b", stroke: "#854d0e", strokeWidth: 1.5, opacity: 0.9 },
      ];
    case 17:
      return [
        { id: id("lantern-wide-wire"), type: "polyline", points: [[0, 34], [52, 18], [104, 34], [156, 18], [220, 34]], stroke: "#64748b", strokeWidth: 2.4, fill: "none", opacity: 0.9 },
        { id: id("lantern-wide-a"), type: "rect", x: 44, y: 17, width: 19, height: 25, rx: 5, fill: "#fde047", stroke: "#854d0e", strokeWidth: 1.5, opacity: 0.94 },
        { id: id("lantern-wide-b"), type: "rect", x: 147, y: 17, width: 19, height: 25, rx: 5, fill: "#fb7185", stroke: "#881337", strokeWidth: 1.5, opacity: 0.94 },
      ];
    case 18:
      return [
        { id: id("flower-cart-wide"), type: "rect", x: 8, y: 96, width: 70, height: 28, rx: 3, fill: "#a855f7", stroke: "#581c87", strokeWidth: 2, opacity: 0.9 },
        { id: id("flower-wide-a"), type: "circle", cx: 28, cy: 88, r: 10, fill: "#f472b6", opacity: 0.95 },
        { id: id("flower-wide-b"), type: "circle", cx: 48, cy: 82, r: 10, fill: "#fde047", opacity: 0.95 },
        { id: id("flower-wide-c"), type: "circle", cx: 68, cy: 90, r: 10, fill: "#22c55e", opacity: 0.95 },
      ];
    case 19:
      return [
        { id: id("thunder-cloud-a"), type: "ellipse", cx: 88, cy: 28, rx: 39, ry: 18, fill: "#64748b", opacity: 0.9 },
        { id: id("thunder-cloud-b"), type: "ellipse", cx: 130, cy: 32, rx: 35, ry: 22, fill: "#475569", opacity: 0.9 },
        { id: id("thunder-bolt"), type: "polygon", points: [[120, 48], [100, 92], [124, 82], [108, 132], [151, 68], [128, 76]], fill: "#fde047", opacity: 0.95 },
      ];
    case 20:
      return [
        { id: id("city-a"), type: "rect", x: 1, y: 58, width: 24, height: 58, fill: "#334155", opacity: 0.78 },
        { id: id("city-b"), type: "rect", x: 31, y: 34, width: 32, height: 82, fill: "#1e293b", opacity: 0.78 },
        { id: id("city-c"), type: "rect", x: 70, y: 67, width: 27, height: 49, fill: "#475569", opacity: 0.78 },
        { id: id("city-window-a"), type: "rect", x: 40, y: 48, width: 6, height: 9, fill: "#fde68a", opacity: 0.95 },
        { id: id("city-window-b"), type: "rect", x: 77, y: 80, width: 6, height: 9, fill: "#fde68a", opacity: 0.95 },
      ];
    default:
      return [
        { id: id("wash"), type: "rect", x: 0, y: 0, width: 220, height: 150, fill: variant.soft, opacity: 0.3 },
      ];
  }
};

const applyScenicV2Variant = (scene, variantNumber) => {
  const next = cloneSpec(scene);
  const variant = V2_VARIANTS[(variantNumber - 1) % V2_VARIANTS.length];
  const marker = String(variantNumber).padStart(2, "0");
  const markerPalette = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#14b8a6",
    "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
  ];
  next.bg = variant.bg;

  const part = (id) => next.parts.find((p) => p.id === id);
  const patch = (id, attrs) => {
    const p = part(id);
    if (p) Object.assign(p, attrs);
  };

  if (part("sky-band")) {
    patch("sky-band", { fill: variant.soft });
    patch("station-wall", { fill: variantNumber % 2 ? "#f8fafc" : "#eef2ff" });
    patch("platform", { fill: variantNumber % 3 ? "#d1d5db" : "#cbd5e1" });
    patch("poster-pink", { fill: variant.accent });
    patch("passenger-body", { fill: variantNumber % 2 ? "#2563eb" : "#16a34a" });
  } else if (part("water")) {
    patch("sky", { fill: variant.soft });
    patch("water", { fill: variantNumber % 2 ? "#38bdf8" : "#2dd4bf" });
    patch("sun", { fill: variantNumber % 3 ? "#fde047" : "#fbbf24" });
    patch("cloud-left", { fill: variantNumber % 2 ? "#ffffff" : "#f8fafc" });
    patch("cloud-right", { fill: variantNumber % 2 ? "#ffffff" : "#f8fafc" });
    patch("flag", { fill: variant.accent });
  } else if (part("night-sky")) {
    patch("night-sky", { fill: variantNumber % 2 ? "#0f172a" : "#111827" });
    patch("ground", { fill: variantNumber % 3 ? "#14532d" : "#166534" });
    patch("far-hill", { fill: variantNumber % 2 ? "#166534" : "#15803d" });
    patch("mid-hill", { fill: variantNumber % 2 ? "#15803d" : "#166534" });
    patch("tent-body", { fill: variant.accent });
  } else if (part("back-wall")) {
    patch("back-wall", { fill: variant.soft });
    patch("street", { fill: variantNumber % 2 ? "#e5e7eb" : "#dbe4ea" });
    patch("hanging-sign", { fill: variantNumber % 2 ? "#fef3c7" : "#fff7ed" });
    patch("lamp", { fill: variantNumber % 3 ? "#fde047" : "#facc15" });
    patch("shopper-body", { fill: variantNumber % 2 ? "#16a34a" : "#2563eb" });
  }

  if (part("sky-band")) {
    const stationSkins = {
      1: { train: "#f97316", roof: "#ea580c", wall: "#f8fafc", platform: "#cbd5e1", edge: "#facc15", poster: "#2563eb" },
      3: { train: "#f43f5e", roof: "#be123c", wall: "#ffe4e6", platform: "#d8b4fe", edge: "#f9a8d4", poster: "#7c3aed" },
      7: { train: "#0ea5e9", roof: "#0369a1", wall: "#cffafe", platform: "#94a3b8", edge: "#38bdf8", poster: "#0891b2" },
      15: { train: "#ef4444", roof: "#991b1b", wall: "#e0f2fe", platform: "#f8fafc", edge: "#bae6fd", poster: "#3b82f6" },
      20: { train: "#334155", roof: "#0f172a", wall: "#fecdd3", platform: "#cbd5e1", edge: "#f472b6", poster: "#be123c" },
    }[variantNumber];
    if (stationSkins) {
      patch("train-body", { fill: stationSkins.train });
      patch("train-roof", { fill: stationSkins.roof });
      patch("station-wall", { fill: stationSkins.wall });
      patch("platform", { fill: stationSkins.platform });
      patch("platform-edge", { fill: stationSkins.edge });
      patch("poster-blue", { fill: stationSkins.poster });
      patch("window-left", { fill: variantNumber === 20 ? "#94a3b8" : "#bfdbfe" });
      patch("window-center", { fill: variantNumber === 20 ? "#94a3b8" : "#bfdbfe" });
      patch("window-right", { fill: variantNumber === 20 ? "#94a3b8" : "#bfdbfe" });
    }
  } else if (part("water")) {
    const harborSkins = {
      2: { water: "#0ea5e9", sky: "#bfdbfe", hull: "#0f766e", cabin: "#f8fafc", sail: "#fef3c7", lighthouse: "#f8fafc" },
      6: { water: "#0891b2", sky: "#ccfbf1", hull: "#0369a1", cabin: "#e0f2fe", sail: "#fff7ed", lighthouse: "#fef3c7" },
      11: { water: "#38bdf8", sky: "#dbeafe", hull: "#be123c", cabin: "#f8fafc", sail: "#fef9c3", lighthouse: "#f8fafc" },
      13: { water: "#0284c7", sky: "#e0f2fe", hull: "#92400e", cabin: "#fef3c7", sail: "#f8fafc", lighthouse: "#fee2e2" },
      16: { water: "#06b6d4", sky: "#dbeafe", hull: "#f59e0b", cabin: "#fefce8", sail: "#ecfeff", lighthouse: "#f8fafc" },
      19: { water: "#0f766e", sky: "#cbd5e1", hull: "#1e293b", cabin: "#e2e8f0", sail: "#dbeafe", lighthouse: "#e5e7eb" },
    }[variantNumber];
    if (harborSkins) {
      patch("water", { fill: harborSkins.water });
      patch("sky", { fill: harborSkins.sky });
      patch("boat-hull", { fill: harborSkins.hull });
      patch("boat-cabin", { fill: harborSkins.cabin });
      patch("sail-main", { fill: harborSkins.sail });
      patch("sail-small", { fill: variantNumber === 19 ? "#94a3b8" : "#e0f2fe" });
      patch("lighthouse-body", { fill: harborSkins.lighthouse });
      patch("lighthouse-stripe-1", { fill: variantNumber === 19 ? "#334155" : "#ef4444" });
      patch("lighthouse-stripe-2", { fill: variantNumber === 19 ? "#334155" : "#ef4444" });
    }
  } else if (part("night-sky")) {
    const campSkins = {
      4: { sky: "#0f172a", ground: "#0f766e", tent: "#f97316", side: "#ea580c", tree: "#15803d" },
      8: { sky: "#0f172a", ground: "#14532d", tent: "#f59e0b", side: "#92400e", tree: "#166534" },
      10: { sky: "#111827", ground: "#0f766e", tent: "#94a3b8", side: "#475569", tree: "#15803d" },
      14: { sky: "#1e293b", ground: "#334155", tent: "#f97316", side: "#64748b", tree: "#475569" },
      17: { sky: "#111827", ground: "#14532d", tent: "#f59e0b", side: "#b45309", tree: "#16a34a" },
    }[variantNumber];
    if (campSkins) {
      patch("night-sky", { fill: campSkins.sky });
      patch("ground", { fill: campSkins.ground });
      patch("tent-body", { fill: campSkins.tent });
      patch("tent-side", { fill: campSkins.side });
      patch("tree-left-crown", { fill: campSkins.tree });
      patch("tree-right-crown", { fill: campSkins.tree });
      patch("far-hill", { fill: variantNumber === 14 ? "#64748b" : "#14532d" });
      patch("mid-hill", { fill: variantNumber === 14 ? "#475569" : "#166534" });
    }
  } else if (part("back-wall")) {
    const marketSkins = {
      5: { wall: "#ffedd5", street: "#dbeafe", left: "#dc2626", right: "#2563eb", counter: "#92400e" },
      9: { wall: "#fef3c7", street: "#e5e7eb", left: "#f97316", right: "#22c55e", counter: "#78350f" },
      12: { wall: "#fed7aa", street: "#fde68a", left: "#be123c", right: "#0284c7", counter: "#7c2d12" },
      18: { wall: "#fce7f3", street: "#d1d5db", left: "#ec4899", right: "#84cc16", counter: "#6b21a8" },
    }[variantNumber];
    if (marketSkins) {
      patch("back-wall", { fill: marketSkins.wall });
      patch("street", { fill: marketSkins.street });
      patch("left-stall-counter", { fill: marketSkins.counter });
      patch("right-stall-counter", { fill: marketSkins.counter });
      patch("left-awning-red-1", { fill: marketSkins.left });
      patch("left-awning-red-2", { fill: marketSkins.left });
      patch("left-awning-red-3", { fill: marketSkins.left });
      patch("right-awning-blue-1", { fill: marketSkins.right });
      patch("right-awning-blue-2", { fill: marketSkins.right });
      patch("right-awning-blue-3", { fill: marketSkins.right });
    }
  }

  next.parts.push(...v2DominantSkinParts(marker, variantNumber, variant));
  next.parts.push(...v2IdentityMotifParts(marker, variantNumber, variant));

  const x = 10 + ((variantNumber * 17) % 48);
  const y = 10 + ((variantNumber * 11) % 28);
  next.parts.push(
    { id: `variant-${marker}-dot`, type: "circle", cx: x, cy: y, r: 2.2 + (variantNumber % 3) * 0.4, fill: variant.accent, opacity: 0.72 },
    { id: `variant-${marker}-rule`, type: "line", x1: x + 6, y1: y + 3, x2: x + 22, y2: y + (variantNumber % 2 ? 1 : 6), stroke: variant.accent, strokeWidth: 1.2, opacity: 0.58 },
  );
  for (let i = 0; i < 12; i += 1) {
    const row = i < 6 ? 0 : 1;
    const slot = i % 6;
    const chip = String(i + 1).padStart(2, "0");
    next.parts.push({
      id: `variant-${marker}-chip-${chip}`,
      type: "rect",
      x: 8 + slot * 34 + ((variantNumber + i * 3) % 6),
      y: row === 0 ? 4 + ((variantNumber + i) % 3) : 141 - ((variantNumber + i) % 3),
      width: 7 + ((variantNumber + i) % 3),
      height: 3 + (i % 2),
      rx: 1,
      fill: markerPalette[(variantNumber + i) % markerPalette.length],
      opacity: 0.68,
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const side = i % 2;
    const pin = String(i + 1).padStart(2, "0");
    next.parts.push({
      id: `variant-${marker}-pin-${pin}`,
      type: "circle",
      cx: side ? 212 - ((variantNumber * 5 + i * 7) % 24) : 8 + ((variantNumber * 7 + i * 5) % 24),
      cy: 22 + i * 14 + (variantNumber % 5),
      r: 1.8 + ((variantNumber + i) % 4) * 0.25,
      fill: markerPalette[(variantNumber * 2 + i) % markerPalette.length],
      opacity: 0.66,
    });
  }
  return next;
};

const v2HardeningOps = (scene) => {
  const has = (id) => scene.parts.some((p) => p.id === id);
  if (has("sky-band")) {
    return [
      (x) => corruptPartAttr(x, "rail-back", "strokeWidth", 6),
      (x) => corruptPartAttr(x, "rail-front", "stroke", "#94a3b8"),
      (x) => corruptPartAttr(x, "track-tie-4", "x", 140),
      (x) => corruptMiscolorPart(x, "window-left", "#e0f2fe"),
      (x) => corruptPartAttr(x, "clock-face", "strokeWidth", 0.5),
      (x) => corruptPartAttr(x, "poster-pink", "width", 18),
      (x) => corruptMiscolorPart(x, "passenger-body", "#a855f7"),
      (x) => corruptDisplacedPart(x, "signal-post", { dx: 6, dy: 0 }),
      (x) => corruptPartAttr(x, "sky-band", "height", 60),
      (x) => corruptPartAttr(x, "station-wall", "y", 60),
      (x) => corruptMiscolorPart(x, "track-tie-1", "#451a03"),
      (x) => corruptPartAttr(x, "track-tie-2", "x", 60),
      (x) => corruptPartAttr(x, "track-tie-3", "height", 22),
      (x) => corruptPartAttr(x, "train-body", "strokeWidth", 3),
      (x) => corruptMiscolorPart(x, "window-right", "#e0f2fe"),
      (x) => corruptPartAttr(x, "door-handle", "r", 3),
      (x) => corruptPartAttr(x, "wheel-left", "r", 4),
      (x) => corruptMiscolorPart(x, "wheel-right", "#374151"),
      (x) => corruptPartAttr(x, "signal-box", "width", 20),
      (x) => corruptPartAttr(x, "signal-red", "r", 5),
      (x) => corruptPartAttr(x, "clock-minute", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "bench-leg-left", "strokeWidth", 4),
      (x) => corruptMiscolorPart(x, "passenger-head", "#fde68a"),
    ];
  }
  if (has("water")) {
    return [
      (x) => corruptMiscolorPart(x, "boat-hull", "#0ea5e9"),
      (x) => corruptDisplacedPart(x, "boat-cabin", { dx: 6, dy: 0 }),
      (x) => corruptPartAttr(x, "pier-deck", "height", 15),
      (x) => corruptPartAttr(x, "sun", "r", 8),
      (x) => corruptPartAttr(x, "cloud-left", "rx", 10),
      (x) => corruptMiscolorPart(x, "flag", "#111827"),
      (x) => corruptPartAttr(x, "pier-leg-1", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "horizon", "strokeWidth", 4),
      (x) => corruptMiscolorPart(x, "sky", "#dbeafe"),
      (x) => corruptMiscolorPart(x, "water", "#0ea5e9"),
      (x) => corruptPartAttr(x, "cloud-right", "rx", 8),
      (x) => corruptPartAttr(x, "pier-leg-2", "strokeWidth", 2),
      (x) => corruptMiscolorPart(x, "boat-cabin", "#e0f2fe"),
      (x) => corruptMiscolorPart(x, "lighthouse-body", "#e5e7eb"),
      (x) => corruptMiscolorPart(x, "lighthouse-stripe-1", "#be123c"),
      (x) => corruptMiscolorPart(x, "lighthouse-stripe-2", "#be123c"),
      (x) => corruptMiscolorPart(x, "lighthouse-cap", "#334155"),
      (x) => corruptPartAttr(x, "buoy-red", "r", 5),
      (x) => corruptPartAttr(x, "wave-1", "strokeWidth", 3),
      (x) => corruptPartAttr(x, "wave-2", "strokeWidth", 3),
      (x) => corruptPartAttr(x, "cloud-left", "ry", 4),
      (x) => corruptPartAttr(x, "pier-deck", "y", 84),
      (x) => corruptMiscolorPart(x, "sun", "#facc15"),
    ];
  }
  if (has("night-sky")) {
    return [
      (x) => corruptMiscolorPart(x, "tent-body", "#94a3b8"),
      (x) => corruptMiscolorPart(x, "tent-side", "#f59e0b"),
      (x) => corruptPartAttr(x, "tent-line-left", "strokeWidth", 3),
      (x) => corruptMiscolorPart(x, "tree-left-crown", "#22c55e"),
      (x) => corruptPartAttr(x, "log-right", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "path", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "star-1", "r", 3.5),
      (x) => corruptMiscolorPart(x, "ground", "#0f766e"),
      (x) => corruptMiscolorPart(x, "far-hill", "#14532d"),
      (x) => corruptMiscolorPart(x, "mid-hill", "#166534"),
      (x) => corruptPartAttr(x, "star-3", "r", 3.5),
      (x) => corruptMiscolorPart(x, "tree-left-trunk", "#713f12"),
      (x) => corruptMiscolorPart(x, "tree-right-trunk", "#713f12"),
      (x) => corruptPartAttr(x, "log-left", "strokeWidth", 2),
      (x) => corruptMiscolorPart(x, "flame-back", "#fb923c"),
      (x) => corruptPartAttr(x, "smoke-1", "rx", 3),
      (x) => corruptPartAttr(x, "smoke-2", "ry", 2),
      (x) => corruptPartAttr(x, "star-1", "cx", 34),
      (x) => corruptPartAttr(x, "star-3", "cy", 28),
      (x) => corruptMiscolorPart(x, "night-sky", "#1e293b"),
      (x) => corruptPartAttr(x, "tree-left-crown", "points", [[24, 36], [4, 84], [44, 84]]),
      (x) => corruptPartAttr(x, "tent-body", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "smoke-1", "opacity", 0.35),
    ];
  }
  if (has("back-wall")) {
    return [
      (x) => corruptMiscolorPart(x, "left-stall-counter", "#78350f"),
      (x) => corruptMiscolorPart(x, "right-stall-counter", "#92400e"),
      (x) => corruptMiscolorPart(x, "hanging-sign", "#fde047"),
      (x) => corruptPartAttr(x, "lamp", "r", 8),
      (x) => corruptPartAttr(x, "sign-pin-left", "strokeWidth", 3),
      (x) => corruptMiscolorPart(x, "shopper-body", "#a855f7"),
      (x) => corruptDisplacedPart(x, "crate-apples", { dx: -6, dy: 0 }),
      (x) => corruptPartAttr(x, "right-post-left", "strokeWidth", 1),
      (x) => corruptMiscolorPart(x, "back-wall", "#ffedd5"),
      (x) => corruptMiscolorPart(x, "street", "#cbd5e1"),
      (x) => corruptPartAttr(x, "left-awning-base", "strokeWidth", 2),
      (x) => corruptPartAttr(x, "right-awning-base", "strokeWidth", 2),
      (x) => corruptMiscolorPart(x, "left-awning-red-1", "#f97316"),
      (x) => corruptMiscolorPart(x, "left-awning-red-3", "#f97316"),
      (x) => corruptPartAttr(x, "left-post", "strokeWidth", 1),
      (x) => corruptPartAttr(x, "right-post-right", "strokeWidth", 1),
      (x) => corruptMiscolorPart(x, "right-awning-blue-1", "#0ea5e9"),
      (x) => corruptMiscolorPart(x, "right-awning-blue-3", "#0ea5e9"),
      (x) => corruptPartAttr(x, "apple-1", "r", 3),
      (x) => corruptMiscolorPart(x, "apple-2", "#ef4444"),
      (x) => corruptMiscolorPart(x, "pear-3", "#84cc16"),
      (x) => corruptDisplacedPart(x, "crate-pears", { dx: 6, dy: 0 }),
      (x) => corruptMiscolorPart(x, "shopper-head", "#fde68a"),
    ];
  }
  return [];
};

const V2_WRONG_MARKER_COLORS = [
  "#111827", "#f8fafc", "#7f1d1d", "#164e63", "#581c87", "#365314",
  "#1e293b", "#fef08a", "#be123c", "#0f766e", "#312e81", "#9a3412",
];

const wrongMarkerColor = (part, index) => {
  const first = V2_WRONG_MARKER_COLORS[index % V2_WRONG_MARKER_COLORS.length];
  const current = part.fill ?? part.stroke;
  return first === current
    ? V2_WRONG_MARKER_COLORS[(index + 5) % V2_WRONG_MARKER_COLORS.length]
    : first;
};

const v2CalibrationOps = (scene) => {
  const markerParts = scene.parts.filter((p) => p.id.startsWith("variant-"));
  const ops = [];
  for (const [index, part] of markerParts.entries()) {
    const paintAttr = part.fill !== undefined ? "fill" : part.stroke !== undefined ? "stroke" : null;
    if (paintAttr) {
      ops.push((x) => corruptPartAttr(x, part.id, paintAttr, wrongMarkerColor(part, index)));
    }
    if (part.type === "rect") {
      ops.push((x) => corruptPartAttr(x, part.id, "x", part.x + (index % 2 ? -5 : 5)));
      ops.push((x) => corruptPartAttr(x, part.id, "width", part.width + 2));
    } else if (part.type === "circle") {
      ops.push((x) => corruptPartAttr(x, part.id, "cx", part.cx + (index % 2 ? -4 : 4)));
      ops.push((x) => corruptPartAttr(x, part.id, "r", Number((part.r + 0.75).toFixed(2))));
    } else if (part.type === "line") {
      ops.push((x) => corruptPartAttr(x, part.id, "x2", part.x2 + (index % 2 ? -7 : 7)));
      ops.push((x) => corruptPartAttr(x, part.id, "strokeWidth", Number((part.strokeWidth + 1.1).toFixed(2))));
    }
  }
  return ops;
};

const scenicV2Task = ({ id, category, sceneBuilder, corruption, instruction, difficulty = "hard" }) => ({
  id,
  difficulty,
  category,
  sceneBuilder: () => applyScenicV2Variant(sceneBuilder(), Number(id.slice(3))),
  corruption,
  instruction,
});

const SCENIC_V2_TASKS = [
  scenicV2Task({
    id: "sv_001",
    category: "scenic_multi",
    sceneBuilder: scenicTransitScene,
    instruction: "Apply the smallest station patch: signal-amber has the wrong color, train-door slid right, and overhead-wire has the wrong curve. Fix only those ids.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "signal-amber", "#000000"),
      (x) => corruptDisplacedPart(x, "train-door", { dx: 11, dy: 0 }),
      (x) => corruptPartAttr(x, "overhead-wire", "d", "M8 24 C42 16 74 16 108 24 S176 32 212 24"),
    ]),
  }),
  scenicV2Task({
    id: "sv_002",
    category: "scenic_multi",
    sceneBuilder: scenicHarborScene,
    instruction: "Apply the smallest harbor patch: buoy-green-stripe was repainted, mast is too thick, and rope-coil has the wrong path. Fix only those three defects.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "buoy-green-stripe", "#ef4444"),
      (x) => corruptPartAttr(x, "mast", "strokeWidth", 6),
      (x) => corruptPartAttr(x, "rope-coil", "d", "M48 82 C54 70 74 72 76 86 C78 100 52 100 48 90 C44 78 58 76 66 88"),
    ]),
  }),
  scenicV2Task({
    id: "sv_003",
    category: "scenic_multi",
    sceneBuilder: scenicTransitScene,
    instruction: "Repair the station locally: clock-hour is missing, clock-minute was duplicated, poster-blue shifted right, and platform-crack has the wrong path. Change only those parts.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMissingPart(x, "clock-hour"),
      (x) => corruptDuplicatePart(x, "clock-minute", { dx: -5, dy: 7 }),
      (x) => corruptDisplacedPart(x, "poster-blue", { dx: 7, dy: 0 }),
      (x) => corruptPartAttr(x, "platform-crack", "d", "M18 112 C32 116 42 103 56 112 S82 114 96 108"),
    ]),
  }),
  scenicV2Task({
    id: "sv_004",
    category: "scenic_multi",
    sceneBuilder: scenicCampScene,
    instruction: "Repair the campsite locally: tent-flap moved, star-2 is missing, flame-front has the wrong color, and smoke-curl has the wrong path. Fix only those ids.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptDisplacedPart(x, "tent-flap", { dx: -9, dy: 5 }),
      (x) => corruptMissingPart(x, "star-2"),
      (x) => corruptMiscolorPart(x, "flame-front", "#f97316"),
      (x) => corruptPartAttr(x, "smoke-curl", "d", "M168 80 C182 72 150 66 172 58 C184 50 154 46 170 38"),
    ]),
  }),
  scenicV2Task({
    id: "sv_005",
    category: "scenic_multi",
    sceneBuilder: scenicMarketScene,
    instruction: "Repair the market locally: remove the stray price sticker, restore pear-2's color, and restore bike-handlebar's curve. Preserve all stalls, fruit crates, shopper, and wheels.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptExtraPart(x, { id: "stray-price-sticker", type: "circle", cx: 118, cy: 26, r: 5, fill: "#a855f7", stroke: "#222", strokeWidth: 0.8 }),
      (x) => corruptMiscolorPart(x, "pear-2", "#dc2626"),
      (x) => corruptPartAttr(x, "bike-handlebar", "d", "M122 96 C134 82 142 94 138 104"),
    ]),
  }),
  scenicV2Task({
    id: "sv_006",
    category: "scenic_multi",
    sceneBuilder: scenicHarborScene,
    instruction: "Repair the harbor locally: remove extra-orange-buoy, flip sail-main back, and move cabin-window back into the cabin. Leave the lighthouse and real buoys untouched.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptExtraPart(x, { id: "extra-orange-buoy", type: "circle", cx: 116, cy: 116, r: 6, fill: "#f97316", stroke: "#222", strokeWidth: 1 }),
      (x) => corruptFlippedPart(x, "sail-main"),
      (x) => corruptDisplacedPart(x, "cabin-window", { dx: -8, dy: 3 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_007",
    category: "scenic_multi",
    sceneBuilder: scenicTransitScene,
    instruction: "Patch the station scene: restore missing clock-hour, remove the duplicate clock-minute, put platform-edge back to its thin height, and repair overhead-wire's path.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMissingPart(x, "clock-hour"),
      (x) => corruptDuplicatePart(x, "clock-minute", { dx: 4, dy: -8 }),
      (x) => corruptPartAttr(x, "platform-edge", "height", 10),
      (x) => corruptPartAttr(x, "overhead-wire", "d", "M8 14 C42 28 74 2 108 14 S176 30 212 12"),
    ]),
  }),
  scenicV2Task({
    id: "sv_008",
    category: "scenic_multi",
    sceneBuilder: scenicCampScene,
    instruction: "Patch the campsite scene: restore missing star-2, remove the duplicate smoke-2, move moon back, and repair trail-curve's path. Do not redraw the tent or trees.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMissingPart(x, "star-2"),
      (x) => corruptDuplicatePart(x, "smoke-2", { dx: -10, dy: -6 }),
      (x) => corruptDisplacedPart(x, "moon", { dx: -12, dy: 6 }),
      (x) => corruptPartAttr(x, "trail-curve", "d", "M86 104 C74 116 128 122 104 140"),
    ]),
  }),
  scenicV2Task({
    id: "sv_009",
    category: "scenic_multi",
    sceneBuilder: scenicMarketScene,
    instruction: "Patch the market scene: remove the duplicate bike-wheel-right, restore left-awning-red-2's red fill, move shopper-bag back, and repair the left-awning-scallop path.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptDuplicatePart(x, "bike-wheel-right", { dx: 12, dy: -4 }),
      (x) => corruptMiscolorPart(x, "left-awning-red-2", "#f8fafc"),
      (x) => corruptDisplacedPart(x, "shopper-bag", { dx: 0, dy: 9 }),
      (x) => corruptPartAttr(x, "left-awning-scallop", "d", "M14 60 C24 52 30 68 38 60 S54 52 62 60 S78 68 86 60 S94 52 96 60"),
    ]),
  }),
  scenicV2Task({
    id: "sv_010",
    category: "scenic_multi",
    sceneBuilder: scenicCampScene,
    instruction: "Patch the campsite scene: remove the duplicate smoke-2, restore tree-right-crown's polygon, repaint flame-front, and move backpack back to its original spot.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptDuplicatePart(x, "smoke-2", { dx: -10, dy: -6 }),
      (x) => corruptFlippedPart(x, "tree-right-crown"),
      (x) => corruptMiscolorPart(x, "flame-front", "#f97316"),
      (x) => corruptDisplacedPart(x, "backpack", { dx: 14, dy: 0 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_011",
    category: "scenic_very_hard",
    difficulty: "very_hard",
    sceneBuilder: scenicHarborScene,
    instruction: "Apply the exact harbor patch: mast stroke width, lighthouse-window color, light-beam position, harbor-wave-long path, and crate-right position are all wrong. Fix only these ids.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptPartAttr(x, "mast", "strokeWidth", 6),
      (x) => corruptMiscolorPart(x, "lighthouse-window", "#38bdf8"),
      (x) => corruptDisplacedPart(x, "light-beam", { dx: 8, dy: -4 }),
      (x) => corruptPartAttr(x, "harbor-wave-long", "d", "M82 122 C98 126 112 110 128 122 S158 126 174 122"),
      (x) => corruptDisplacedPart(x, "crate-right", { dx: 10, dy: 4 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_012",
    category: "scenic_very_hard",
    difficulty: "very_hard",
    sceneBuilder: scenicMarketScene,
    instruction: "Apply the exact market patch: bike-frame is too faint, bike-wheel-left is too heavy, right-awning-blue-2 was copied, pear-1 is wrong, and bike-handlebar path changed.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptPartAttr(x, "bike-frame", "strokeWidth", 0.5),
      (x) => corruptPartAttr(x, "bike-wheel-left", "strokeWidth", 4),
      (x) => corruptDuplicatePart(x, "right-awning-blue-2", { dx: 8, dy: 0 }),
      (x) => corruptMiscolorPart(x, "pear-1", "#dc2626"),
      (x) => corruptPartAttr(x, "bike-handlebar", "d", "M122 96 C128 100 134 84 140 94"),
    ]),
  }),
  scenicV2Task({
    id: "sv_013",
    category: "scenic_very_hard",
    difficulty: "very_hard",
    sceneBuilder: scenicHarborScene,
    instruction: "Apply the exact harbor patch: sail-main flipped, buoy-red-stripe was recolored, cabin-window moved, stray-pier-rope was added, and rope-coil path changed.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptFlippedPart(x, "sail-main"),
      (x) => corruptMiscolorPart(x, "buoy-red-stripe", "#22c55e"),
      (x) => corruptDisplacedPart(x, "cabin-window", { dx: -8, dy: 3 }),
      (x) => corruptExtraPart(x, { id: "stray-pier-rope", type: "polyline", points: [[8, 84], [20, 80], [32, 84]], stroke: "#f8fafc", strokeWidth: 2, fill: "none" }),
      (x) => corruptPartAttr(x, "rope-coil", "d", "M48 84 C62 70 74 80 68 90 C60 102 44 92 54 82 C62 74 66 86 60 90"),
    ]),
  }),
  scenicV2Task({
    id: "sv_014",
    category: "scenic_very_hard",
    difficulty: "very_hard",
    sceneBuilder: scenicCampScene,
    instruction: "Apply the exact camp patch: tree-right-crown is mirrored, moon moved, star-4 is missing, smoke-curl path changed, and tent-line-right is too thick.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptFlippedPart(x, "tree-right-crown"),
      (x) => corruptDisplacedPart(x, "moon", { dx: 10, dy: -7 }),
      (x) => corruptMissingPart(x, "star-4"),
      (x) => corruptPartAttr(x, "smoke-curl", "d", "M168 80 C152 88 186 62 158 58 C146 52 180 44 160 38"),
      (x) => corruptPartAttr(x, "tent-line-right", "strokeWidth", 3),
    ]),
  }),
  scenicV2Task({
    id: "sv_015",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicTransitScene,
    instruction: "Apply the exact station patch: train-door color, clock-minute duplicate, poster-blue position, signal-green color, platform-crack path, and passenger-bag position are wrong.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "train-door", "#ffffff"),
      (x) => corruptDuplicatePart(x, "clock-minute", { dx: -5, dy: 7 }),
      (x) => corruptDisplacedPart(x, "poster-blue", { dx: 7, dy: 0 }),
      (x) => corruptMiscolorPart(x, "signal-green", "#ef4444"),
      (x) => corruptPartAttr(x, "platform-crack", "d", "M18 109 C30 116 44 101 58 111 S82 114 96 105"),
      (x) => corruptDisplacedPart(x, "passenger-bag", { dx: 10, dy: -3 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_016",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicHarborScene,
    instruction: "Apply the exact harbor patch: lighthouse-window color, light-beam position, extra-pier-buoy removal, sail-small fill, harbor-wave-long path, and crate-left position.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "lighthouse-window", "#38bdf8"),
      (x) => corruptDisplacedPart(x, "light-beam", { dx: 8, dy: -4 }),
      (x) => corruptExtraPart(x, { id: "extra-pier-buoy", type: "circle", cx: 70, cy: 112, r: 5, fill: "#facc15", stroke: "#222", strokeWidth: 0.8 }),
      (x) => corruptMiscolorPart(x, "sail-small", "#fef3c7"),
      (x) => corruptPartAttr(x, "harbor-wave-long", "d", "M82 116 C96 126 112 108 128 116 S158 126 174 116"),
      (x) => corruptDisplacedPart(x, "crate-left", { dx: -8, dy: 5 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_017",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicCampScene,
    instruction: "Apply the exact camp patch: moon position, flame-front color, backpack duplicate, smoke-curl path, trail-curve path, and tent-flap position are wrong.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptDisplacedPart(x, "moon", { dx: -12, dy: 6 }),
      (x) => corruptMiscolorPart(x, "flame-front", "#f97316"),
      (x) => corruptDuplicatePart(x, "backpack", { dx: 14, dy: 0 }),
      (x) => corruptPartAttr(x, "smoke-curl", "d", "M168 80 C186 72 150 64 174 56 C186 50 152 46 172 38"),
      (x) => corruptPartAttr(x, "trail-curve", "d", "M86 104 C110 100 92 132 120 140"),
      (x) => corruptDisplacedPart(x, "tent-flap", { dx: 7, dy: -4 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_018",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicMarketScene,
    instruction: "Apply the exact market patch: pear-2 color, shopper-bag position, right-awning-blue-2 duplicate, left-awning-scallop path, bike-frame stroke width, and apple-3 color.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "pear-2", "#dc2626"),
      (x) => corruptDisplacedPart(x, "shopper-bag", { dx: 0, dy: 9 }),
      (x) => corruptDuplicatePart(x, "right-awning-blue-2", { dx: 8, dy: 0 }),
      (x) => corruptPartAttr(x, "left-awning-scallop", "d", "M14 60 C20 70 32 50 38 62 S54 70 62 58 S78 50 86 62 S94 70 96 58"),
      (x) => corruptPartAttr(x, "bike-frame", "strokeWidth", 0.5),
      (x) => corruptMiscolorPart(x, "apple-3", "#a3e635"),
    ]),
  }),
  scenicV2Task({
    id: "sv_019",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicHarborScene,
    instruction: "Apply the exact harbor patch: sail-main, buoy-red-stripe, cabin-window, stray-pier-rope, mast width, rope-coil path, and buoy-green position all need local repairs.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptFlippedPart(x, "sail-main"),
      (x) => corruptMiscolorPart(x, "buoy-red-stripe", "#22c55e"),
      (x) => corruptDisplacedPart(x, "cabin-window", { dx: -8, dy: 3 }),
      (x) => corruptExtraPart(x, { id: "stray-pier-rope", type: "polyline", points: [[8, 84], [20, 80], [32, 84]], stroke: "#f8fafc", strokeWidth: 2, fill: "none" }),
      (x) => corruptPartAttr(x, "mast", "strokeWidth", 6),
      (x) => corruptPartAttr(x, "rope-coil", "d", "M48 82 C58 70 72 76 70 88 C68 100 50 94 52 84 C54 76 64 78 66 88"),
      (x) => corruptDisplacedPart(x, "buoy-green", { dx: -12, dy: 4 }),
    ]),
  }),
  scenicV2Task({
    id: "sv_020",
    category: "scenic_multi",
    difficulty: "very_hard",
    sceneBuilder: scenicTransitScene,
    instruction: "Apply the exact station patch: signal-amber color, window-center position, passenger-bag duplicate, platform-edge height, overhead-wire path, train-roof color, and bench-seat position are wrong.",
    corruption: (s) => corruptMulti(s, [
      (x) => corruptMiscolorPart(x, "signal-amber", "#22c55e"),
      (x) => corruptDisplacedPart(x, "window-center", { dx: 0, dy: -8 }),
      (x) => corruptDuplicatePart(x, "passenger-bag", { dx: 10, dy: -3 }),
      (x) => corruptPartAttr(x, "platform-edge", "height", 10),
      (x) => corruptPartAttr(x, "overhead-wire", "d", "M8 18 C48 30 72 2 108 18 S172 34 212 18"),
      (x) => corruptMiscolorPart(x, "train-roof", "#f97316"),
      (x) => corruptDisplacedPart(x, "bench-seat", { dx: -9, dy: 4 }),
    ]),
  }),
];

if (SCENIC_V2_TASKS.length !== SCENIC_V2_EXPECTED_COUNT) {
  throw new Error(`expected ${SCENIC_V2_EXPECTED_COUNT} scenic v2 tasks, got ${SCENIC_V2_TASKS.length}`);
}
const scenicIds = new Set(SCENIC_V2_TASKS.map((task) => task.id));
if (scenicIds.size !== SCENIC_V2_TASKS.length) throw new Error("duplicate scenic v2 task id");
const scenicInstructions = new Set(SCENIC_V2_TASKS.map((task) => task.instruction));
if (scenicInstructions.size !== SCENIC_V2_TASKS.length) throw new Error("duplicate scenic v2 instruction");

const OUTPUT_TASKS = PROMPT_VERSION === "v2"
  ? SCENIC_V2_TASKS
  : TASKS;

if (PROMPT_VERSION === "v2" && OUTPUT_TASKS.length !== SCENIC_V2_EXPECTED_COUNT) {
  throw new Error(`expected ${SCENIC_V2_EXPECTED_COUNT} v2 tasks, got ${OUTPUT_TASKS.length}`);
}

const existingAuthoredAt = new Map();
if (existsSync(OUT)) {
  for (const f of readdirSync(OUT)) {
    if (/^[a-z]+_\d+\.json$/.test(f)) {
      const existing = JSON.parse(readFileSync(join(OUT, f), "utf-8"));
      if (existing.authored_at) existingAuthoredAt.set(existing.task_id, existing.authored_at);
    }
  }
  for (const f of readdirSync(OUT)) {
    if (/^[a-z]+_\d+\.json$/.test(f)) rmSync(join(OUT, f));
  }
} else {
  mkdirSync(OUT, { recursive: true });
}

const authoredAt = new Date().toISOString();
for (const t of OUTPUT_TASKS) {
  const clean = t.sceneBuilder();
  const { corrupted, fix } = t.corruption(clean);
  const { spec: target, diff: rawDiff } = fix(corrupted);
  const diff = PROMPT_VERSION === "v2" ? augmentV2Diff(rawDiff, corrupted, target) : rawDiff;
  const initialIds = sceneIds(corrupted);
  const targetIds = sceneIds(target);
  const allIds = [...new Set([...initialIds, ...targetIds])];
  const changed = new Set(diff.map((d) => d.part).filter((p) => p !== "__svg"));
  const shouldPreserve = allIds.filter((id) => !changed.has(id));
  const instruction = PROMPT_VERSION === "v2"
    ? v2Instruction(t.instruction, diff, shouldPreserve)
    : t.instruction;

  const taskRecord = {
    task_id: t.id,
    difficulty: t.difficulty,
    category: t.category,
    instruction,
    initial_svg: renderScene(corrupted),
    target_svg: renderScene(target),
    parts: allIds,
    target_parts: [...changed],
    expected_diff: diff,
    should_preserve: shouldPreserve,
    authored_at: existingAuthoredAt.get(t.id) ?? authoredAt,
  };
  if (PROMPT_VERSION === "v2") taskRecord.prompt_version = "v2";

  writeFileSync(join(OUT, `${t.id}.json`), JSON.stringify(taskRecord, null, 2));
}

const byDiff = OUTPUT_TASKS.reduce((acc, t) => ((acc[t.difficulty] = (acc[t.difficulty] ?? 0) + 1), acc), {});
const byCategory = OUTPUT_TASKS.reduce((acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + 1), acc), {});

console.log(`authored ${OUTPUT_TASKS.length} ${PROMPT_VERSION} tasks to ${OUT}`);
console.log("by difficulty:", byDiff);
console.log("by category:  ", byCategory);
if (PROMPT_VERSION === "v1") {
  console.log(`unique base icons: ${usedBaseIconSources.size}`);
  console.log(`unique instructions: ${usedInstructions.size}`);
} else {
  console.log("scenic source scenes:", ["station", "harbor", "camp", "market"].join(", "));
  console.log(`unique scenic instructions: ${scenicInstructions.size}`);
}
