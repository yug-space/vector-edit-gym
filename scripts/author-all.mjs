// Author exactly 106 hand-curated tasks.
//
// This file intentionally uses one named task function per task. The helpers
// keep rendering/corruption mechanics consistent, while the task functions
// make the curriculum easy to audit for uniqueness and prompt quality.

import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
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
const OUT = join(DATA, "tasks");

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
    authored_at: existingAuthoredAt.get(t.id) ?? authoredAt,
  }, null, 2));
}

const byDiff = TASKS.reduce((acc, t) => ((acc[t.difficulty] = (acc[t.difficulty] ?? 0) + 1), acc), {});
const byCategory = TASKS.reduce((acc, t) => ((acc[t.category] = (acc[t.category] ?? 0) + 1), acc), {});

console.log(`authored ${TASKS.length} tasks`);
console.log("by difficulty:", byDiff);
console.log("by category:  ", byCategory);
console.log(`unique base icons: ${usedBaseIconSources.size}`);
console.log(`unique instructions: ${usedInstructions.size}`);
