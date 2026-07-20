#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultCorpus = join(__dirname, "..", "data", "tasks");
const corpusDir = resolve(process.cwd(), process.argv[2] ?? defaultCorpus);
const EXPECTED_FROZEN_HASH = "2a62410b5de7383030c1a8b77d5d4d416e6be8efd11dc7322393a04f54e464d1";

const INSTRUCTIONS = {
  sv_001: "The amber signal has gone dark, the train door is sitting too far to the right, and the overhead cable has an awkward sag. Put those three details back in place and leave the rest of the station alone.",
  sv_002: "At the harbor, the green stripe on one buoy was painted red, the sailboat mast looks much too heavy, and the rope coil has lost its neat loop. Correct those small mistakes without changing the surrounding scene.",
  sv_003: "The station clock is missing its hour hand and has an extra minute hand. The blue poster has also shifted sideways, and a crack along the platform has been bent out of shape. Repair only those details.",
  sv_004: "The tent flap is out of alignment, one star has disappeared, the front of the campfire is the wrong color, and the smoke curls the wrong way. Restore the campsite without touching the trees or other objects.",
  sv_005: "A stray price sticker has appeared in the market, one pear is red instead of green, and the bicycle handlebar has a distorted bend. Clean up those three issues while keeping the stalls and shoppers unchanged.",
  sv_006: "Remove the extra orange buoy from the water, turn the main sail back the right way, and place the little cabin window neatly inside the cabin again. Keep the lighthouse and the real buoys as they are.",
  sv_007: "The station clock needs its missing hour hand back and its duplicate minute hand removed. The bright platform edge is too thick, and the overhead wire should follow a smoother, shallower curve. Change nothing else.",
  sv_008: "A star is missing from the campsite sky, there is an extra puff of smoke, and the moon has drifted down and left. The trail through the ground also bends the wrong way. Fix these without redrawing the tent or trees.",
  sv_009: "The market bicycle has gained a second right wheel, one red awning panel has turned white, and the shopper's bag hangs too low. Restore the wavy edge of the left awning as well, leaving everything else intact.",
  sv_010: "Remove the duplicate smoke puff, turn the right-hand treetop back the correct way, make the front flame yellow again, and move the backpack back beside the tent. Preserve the rest of the campsite.",
  sv_011: "The harbor mast and the outline of the long wave are too heavy and misshapen, the lighthouse window is blue instead of glowing yellow, and its beam has shifted. The crate on the right also needs to sit back with the other cargo. Repair only these visible mistakes.",
  sv_012: "The bicycle frame is almost invisible while its left wheel is drawn too heavily. Remove the copied blue awning panel, make the odd red pear green again, and smooth out the handlebar. Leave the rest of the market untouched.",
  sv_013: "The main sail is facing the wrong way, the red buoy stripe has turned green, and the cabin window has slipped out of place. Remove the stray rope by the pier and tidy the rope coil, without changing anything else in the harbor.",
  sv_014: "Turn the right treetop back around, return the moon to the upper-right sky, and replace the missing star nearby. The campfire smoke should curl naturally, and the right tent seam should be thin again. Keep all other campsite details as they are.",
  sv_015: "Make the train door pale yellow again, remove the extra clock hand, and slide the blue poster back into line. The green signal should be green, the platform crack should follow its original shallow zigzag, and the passenger's bag should sit beside them again.",
  sv_016: "The lighthouse window should glow yellow and its beam should point cleanly across the harbor. Remove the extra buoy near the pier, make the small sail light blue, smooth the long wave, and return the left crate to the cargo stack. Do not alter the rest.",
  sv_017: "Move the moon back up and right, make the front flame yellow, and remove the duplicate backpack. Restore the gentle shapes of both the smoke and the trail, then center the tent flap again. Everything else at the campsite should remain unchanged.",
  sv_018: "One pear should be green, one apple should be red, and the shopper's bag should hang higher. Remove the copied blue awning panel, restore the scalloped edge on the left awning, and give the bicycle frame its normal line weight. Preserve the rest of the market.",
  sv_019: "Repair the harbor by turning the main sail around, making the red buoy stripe red again, and placing the cabin window back inside the cabin. Remove the stray pier rope, slim down the mast, neaten the rope coil, and return the green buoy to its proper spot.",
  sv_020: "The amber signal should be amber, the middle train window has shifted upward, and the passenger has an extra bag. Thin the platform edge, smooth the overhead cable, return the train roof to its dark color, and move the bench seat back into line. Leave all other station details alone.",
  sv_021: "Remove the obvious colored marker from the mountain sunrise. Center the broad sun glow behind the pale sun, return the sun itself to a warm ivory, and make the most distant mountain ridge a little more visible. Keep the village and foreground untouched.",
  sv_022: "In the deep-sea scene, remove the stray colored marker and move the displaced glowing particle back toward the nearby cluster. The large jellyfish should have fine tentacles and a soft pink lower rim, while the second shaft of light should be clearly visible. Leave the other creatures alone.",
  sv_023: "Clean the stray marker out of the rainy alley. A small window on the far-left building should glow cyan, the broad haze should be centered over the street, and the tall pink sign should have its normal bold outline. Restore the warm reflection near the middle of the wet road as well.",
  sv_024: "Remove the bright marker that does not belong in the enchanted forest. Shift the upper-left canopy glow back over the trees, make the large foreground mushroom stem deep green, thin the bright line along the stream, and soften the low band of fog. Preserve the other plants and lights.",
  sv_025: "Take the stray marker out of the arctic sky. Return the displaced star to the upper-left, make the moon a soft white, restore the strong green aurora streak on the left, and bring back the brighter second aurora curtain. Do not disturb the snowy landscape.",
  sv_026: "Remove the accidental marker from the vineyard sunset. Recenter the large golden sun glow behind the sun, restore the warm brown roof on the stone villa, and make the pale horizon haze clearly visible again. Leave the vines and cypress trees unchanged.",
  sv_027: "Clear the stray marker from the steampunk sky port. The glowing sun should be centered, the foreground airship should have a slimmer dark-red outline and matching vertical seam, and the bright center of the sun should be nearly solid. Keep the docks and other airships intact.",
  sv_028: "Remove the colored marker from the reef and return the loose bubble to the small group at upper left. One fish in the school should be orange again, the turtle shell outline should be light rather than heavy, and the second underwater sunbeam should regain its brightness. Preserve the remaining coral and fish.",
  sv_029: "Delete the stray marker in the canyon sky and move the displaced star back to the upper-left cluster. The far-left mesa should be more distinct through the haze, and the bright winding river should return to its pale reflective color. Leave the rocks and cacti unchanged.",
  sv_030: "Remove the unwanted marker from the spring temple scene. Center the koi pond and restore its medium-weight rim, make the pale koi white again, and bring back the softly visible mountain in the distance. Keep the bridge, temple, and blossoms as they are.",
  sv_031: "Take the stray marker out of the rainy library. Move the warm lamp glow back toward the right side, restore the golden book on the upper-left shelf, give the rug its normal outline, and keep the fireplace glow subtle rather than washed out. Do not change the furniture or cat.",
  sv_032: "Remove the extra marker from the balloon festival and recenter the large sun glow toward the left. A basket beneath one middle balloon should be brown, the rigging on a small distant balloon should be delicate, and the white panel lines on the middle balloon should be softly visible. Preserve all other balloons and fields.",
  sv_033: "Clear the stray marker from the alien moon scene. Move the left nebula cloud back into place, restore the rover's silver body, return the rear planetary ring to its broad band, and make the darker oval band on the planet gently visible again. Leave the stars and moon surface untouched.",
  sv_034: "Remove the accidental marker from the jungle ruins. Shift the left canopy mass back toward the edge, restore the red body of the macaw, thin the smaller waterfall on the right, and make the central background canopy more visible. Keep the temple and foreground plants unchanged.",
  sv_035: "Delete the stray marker from the alpine village sky and return the displaced star to the upper-left. The frozen pond should have its pale outline, the skater's thin limb should no longer look heavy, and the faint spot on the moon should be visible again. Preserve the chalets and mountains.",
  sv_036: "Remove the unwanted marker from the lavender field. Recenter the large sun glow on the right, make the pale wing on the small bee visible again, slim the butterfly's body line, and strengthen the narrow horizon strip. Leave the windmill and lavender rows untouched.",
  sv_037: "Take the stray marker out of the volcanic night sky and return the displaced star to the upper-left. The smaller peak should be nearly black, the bright core of the left lava flow should be narrower, and the ash cloud should regain its dense smoky appearance. Do not alter the main volcano or lake.",
  sv_038: "Remove the colored marker from the Venetian sunset. Center the large sun glow behind the canal, restore the dark red body of the gondola, slim the main arch of the bridge, and bring back the warm glow in the affected window. Keep the other buildings and reflections intact.",
  sv_039: "Clear the stray marker from the savanna scene. Center the huge setting sun, restore the pale reflection in the watering hole, slim the watering hole's outer rim, and make the golden heat band above the horizon more visible. Leave the animals and trees unchanged.",
  sv_040: "Remove the accidental marker from the floating-islands sky. Move the large sun glow back toward the upper right, restore the purple roof on the castle tower, slim the little flagpole, and make the grass edge on the main island more visible. Preserve the waterfalls, bridge, and distant islands.",
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function frozenRows(tasks) {
  return tasks
    .map(({ instruction: _instruction, ...task }) => task)
    .sort((a, b) => a.task_id.localeCompare(b.task_id));
}

function frozenHash(tasks) {
  return createHash("sha256").update(stable(frozenRows(tasks))).digest("hex");
}

if (!existsSync(corpusDir)) throw new Error(`task directory not found: ${corpusDir}`);
const files = readdirSync(corpusDir).filter((file) => /^sv_\d+\.json$/.test(file)).sort();
const tasks = files.map((file) => JSON.parse(readFileSync(join(corpusDir, file), "utf8")));

if (tasks.length !== 40) throw new Error(`expected 40 frozen tasks, found ${tasks.length}`);
if (Object.keys(INSTRUCTIONS).length !== 40) throw new Error("instruction manifest must contain 40 tasks");
const missing = tasks.map((task) => task.task_id).filter((taskId) => !INSTRUCTIONS[taskId]);
if (missing.length) throw new Error(`missing human instructions for: ${missing.join(", ")}`);

const before = frozenHash(tasks);
if (before !== EXPECTED_FROZEN_HASH) {
  throw new Error(`frozen corpus mismatch: expected ${EXPECTED_FROZEN_HASH}, found ${before}`);
}

for (const [index, task] of tasks.entries()) {
  task.instruction = INSTRUCTIONS[task.task_id];
  writeFileSync(join(corpusDir, files[index]), `${JSON.stringify(task, null, 2)}\n`);
}

const refreshed = files.map((file) => JSON.parse(readFileSync(join(corpusDir, file), "utf8")));
const after = frozenHash(refreshed);
if (after !== before) throw new Error(`non-instruction fields changed: ${before} -> ${after}`);

const byDifficulty = {};
const byCategory = {};
for (const task of refreshed) {
  byDifficulty[task.difficulty] = (byDifficulty[task.difficulty] ?? 0) + 1;
  byCategory[task.category] = (byCategory[task.category] ?? 0) + 1;
}
const index = {
  benchmark: "VectorEditGym",
  release: "2026-07",
  count: refreshed.length,
  frozen_content_sha256: after,
  by_difficulty: byDifficulty,
  by_category: byCategory,
  tasks: refreshed
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(({ task_id, difficulty, category, instruction, display_order }) => ({
      task_id,
      difficulty,
      category,
      instruction,
      display_order,
    })),
};
writeFileSync(join(corpusDir, "_index.json"), `${JSON.stringify(index, null, 2)}\n`);

console.log(`Updated ${refreshed.length} instructions in ${corpusDir}`);
console.log(`Frozen non-instruction SHA-256: ${after}`);
