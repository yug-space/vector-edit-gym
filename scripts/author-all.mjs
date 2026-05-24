// Author all 300 tasks.
//
// Each entry is hand-crafted. No template substitution. Every instruction is
// a unique string literal — the variety in phrasing is the point, since the
// benchmark is partly testing whether models read instructions carefully.
//
// Layout:
//   60 Very Easy   — single icon, single attribute corruption
//   70 Easy        — composite scene, one obvious problem
//   80 Medium      — composite scene, subtler problem or different kind
//   60 Hard        — flipped/duplicate/multi-step or very subtle corruption
//   30 Very Hard   — 3-issue multi-corruption, dense scenes, tight tolerances
//
// Run from the repo root:  node scripts/author-all.mjs

import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { place } from "./lib/icon-catalog.mjs";
import { SCENES } from "./lib/icon-scenes.mjs";
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
const OUT = join(__dirname, "..", "data", "tasks");

// ---- helpers --------------------------------------------------------------

const single = (name) => ({
  canvas: [128, 128],
  bg: "white",
  parts: [place(name, { id: name, x: 8, y: 8, size: 112, color: "#222", strokeWidth: 1.5 })],
});

const scene = (key) => () => SCENES[key]();

// Task entry shape:
//   [id, difficulty, category, sceneBuilder, corruptionBuilder, instruction]
//
// sceneBuilder() returns a fresh clean spec.
// corruptionBuilder(cleanSpec) returns { corrupted, fix } from corruptions.mjs.

const TASKS = [];

const add = (id, difficulty, category, sceneBuilder, corruptionBuilder, instruction) =>
  TASKS.push({ id, difficulty, category, sceneBuilder, corruptionBuilder, instruction });

// ==========================================================================
// VERY EASY (60)
// ==========================================================================

// ---- VE wrong_color (20) -------------------------------------------------
add("ve_001", "very_easy", "wrong_color", () => single("home"),       (s) => corruptIconColor(s, "#e63946", "#222"), "This home icon got tinted red by mistake. Restore its default black outline.");
add("ve_002", "very_easy", "wrong_color", () => single("heart"),      (s) => corruptIconColor(s, "#3b82f6", "#222"), "Someone changed this heart's color to blue. Set it back to the standard black.");
add("ve_003", "very_easy", "wrong_color", () => single("star"),       (s) => corruptIconColor(s, "#22c55e", "#222"), "The star is drawn in green here — it should be black. Fix the color.");
add("ve_004", "very_easy", "wrong_color", () => single("sun"),        (s) => corruptIconColor(s, "#a855f7", "#222"), "The sun icon is purple, which is wrong. Restore the default neutral black.");
add("ve_005", "very_easy", "wrong_color", () => single("moon"),       (s) => corruptIconColor(s, "#f97316", "#222"), "The moon was repainted orange. Put it back to black.");
add("ve_006", "very_easy", "wrong_color", () => single("cloud"),      (s) => corruptIconColor(s, "#ec4899", "#222"), "Pink clouds aren't on brand. Reset this icon to its default black outline.");
add("ve_007", "very_easy", "wrong_color", () => single("fire"),       (s) => corruptIconColor(s, "#3b82f6", "#222"), "A blue fire icon is wrong. Change it back to black.");
add("ve_008", "very_easy", "wrong_color", () => single("bell"),       (s) => corruptIconColor(s, "#fde047", "#222"), "The bell looks yellow — that's not its default color. Restore black.");
add("ve_009", "very_easy", "wrong_color", () => single("envelope"),   (s) => corruptIconColor(s, "#22c55e", "#222"), "A green envelope: not the default. Make it the usual black again.");
add("ve_010", "very_easy", "wrong_color", () => single("shopping-cart"), (s) => corruptIconColor(s, "#e63946", "#222"), "This shopping-cart was recolored red by accident. Reset it to black.");
add("ve_011", "very_easy", "wrong_color", () => single("cog"),        (s) => corruptIconColor(s, "#06b6d4", "#222"), "The settings cog is cyan here. Restore the default black look.");
add("ve_012", "very_easy", "wrong_color", () => single("user"),       (s) => corruptIconColor(s, "#a855f7", "#222"), "The user icon is purple. Reset it to its standard black color.");
add("ve_013", "very_easy", "wrong_color", () => single("camera"),     (s) => corruptIconColor(s, "#f97316", "#222"), "Camera icon is orange — wrong. Restore the original black.");
add("ve_014", "very_easy", "wrong_color", () => single("phone"),      (s) => corruptIconColor(s, "#22c55e", "#222"), "A green phone icon doesn't fit. Change it back to black.");
add("ve_015", "very_easy", "wrong_color", () => single("microphone"), (s) => corruptIconColor(s, "#ec4899", "#222"), "Microphone is pink, which is unintentional. Repaint it black.");
add("ve_016", "very_easy", "wrong_color", () => single("map-pin"),    (s) => corruptIconColor(s, "#3b82f6", "#222"), "The map pin was tinted blue. Restore the default black outline.");
add("ve_017", "very_easy", "wrong_color", () => single("document"),   (s) => corruptIconColor(s, "#fde047", "#222"), "A yellow document icon isn't right. Switch it back to black.");
add("ve_018", "very_easy", "wrong_color", () => single("folder"),     (s) => corruptIconColor(s, "#e63946", "#222"), "Folder was made red by mistake. Restore the standard black.");
add("ve_019", "very_easy", "wrong_color", () => single("bookmark"),   (s) => corruptIconColor(s, "#22c55e", "#222"), "Bookmark icon is green — wrong color. Reset to black.");
add("ve_020", "very_easy", "wrong_color", () => single("key"),        (s) => corruptIconColor(s, "#3b82f6", "#222"), "The key icon is blue. Put it back to the default black outline.");

// ---- VE wrong_stroke_width (15) ------------------------------------------
add("ve_021", "very_easy", "wrong_stroke_width", () => single("home"),       (s) => corruptStrokeWidth(s, 4,   1.5), "The home icon is drawn way too thick. Bring it back to the default 1.5 stroke-width.");
add("ve_022", "very_easy", "wrong_stroke_width", () => single("heart"),      (s) => corruptStrokeWidth(s, 0.5, 1.5), "This heart is painfully thin. Reset to the standard 1.5 stroke-width.");
add("ve_023", "very_easy", "wrong_stroke_width", () => single("star"),       (s) => corruptStrokeWidth(s, 3.5, 1.5), "The star's strokes are too heavy. Restore the default 1.5 width.");
add("ve_024", "very_easy", "wrong_stroke_width", () => single("sun"),        (s) => corruptStrokeWidth(s, 0.75,1.5), "The sun's lines look anemic. Set the stroke-width back to 1.5.");
add("ve_025", "very_easy", "wrong_stroke_width", () => single("cloud"),      (s) => corruptStrokeWidth(s, 4.5, 1.5), "The cloud is far too bold. Reset stroke-width to 1.5.");
add("ve_026", "very_easy", "wrong_stroke_width", () => single("bell"),       (s) => corruptStrokeWidth(s, 0.5, 1.5), "Bell is barely visible — its stroke is too thin. Restore 1.5.");
add("ve_027", "very_easy", "wrong_stroke_width", () => single("envelope"),   (s) => corruptStrokeWidth(s, 4,   1.5), "Envelope's lines are too thick. Set stroke-width back to the default 1.5.");
add("ve_028", "very_easy", "wrong_stroke_width", () => single("camera"),     (s) => corruptStrokeWidth(s, 3,   1.5), "Camera looks bulky — its stroke is too heavy. Reset to 1.5.");
add("ve_029", "very_easy", "wrong_stroke_width", () => single("microphone"), (s) => corruptStrokeWidth(s, 0.6, 1.5), "Microphone is washed out from a thin stroke. Restore default 1.5.");
add("ve_030", "very_easy", "wrong_stroke_width", () => single("user"),       (s) => corruptStrokeWidth(s, 4,   1.5), "User icon is drawn with bold lines. Reset stroke-width to 1.5.");
add("ve_031", "very_easy", "wrong_stroke_width", () => single("cog"),        (s) => corruptStrokeWidth(s, 0.5, 1.5), "The cog has a hairline stroke. Bump it back to 1.5.");
add("ve_032", "very_easy", "wrong_stroke_width", () => single("magnifying-glass"), (s) => corruptStrokeWidth(s, 3.5, 1.5), "Search icon is too thick. Reset stroke-width to the standard 1.5.");
add("ve_033", "very_easy", "wrong_stroke_width", () => single("clock"),      (s) => corruptStrokeWidth(s, 0.5, 1.5), "The clock is rendered with very thin lines. Set stroke-width back to 1.5.");
add("ve_034", "very_easy", "wrong_stroke_width", () => single("calendar"),   (s) => corruptStrokeWidth(s, 4,   1.5), "Calendar looks too heavy. Restore stroke-width 1.5.");
add("ve_035", "very_easy", "wrong_stroke_width", () => single("photo"),      (s) => corruptStrokeWidth(s, 0.75,1.5), "Photo icon is faint — stroke is too thin. Reset to 1.5.");

// ---- VE wrong_scale (10) -------------------------------------------------
add("ve_036", "very_easy", "wrong_scale", () => single("home"),       (s) => corruptScale(s, 64, 112), "The home icon shrank — it should fill the canvas. Restore it to size 112.");
add("ve_037", "very_easy", "wrong_scale", () => single("heart"),      (s) => corruptScale(s, 120,112), "The heart is rendered too large and pushes outside the safe area. Reset to size 112.");
add("ve_038", "very_easy", "wrong_scale", () => single("star"),       (s) => corruptScale(s, 60, 112), "Star is too small to read. Scale it back up to 112.");
add("ve_039", "very_easy", "wrong_scale", () => single("sun"),        (s) => corruptScale(s, 124,112), "Sun is overflowing the canvas. Shrink it back to size 112.");
add("ve_040", "very_easy", "wrong_scale", () => single("bell"),       (s) => corruptScale(s, 56, 112), "Bell looks tiny. Restore its proper size of 112.");
add("ve_041", "very_easy", "wrong_scale", () => single("envelope"),   (s) => corruptScale(s, 122,112), "Envelope is oversized. Bring it back to size 112.");
add("ve_042", "very_easy", "wrong_scale", () => single("camera"),     (s) => corruptScale(s, 64, 112), "Camera shrank to half its normal size. Reset to 112.");
add("ve_043", "very_easy", "wrong_scale", () => single("phone"),      (s) => corruptScale(s, 124,112), "Phone is too big and crowded. Restore it to 112.");
add("ve_044", "very_easy", "wrong_scale", () => single("folder"),     (s) => corruptScale(s, 60, 112), "Folder is small and lost on the canvas. Scale it up to 112.");
add("ve_045", "very_easy", "wrong_scale", () => single("clock"),      (s) => corruptScale(s, 120,112), "Clock is rendered too large. Reset to size 112.");

// ---- VE clipped_viewbox (10) ---------------------------------------------
add("ve_046", "very_easy", "clipped_viewbox", () => single("home"),       (s) => corruptClippedViewBox(s, 80, 80),  "The home icon is being cut off by the canvas. Expand the viewBox so it fits.");
add("ve_047", "very_easy", "clipped_viewbox", () => single("heart"),      (s) => corruptClippedViewBox(s, 64, 64),  "Heart is clipped — the canvas is too small. Make the viewBox big enough.");
add("ve_048", "very_easy", "clipped_viewbox", () => single("star"),       (s) => corruptClippedViewBox(s, 80, 80),  "Half the star is missing because the canvas is undersized. Restore the original 128x128 viewBox.");
add("ve_049", "very_easy", "clipped_viewbox", () => single("sun"),        (s) => corruptClippedViewBox(s, 96, 96),  "The sun's edges are cut. Resize the canvas back to 128x128.");
add("ve_050", "very_easy", "clipped_viewbox", () => single("cloud"),      (s) => corruptClippedViewBox(s, 80, 80),  "Cloud is being cropped. Set the viewBox to 128x128 so the whole icon shows.");
add("ve_051", "very_easy", "clipped_viewbox", () => single("bell"),       (s) => corruptClippedViewBox(s, 72, 72),  "The bell is clipping out of the canvas. Expand back to 128x128.");
add("ve_052", "very_easy", "clipped_viewbox", () => single("envelope"),   (s) => corruptClippedViewBox(s, 96, 80),  "Envelope hangs off the bottom. Restore the canvas to 128x128.");
add("ve_053", "very_easy", "clipped_viewbox", () => single("camera"),     (s) => corruptClippedViewBox(s, 64, 64),  "Camera is mostly cropped out. Fix the viewBox.");
add("ve_054", "very_easy", "clipped_viewbox", () => single("phone"),      (s) => corruptClippedViewBox(s, 80, 80),  "Phone icon's right edge is gone. Expand the viewBox to 128x128.");
add("ve_055", "very_easy", "clipped_viewbox", () => single("folder"),     (s) => corruptClippedViewBox(s, 72, 72),  "Folder is being clipped. Restore the original canvas size.");

// ---- VE wrong_color extras (5) -------------------------------------------
add("ve_056", "very_easy", "wrong_color", () => single("trash"),      (s) => corruptIconColor(s, "#92400e", "#222"), "The trash icon was painted brown. Restore the default black look.");
add("ve_057", "very_easy", "wrong_color", () => single("eye"),        (s) => corruptIconColor(s, "#9ca3af", "#222"), "An all-gray eye icon looks dimmed. Reset to the default black outline.");
add("ve_058", "very_easy", "wrong_color", () => single("face-smile"), (s) => corruptIconColor(s, "#fde047", "#222"), "The smiley face is bright yellow — the default is plain black. Fix it.");
add("ve_059", "very_easy", "wrong_color", () => single("calendar"),   (s) => corruptIconColor(s, "#06b6d4", "#222"), "Cyan calendar is wrong. Restore the default black.");
add("ve_060", "very_easy", "wrong_color", () => single("flag"),       (s) => corruptIconColor(s, "#a855f7", "#222"), "Flag icon turned purple by accident. Reset to the standard black outline.");

// ==========================================================================
// EASY (70)
// ==========================================================================

// ---- EA missing_part (25) ------------------------------------------------
add("ea_001", "easy", "missing_part", scene("house"),    (s) => corruptMissingPart(s, "door"),     "This house has no door. Draw the door back in.");
add("ea_002", "easy", "missing_part", scene("house"),    (s) => corruptMissingPart(s, "window"),   "The house is missing its window. Add it back where it should sit on the wall.");
add("ea_003", "easy", "missing_part", scene("house"),    (s) => corruptMissingPart(s, "chimney"),  "Someone removed the chimney from this house. Put it back on the roof.");
add("ea_004", "easy", "missing_part", scene("house"),    (s) => corruptMissingPart(s, "doorknob"), "The doorknob has fallen off. Restore it to the door.");
add("ea_005", "easy", "missing_part", scene("clock"),    (s) => corruptMissingPart(s, "hour-hand"),   "This clock has no hour hand. Draw it back in.");
add("ea_006", "easy", "missing_part", scene("clock"),    (s) => corruptMissingPart(s, "minute-hand"), "The minute hand is gone. Restore it pointing to its original position.");
add("ea_007", "easy", "missing_part", scene("clock"),    (s) => corruptMissingPart(s, "pivot"),       "The pivot dot at the center is missing. Add it back.");
add("ea_008", "easy", "missing_part", scene("envelope"), (s) => corruptMissingPart(s, "stamp"),       "The stamp peeled off the envelope. Reattach it.");
add("ea_009", "easy", "missing_part", scene("envelope"), (s) => corruptMissingPart(s, "urgent"),      "An urgent-indicator dot used to be here. Add it back.");
add("ea_010", "easy", "missing_part", scene("envelope"), (s) => corruptMissingPart(s, "address"),     "The address line is missing from the envelope. Restore it.");
add("ea_011", "easy", "missing_part", scene("bell"),     (s) => corruptMissingPart(s, "badge"),       "The notification badge has disappeared. Put it back in the corner.");
add("ea_012", "easy", "missing_part", scene("bell"),     (s) => corruptMissingPart(s, "ringer"),      "Bell's ringer is missing. Add it back at the bottom.");
add("ea_013", "easy", "missing_part", scene("bell"),     (s) => corruptMissingPart(s, "badge-count"), "The small white dot inside the badge is gone. Restore it.");
add("ea_014", "easy", "missing_part", scene("face"),     (s) => corruptMissingPart(s, "tear-left"),   "The tear from the left eye is missing. Draw it back.");
add("ea_015", "easy", "missing_part", scene("face"),     (s) => corruptMissingPart(s, "blush-left"),  "Left blush is gone. Restore it.");
add("ea_016", "easy", "missing_part", scene("face"),     (s) => corruptMissingPart(s, "blush-right"), "Right blush has vanished. Add it back.");
add("ea_017", "easy", "missing_part", scene("heart"),    (s) => corruptMissingPart(s, "crack"),       "The crack line on this heart is missing. Put it back.");
add("ea_018", "easy", "missing_part", scene("heart"),    (s) => corruptMissingPart(s, "arrow"),       "Cupid's arrow is gone. Restore the arrow line on the heart.");
add("ea_019", "easy", "missing_part", scene("cart"),     (s) => corruptMissingPart(s, "wheel-left"),  "The cart is missing its left wheel. Add it back.");
add("ea_020", "easy", "missing_part", scene("cart"),     (s) => corruptMissingPart(s, "wheel-right"), "The right wheel fell off the cart. Restore it.");
add("ea_021", "easy", "missing_part", scene("cart"),     (s) => corruptMissingPart(s, "item-1"),      "Item-1 is missing from inside the cart. Put it back.");
add("ea_022", "easy", "missing_part", scene("cart"),     (s) => corruptMissingPart(s, "item-2"),      "Item-2 has disappeared from the basket. Restore it.");
add("ea_023", "easy", "missing_part", scene("pin"),      (s) => corruptMissingPart(s, "pin-dot"),     "The dot on the map pin is missing. Draw it back.");
add("ea_024", "easy", "missing_part", scene("gift"),     (s) => corruptMissingPart(s, "bow-knot"),    "The bow knot on the gift is gone. Add it back to the top of the package.");
add("ea_025", "easy", "missing_part", scene("bulb"),     (s) => corruptMissingPart(s, "filament"),    "The light bulb has no filament. Draw it back inside the bulb.");

// ---- EA extra_part (20) --------------------------------------------------
const extra = (id, type, attrs) => ({ id, type, ...attrs });
add("ea_026", "easy", "extra_part", scene("house"),    (s) => corruptExtraPart(s, extra("stray-dot",    "circle", { cx: 24, cy: 100, r: 4, fill: "#e63946" })), "There's a red dot next to the house that shouldn't be there. Remove it.");
add("ea_027", "easy", "extra_part", scene("house"),    (s) => corruptExtraPart(s, extra("graffiti-bar", "rect",   { x: 40, y: 110, width: 30, height: 4, fill: "#a855f7" })), "Someone tagged the wall with a purple bar. Wipe it off.");
add("ea_028", "easy", "extra_part", scene("clock"),    (s) => corruptExtraPart(s, extra("scribble",     "line",   { x1: 16, y1: 16, x2: 112, y2: 112, stroke: "#e63946", strokeWidth: 2 })), "A red line was scrawled across the clock face. Get rid of it.");
add("ea_029", "easy", "extra_part", scene("clock"),    (s) => corruptExtraPart(s, extra("extra-tick",   "rect",   { x: 100, y: 20, width: 4, height: 6, fill: "#e63946" })), "An extra red tick mark appears near 2 o'clock. Remove it.");
add("ea_030", "easy", "extra_part", scene("envelope"), (s) => corruptExtraPart(s, extra("smudge",       "rect",   { x: 88, y: 88, width: 10, height: 8, fill: "#9ca3af" })), "There's a gray smudge in the bottom right of the envelope. Clean it off.");
add("ea_031", "easy", "extra_part", scene("envelope"), (s) => corruptExtraPart(s, extra("corner-dot",   "circle", { cx: 24, cy: 24, r: 3, fill: "#e63946" })), "A small red dot in the top-left corner is unwanted. Remove it.");
add("ea_032", "easy", "extra_part", scene("bell"),     (s) => corruptExtraPart(s, extra("blue-scribble","line",   { x1: 30, y1: 30, x2: 60, y2: 50, stroke: "#3b82f6", strokeWidth: 2 })), "A blue diagonal scribble appears on the bell. Delete it.");
add("ea_033", "easy", "extra_part", scene("bell"),     (s) => corruptExtraPart(s, extra("baseline",     "line",   { x1: 16, y1: 120, x2: 112, y2: 120, stroke: "#222", strokeWidth: 2 })), "There's an unwanted horizontal line at the bottom. Remove it.");
add("ea_034", "easy", "extra_part", scene("face"),     (s) => corruptExtraPart(s, extra("third-eye",    "circle", { cx: 64, cy: 38, r: 4, fill: "#222" })), "There's an extra dot above the face's eyes that shouldn't be there. Remove it.");
add("ea_035", "easy", "extra_part", scene("face"),     (s) => corruptExtraPart(s, extra("mole",         "circle", { cx: 88, cy: 86, r: 2, fill: "#222" })), "A small dot on the cheek looks like an unintentional mark. Erase it.");
add("ea_036", "easy", "extra_part", scene("heart"),    (s) => corruptExtraPart(s, extra("strike",       "line",   { x1: 24, y1: 24, x2: 104, y2: 104, stroke: "#222", strokeWidth: 2 })), "There's a diagonal strike-through across the heart. Remove it.");
add("ea_037", "easy", "extra_part", scene("heart"),    (s) => corruptExtraPart(s, extra("stray-yellow", "circle", { cx: 100, cy: 24, r: 3, fill: "#fde047" })), "A yellow dot in the corner doesn't belong here. Delete it.");
add("ea_038", "easy", "extra_part", scene("cart"),     (s) => corruptExtraPart(s, extra("purple-square","rect",   { x: 90, y: 30, width: 8, height: 8, fill: "#a855f7" })), "A small purple square hovers above the cart. Remove it.");
add("ea_039", "easy", "extra_part", scene("cart"),     (s) => corruptExtraPart(s, extra("extra-handle", "line",   { x1: 30, y1: 30, x2: 50, y2: 50, stroke: "#92400e", strokeWidth: 3 })), "An extra brown handle was added to the cart. Get rid of it.");
add("ea_040", "easy", "extra_part", scene("pin"),      (s) => corruptExtraPart(s, extra("yellow-dot",   "circle", { cx: 30, cy: 30, r: 5, fill: "#fde047" })), "There's a yellow dot in the corner of the map pin. Remove it.");
add("ea_041", "easy", "extra_part", scene("gift"),     (s) => corruptExtraPart(s, extra("red-baseline","line",    { x1: 20, y1: 110, x2: 108, y2: 110, stroke: "#e63946", strokeWidth: 2 })), "A red baseline appeared below the gift. Erase it.");
add("ea_042", "easy", "extra_part", scene("flag"),     (s) => corruptExtraPart(s, extra("gray-smudge","circle",   { cx: 96, cy: 80, r: 4, fill: "#9ca3af" })), "There's a gray blob to the right of the flag. Clean it off.");
add("ea_043", "easy", "extra_part", scene("bulb"),     (s) => corruptExtraPart(s, extra("blue-dot",   "circle",   { cx: 40, cy: 110, r: 3, fill: "#3b82f6" })), "A blue dot below the bulb doesn't belong. Remove it.");
add("ea_044", "easy", "extra_part", scene("cog"),      (s) => corruptExtraPart(s, extra("green-square","rect",    { x: 100, y: 100, width: 10, height: 10, fill: "#22c55e" })), "A green square is stuck in the corner. Get rid of it.");
add("ea_045", "easy", "extra_part", scene("bulb"),     (s) => corruptExtraPart(s, extra("corner-line","line",     { x1: 16, y1: 16, x2: 30, y2: 30, stroke: "#222", strokeWidth: 1 })), "A short black line appeared in the upper-left. Remove it.");

// ---- EA miscolor_part (15) -----------------------------------------------
add("ea_046", "easy", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "door",         "#3b82f6"), "The door has been repainted blue. Restore its original brown color.");
add("ea_047", "easy", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "window",       "#e63946"), "Someone painted the window red. Set it back to its original blue.");
add("ea_048", "easy", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "chimney",      "#22c55e"), "The chimney is green here — it should be dark brown. Fix it.");
add("ea_049", "easy", "miscolor_part", scene("envelope"), (s) => corruptMiscolorPart(s, "stamp",        "#22c55e"), "The stamp's color is wrong (green). Restore the original red.");
add("ea_050", "easy", "miscolor_part", scene("envelope"), (s) => corruptMiscolorPart(s, "urgent",       "#fde047"), "Urgent dot is yellow, but it should be the alarming red. Fix it.");
add("ea_051", "easy", "miscolor_part", scene("bell"),     (s) => corruptMiscolorPart(s, "badge",        "#3b82f6"), "The notification badge is blue — it should be red. Repaint it.");
add("ea_052", "easy", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "tear-left",    "#22c55e"), "The tear-line is green, which is odd. Restore the original blue.");
add("ea_053", "easy", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "blush-left",   "#3b82f6"), "Left blush is blue. Fix it back to its original pink.");
add("ea_054", "easy", "miscolor_part", scene("heart"),    (s) => corruptMiscolorPart(s, "crack",        "#e63946"), "The crack line on the heart got recolored red. Set it back to black.");
add("ea_055", "easy", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "item-1",       "#e63946"), "Item-1 inside the cart is the wrong color (red). Restore the original blue.");
add("ea_056", "easy", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "item-2",       "#a855f7"), "Item-2 is purple — wrong. Set it back to its original yellow.");
add("ea_057", "easy", "miscolor_part", scene("pin"),      (s) => corruptMiscolorPart(s, "pin-dot",      "#3b82f6"), "The pin-dot was recolored blue. Restore its original red.");
add("ea_058", "easy", "miscolor_part", scene("gift"),     (s) => corruptMiscolorPart(s, "bow-knot",     "#22c55e"), "The bow knot is green, which is wrong. Repaint it to the original yellow.");
add("ea_059", "easy", "miscolor_part", scene("cog"),      (s) => corruptMiscolorPart(s, "center-dot",   "#3b82f6"), "The center dot of the cog is blue. Set it back to its original red.");
add("ea_060", "easy", "miscolor_part", scene("bulb"),     (s) => corruptMiscolorPart(s, "halo",         "#3b82f6"), "The bulb's halo is blue. Restore the original yellow glow.");

// ---- EA displaced_part (10) ----------------------------------------------
add("ea_061", "easy", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "door",        { dx:  20, dy:   0 }), "The door slid 20px to the right and is now off the wall. Slide it back to its original position.");
add("ea_062", "easy", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "window",      { dx:  24, dy:   0 }), "The window has drifted to the right side of the wall. Restore it to its original position.");
add("ea_063", "easy", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "minute-hand", { dx:   0, dy: -24 }), "The minute hand has rotated up — it should be pointing right. Restore it.");
add("ea_064", "easy", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "stamp",       { dx: -20, dy:   0 }), "The stamp slid to the left side of the envelope. Move it back to the top-right.");
add("ea_065", "easy", "displaced_part", scene("bell"),     (s) => corruptDisplacedPart(s, "badge",       { dx:   0, dy:  20 }), "The badge fell down below the bell. Put it back at the top.");
add("ea_066", "easy", "displaced_part", scene("face"),     (s) => corruptDisplacedPart(s, "blush-right", { dx:   0, dy: -20 }), "The right blush floated up onto the forehead. Slide it back down.");
add("ea_067", "easy", "displaced_part", scene("cart"),     (s) => corruptDisplacedPart(s, "wheel-left",  { dx: -16, dy:   4 }), "The left wheel rolled off-track. Restore it under the basket.");
add("ea_068", "easy", "displaced_part", scene("pin"),      (s) => corruptDisplacedPart(s, "shadow",      { dx:  20, dy:   0 }), "The ground shadow slid to the right. Center it under the pin again.");
add("ea_069", "easy", "displaced_part", scene("gift"),     (s) => corruptDisplacedPart(s, "bow-knot",    { dx:  20, dy:   0 }), "The bow knot drifted to the right edge of the gift. Center it back on top.");
add("ea_070", "easy", "displaced_part", scene("flag"),     (s) => corruptDisplacedPart(s, "pole-tip",    { dx:   0, dy:  16 }), "The pole-tip slid down the pole. Put it back at the very top.");

// ==========================================================================
// MEDIUM (80)
// ==========================================================================

// ---- ME displaced_part (20) — subtler offsets (~6-14px) -----------------
add("me_001", "medium", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "door",        { dx:   6, dy:  0 }), "The door has shifted slightly to the right. Nudge it back to its exact original spot.");
add("me_002", "medium", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "window",      { dx:  -8, dy:  0 }), "The window has moved a touch to the left. Restore the precise original position.");
add("me_003", "medium", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "chimney",     { dx:   0, dy:  8 }), "The chimney sank a few pixels. Raise it back up.");
add("me_004", "medium", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "doorknob",    { dx:   4, dy:  0 }), "The doorknob shifted slightly off the door. Restore it.");
add("me_005", "medium", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "hour-hand",   { dx:   6, dy:  0 }), "The tip of the hour hand drifted right. Set it back to its original angle.");
add("me_006", "medium", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "minute-hand", { dx:   0, dy:  6 }), "The minute hand dropped slightly. Restore it pointing horizontally.");
add("me_007", "medium", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "pivot",       { dx:   3, dy:  3 }), "The pivot is just a few pixels off-center. Restore it to the exact center of the clock face.");
add("me_008", "medium", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "stamp",       { dx:   0, dy:  8 }), "The stamp slid down a bit. Move it back to its original spot in the top-right.");
add("me_009", "medium", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "urgent",      { dx:   8, dy:  0 }), "The urgent dot drifted to the right. Pull it back to its original position.");
add("me_010", "medium", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "address",     { dx:   0, dy:  6 }), "The address line dropped a few pixels. Restore the original y position.");
add("me_011", "medium", "displaced_part", scene("bell"),     (s) => corruptDisplacedPart(s, "ringer",      { dx:  -6, dy:  0 }), "The ringer is slightly off-center to the left. Restore its alignment under the bell.");
add("me_012", "medium", "displaced_part", scene("bell"),     (s) => corruptDisplacedPart(s, "badge",       { dx:  -8, dy:  4 }), "The badge slipped a bit down and left. Restore it to its proper corner spot.");
add("me_013", "medium", "displaced_part", scene("face"),     (s) => corruptDisplacedPart(s, "blush-left",  { dx:   6, dy:  0 }), "The left blush drifted slightly right. Move it back to its original spot.");
add("me_014", "medium", "displaced_part", scene("face"),     (s) => corruptDisplacedPart(s, "blush-right", { dx:  -6, dy:  0 }), "The right blush drifted slightly left. Restore the exact original position.");
add("me_015", "medium", "displaced_part", scene("face"),     (s) => corruptDisplacedPart(s, "tear-left",   { dx:   0, dy:  6 }), "The tear has slid down the cheek by a few pixels. Restore it to its starting position.");
add("me_016", "medium", "displaced_part", scene("cart"),     (s) => corruptDisplacedPart(s, "wheel-left",  { dx:  -6, dy:  3 }), "The left wheel rolled slightly off. Restore it precisely under the cart.");
add("me_017", "medium", "displaced_part", scene("cart"),     (s) => corruptDisplacedPart(s, "wheel-right", { dx:   6, dy:  3 }), "The right wheel rolled out a bit. Restore it under the basket.");
add("me_018", "medium", "displaced_part", scene("cart"),     (s) => corruptDisplacedPart(s, "item-1",      { dx:   8, dy:  0 }), "Item-1 inside the cart slid sideways. Restore its original position.");
add("me_019", "medium", "displaced_part", scene("gift"),     (s) => corruptDisplacedPart(s, "bow-knot",    { dx:   6, dy:  0 }), "The bow knot is slightly off-center. Restore it to the exact center.");
add("me_020", "medium", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "hour-hand",   { dx:   0, dy:  8 }), "The hour-hand's tip sagged downward a few pixels. Restore the original angle.");

// ---- ME miscolor_part (20) — smaller / similar colors -------------------
add("me_021", "medium", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "doorknob",      "#3b82f6"), "The little doorknob is blue. Restore the original yellow.");
add("me_022", "medium", "miscolor_part", scene("clock"),    (s) => corruptMiscolorPart(s, "pivot",         "#3b82f6"), "The pivot dot turned blue. Reset to its original red.");
add("me_023", "medium", "miscolor_part", scene("clock"),    (s) => corruptMiscolorPart(s, "hour-hand",     "#e63946"), "The hour hand was recolored red. Set its stroke back to the default black.");
add("me_024", "medium", "miscolor_part", scene("clock"),    (s) => corruptMiscolorPart(s, "minute-hand",   "#3b82f6"), "The minute hand turned blue. Restore the original black stroke.");
add("me_025", "medium", "miscolor_part", scene("envelope"), (s) => corruptMiscolorPart(s, "address",       "#e63946"), "The address line is red. Restore the original black stroke.");
add("me_026", "medium", "miscolor_part", scene("bell"),     (s) => corruptMiscolorPart(s, "ringer",        "#a855f7"), "The ringer is purple. Set it back to the default black.");
add("me_027", "medium", "miscolor_part", scene("bell"),     (s) => corruptMiscolorPart(s, "badge-count",   "#e63946"), "The badge-count dot is red. Restore the original white center.");
add("me_028", "medium", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "blush-right",   "#22c55e"), "The right blush turned green. Restore the original pink.");
add("me_029", "medium", "miscolor_part", scene("heart"),    (s) => corruptMiscolorPart(s, "arrow",         "#22c55e"), "The arrow on the heart is green. Restore the original brown.");
add("me_030", "medium", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "wheel-left",    "#3b82f6"), "Left wheel was painted blue. Set it back to its default black.");
add("me_031", "medium", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "wheel-right",   "#e63946"), "Right wheel is red. Restore its original black.");
add("me_032", "medium", "miscolor_part", scene("pin"),      (s) => corruptMiscolorPart(s, "shadow",        "#a855f7"), "The shadow is purple, which is wrong. Restore the original near-black shadow.");
add("me_033", "medium", "miscolor_part", scene("gift"),     (s) => corruptMiscolorPart(s, "bow-left",      "#3b82f6"), "Left bow is blue. Restore the original red.");
add("me_034", "medium", "miscolor_part", scene("gift"),     (s) => corruptMiscolorPart(s, "bow-right",     "#22c55e"), "Right bow is green. Restore the original red.");
add("me_035", "medium", "miscolor_part", scene("flag"),     (s) => corruptMiscolorPart(s, "pole-tip",      "#e63946"), "Pole-tip is red. Restore the original yellow.");
add("me_036", "medium", "miscolor_part", scene("flag"),     (s) => corruptMiscolorPart(s, "windline",      "#22c55e"), "The windline got recolored green. Restore the original blue stroke.");
add("me_037", "medium", "miscolor_part", scene("bulb"),     (s) => corruptMiscolorPart(s, "filament",      "#3b82f6"), "Filament turned blue. Set it back to its default orange.");
add("me_038", "medium", "miscolor_part", scene("cog"),      (s) => corruptMiscolorPart(s, "center-dot",    "#22c55e"), "The center dot is green. Restore the original red.");
add("me_039", "medium", "miscolor_part", scene("cog"),      (s) => corruptMiscolorPart(s, "rotation-arrow","#e63946"), "The rotation arrow turned red. Set its stroke back to the default blue.");
add("me_040", "medium", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "tear-left",     "#a855f7"), "The tear-line is purple. Restore the original blue.");

// ---- ME missing_part (15) — smaller / less obvious parts ---------------
add("me_041", "medium", "missing_part", scene("clock"),    (s) => corruptMissingPart(s, "pivot"),         "The tiny pivot at the center of the clock is gone. Add it back.");
add("me_042", "medium", "missing_part", scene("bell"),     (s) => corruptMissingPart(s, "badge-count"),   "The little white center of the badge is missing. Restore it.");
add("me_043", "medium", "missing_part", scene("envelope"), (s) => corruptMissingPart(s, "urgent"),        "The urgent indicator dot is gone. Restore it on the envelope.");
add("me_044", "medium", "missing_part", scene("house"),    (s) => corruptMissingPart(s, "doorknob"),      "The doorknob is missing from the door. Add it back.");
add("me_045", "medium", "missing_part", scene("pin"),      (s) => corruptMissingPart(s, "shadow"),        "The pin lost its ground shadow. Restore it.");
add("me_046", "medium", "missing_part", scene("face"),     (s) => corruptMissingPart(s, "blush-left"),    "The left blush has been removed. Add it back.");
add("me_047", "medium", "missing_part", scene("face"),     (s) => corruptMissingPart(s, "blush-right"),   "The right blush is missing. Restore it.");
add("me_048", "medium", "missing_part", scene("cog"),      (s) => corruptMissingPart(s, "center-dot"),    "The center marker on the cog is gone. Put it back.");
add("me_049", "medium", "missing_part", scene("cog"),      (s) => corruptMissingPart(s, "rotation-arrow"),"The rotation arrow has disappeared from the cog. Restore it.");
add("me_050", "medium", "missing_part", scene("gift"),     (s) => corruptMissingPart(s, "bow-left"),      "The left bow loop is gone. Add it back.");
add("me_051", "medium", "missing_part", scene("gift"),     (s) => corruptMissingPart(s, "bow-right"),     "The right bow loop is missing. Restore it.");
add("me_052", "medium", "missing_part", scene("flag"),     (s) => corruptMissingPart(s, "windline"),      "The windline on the flag is gone. Add it back to the right of the banner.");
add("me_053", "medium", "missing_part", scene("flag"),     (s) => corruptMissingPart(s, "pole-tip"),      "The yellow ball on top of the pole is missing. Restore it.");
add("me_054", "medium", "missing_part", scene("bulb"),     (s) => corruptMissingPart(s, "halo"),          "The glow halo around the bulb is missing. Restore it.");
add("me_055", "medium", "missing_part", scene("heart"),    (s) => corruptMissingPart(s, "arrow"),         "Cupid's arrow has been removed. Restore it.");

// ---- ME extra_part (15) — subtler extras --------------------------------
add("me_056", "medium", "extra_part", scene("house"),    (s) => corruptExtraPart(s, extra("smudge",      "circle", { cx: 100, cy: 110, r: 2, fill: "#9ca3af" })), "A small gray dot appeared near the bottom-right of the house. Remove it.");
add("me_057", "medium", "extra_part", scene("clock"),    (s) => corruptExtraPart(s, extra("tiny-tick",   "rect",   { x: 62, y: 110, width: 4, height: 4, fill: "#222" })), "An extra small tick mark was added at the 6 position. Remove it.");
add("me_058", "medium", "extra_part", scene("envelope"), (s) => corruptExtraPart(s, extra("stray-dot",   "circle", { cx: 64, cy: 64, r: 2, fill: "#e63946" })), "A small red dot in the middle of the envelope is unwanted. Remove it.");
add("me_059", "medium", "extra_part", scene("bell"),     (s) => corruptExtraPart(s, extra("clapper-dup", "circle", { cx: 56, cy: 112, r: 2, fill: "#222" })), "There's an extra small dot next to the ringer. Get rid of it.");
add("me_060", "medium", "extra_part", scene("face"),     (s) => corruptExtraPart(s, extra("pimple",      "circle", { cx: 70, cy: 90, r: 2, fill: "#222" })), "There's a tiny dot below the mouth that shouldn't be there. Erase it.");
add("me_061", "medium", "extra_part", scene("heart"),    (s) => corruptExtraPart(s, extra("micro-dot",   "circle", { cx: 64, cy: 70, r: 2, fill: "#fde047" })), "A small yellow speck appeared on the heart. Remove it.");
add("me_062", "medium", "extra_part", scene("cart"),     (s) => corruptExtraPart(s, extra("pebble",      "circle", { cx: 70, cy: 116, r: 2, fill: "#9ca3af" })), "A gray pebble appeared under the cart. Clean it off.");
add("me_063", "medium", "extra_part", scene("pin"),      (s) => corruptExtraPart(s, extra("micro-mark",  "rect",   { x: 60, y: 96, width: 4, height: 4, fill: "#e63946" })), "An extra small red square appeared on the pin's stem. Delete it.");
add("me_064", "medium", "extra_part", scene("gift"),     (s) => corruptExtraPart(s, extra("scratch",     "line",   { x1: 30, y1: 50, x2: 50, y2: 60, stroke: "#222", strokeWidth: 1 })), "There's a scratch line on the gift box. Remove it.");
add("me_065", "medium", "extra_part", scene("flag"),     (s) => corruptExtraPart(s, extra("ant",         "circle", { cx: 64, cy: 112, r: 1.5, fill: "#222" })), "A tiny dot appeared near the bottom of the pole. Remove it.");
add("me_066", "medium", "extra_part", scene("bulb"),     (s) => corruptExtraPart(s, extra("crack-line",  "line",   { x1: 56, y1: 80, x2: 70, y2: 80, stroke: "#222", strokeWidth: 1 })), "A horizontal line was drawn across the bulb. Erase it.");
add("me_067", "medium", "extra_part", scene("cog"),      (s) => corruptExtraPart(s, extra("notch-dot",   "circle", { cx: 110, cy: 64, r: 1.5, fill: "#222" })), "There's a small extra dot at the cog's right edge. Remove it.");
add("me_068", "medium", "extra_part", scene("house"),    (s) => corruptExtraPart(s, extra("smoke-dot",   "circle", { cx: 90, cy: 22, r: 2, fill: "#9ca3af" })), "A gray smoke speck above the chimney shouldn't be there. Clean it up.");
add("me_069", "medium", "extra_part", scene("envelope"), (s) => corruptExtraPart(s, extra("wax-flake",   "circle", { cx: 80, cy: 60, r: 2, fill: "#e63946" })), "A small red speck appeared near the address. Remove it.");
add("me_070", "medium", "extra_part", scene("face"),     (s) => corruptExtraPart(s, extra("pimple-2",    "circle", { cx: 60, cy: 92, r: 2, fill: "#222" })), "A small dot near the right side of the mouth shouldn't be there. Erase it.");

// ---- ME duplicate_part (10) ---------------------------------------------
add("me_071", "medium", "duplicate_part", scene("house"),    (s) => corruptDuplicatePart(s, "door",        { dx: 16, dy: 0 }), "This house has two doors of identical color. Remove the duplicate.");
add("me_072", "medium", "duplicate_part", scene("house"),    (s) => corruptDuplicatePart(s, "window",      { dx: 24, dy: 0 }), "There are two windows where there should be one. Delete the duplicate.");
add("me_073", "medium", "duplicate_part", scene("clock"),    (s) => corruptDuplicatePart(s, "hour-hand",   { dx: 12, dy: 0 }), "Two hour hands point from the center. Remove the duplicate.");
add("me_074", "medium", "duplicate_part", scene("envelope"), (s) => corruptDuplicatePart(s, "stamp",       { dx: -20,dy: 0 }), "There are two stamps on the envelope. Remove the extra one.");
add("me_075", "medium", "duplicate_part", scene("bell"),     (s) => corruptDuplicatePart(s, "badge",       { dx: -20,dy: 0 }), "Two notification badges appear on the bell. Delete the duplicate.");
add("me_076", "medium", "duplicate_part", scene("face"),     (s) => corruptDuplicatePart(s, "blush-left",  { dx: -10,dy: 0 }), "There are two left-side blushes. Get rid of the duplicate.");
add("me_077", "medium", "duplicate_part", scene("cart"),     (s) => corruptDuplicatePart(s, "item-1",      { dx: -12,dy: 0 }), "Item-1 has been duplicated inside the cart. Remove the copy.");
add("me_078", "medium", "duplicate_part", scene("gift"),     (s) => corruptDuplicatePart(s, "bow-knot",    { dx:  12,dy: 0 }), "Two bow knots sit on top of the gift. Remove the duplicate.");
add("me_079", "medium", "duplicate_part", scene("pin"),      (s) => corruptDuplicatePart(s, "pin-dot",     { dx:  10,dy: 0 }), "Two dots are on the head of the pin. Delete the duplicate.");
add("me_080", "medium", "duplicate_part", scene("cog"),      (s) => corruptDuplicatePart(s, "center-dot",  { dx:  10,dy: 0 }), "There are two center dots on the cog. Get rid of the duplicate.");

// ==========================================================================
// HARD (60)
// ==========================================================================

// ---- HA multi-corruption (15) — two simultaneous issues -----------------
const m = (...ops) => (s) => corruptMulti(s, ops);

add("ha_001", "hard", "multi", scene("house"), m(
    (s) => corruptMissingPart(s, "door"),
    (s) => corruptMiscolorPart(s, "window", "#e63946"),
  ), "Two things are wrong with this house: the door is missing AND the window is the wrong color. Fix both.");
add("ha_002", "hard", "multi", scene("house"), m(
    (s) => corruptDisplacedPart(s, "chimney", { dx: 0, dy: 14 }),
    (s) => corruptExtraPart(s, extra("stray-dot", "circle", { cx: 24, cy: 100, r: 4, fill: "#e63946" })),
  ), "The chimney sagged AND there's a stray red dot next to the house. Repair both defects.");
add("ha_003", "hard", "multi", scene("clock"), m(
    (s) => corruptMissingPart(s, "hour-hand"),
    (s) => corruptMissingPart(s, "minute-hand"),
  ), "The clock has lost both its hands. Restore them to point to their original positions.");
add("ha_004", "hard", "multi", scene("clock"), m(
    (s) => corruptDisplacedPart(s, "hour-hand", { dx: 6, dy: 0 }),
    (s) => corruptDisplacedPart(s, "minute-hand", { dx: 0, dy: 6 }),
  ), "Both clock hands have drifted slightly. Restore each to its original angle.");
add("ha_005", "hard", "multi", scene("envelope"), m(
    (s) => corruptMissingPart(s, "stamp"),
    (s) => corruptMiscolorPart(s, "urgent", "#fde047"),
  ), "The stamp is missing AND the urgent dot was recolored yellow. Fix both.");
add("ha_006", "hard", "multi", scene("bell"), m(
    (s) => corruptDisplacedPart(s, "badge", { dx: -10, dy: 6 }),
    (s) => corruptMiscolorPart(s, "badge-count", "#e63946"),
  ), "The badge has shifted down-left AND its inner dot is the wrong color. Restore both.");
add("ha_007", "hard", "multi", scene("face"), m(
    (s) => corruptMissingPart(s, "tear-left"),
    (s) => corruptMissingPart(s, "blush-left"),
  ), "Two things are missing from the face: the tear AND the left blush. Add both back.");
add("ha_008", "hard", "multi", scene("face"), m(
    (s) => corruptMiscolorPart(s, "blush-left", "#22c55e"),
    (s) => corruptMiscolorPart(s, "blush-right", "#22c55e"),
  ), "Both blushes turned green. Restore them to their original pink.");
add("ha_009", "hard", "multi", scene("heart"), m(
    (s) => corruptMissingPart(s, "crack"),
    (s) => corruptMiscolorPart(s, "arrow", "#22c55e"),
  ), "The crack line is missing AND the arrow is the wrong color. Repair both.");
add("ha_010", "hard", "multi", scene("cart"), m(
    (s) => corruptMissingPart(s, "wheel-left"),
    (s) => corruptDisplacedPart(s, "wheel-right", { dx: 8, dy: 4 }),
  ), "The left wheel is gone AND the right wheel rolled out of place. Fix both.");
add("ha_011", "hard", "multi", scene("cart"), m(
    (s) => corruptMiscolorPart(s, "item-1", "#a855f7"),
    (s) => corruptMiscolorPart(s, "item-2", "#a855f7"),
  ), "Both items in the cart turned purple. Restore each to its original color.");
add("ha_012", "hard", "multi", scene("pin"), m(
    (s) => corruptMiscolorPart(s, "pin-dot", "#3b82f6"),
    (s) => corruptDisplacedPart(s, "shadow", { dx: 16, dy: 0 }),
  ), "The pin-dot was recolored AND the shadow drifted. Restore both.");
add("ha_013", "hard", "multi", scene("gift"), m(
    (s) => corruptMissingPart(s, "bow-left"),
    (s) => corruptMissingPart(s, "bow-right"),
  ), "Both side bows are missing from the gift. Restore them.");
add("ha_014", "hard", "multi", scene("bulb"), m(
    (s) => corruptMissingPart(s, "halo"),
    (s) => corruptMiscolorPart(s, "filament", "#3b82f6"),
  ), "The bulb's halo is gone AND the filament's stroke is the wrong color. Fix both.");
add("ha_015", "hard", "multi", scene("cog"), m(
    (s) => corruptDisplacedPart(s, "center-dot", { dx: 4, dy: 4 }),
    (s) => corruptMiscolorPart(s, "rotation-arrow", "#e63946"),
  ), "The center dot drifted slightly AND the rotation arrow is the wrong color. Repair both.");

// ---- HA flipped_part (15) ------------------------------------------------
add("ha_016", "hard", "flipped_part", scene("heart"),  (s) => corruptFlippedPart(s, "crack"),         "The crack line has been mirrored. Flip it back to its original orientation.");
add("ha_017", "hard", "flipped_part", scene("face"),   (s) => corruptFlippedPart(s, "tear-left"),     "The tear line was reversed. Restore the original direction.");
add("ha_018", "hard", "flipped_part", scene("clock"),  (s) => corruptFlippedPart(s, "hour-hand"),     "The hour hand's stroke has been horizontally mirrored. Flip it back.");
add("ha_019", "hard", "flipped_part", scene("clock"),  (s) => corruptFlippedPart(s, "minute-hand"),   "The minute hand was reversed. Restore its original direction.");
add("ha_020", "hard", "flipped_part", scene("envelope"),(s) => corruptFlippedPart(s, "address"),      "The address line is mirrored. Restore it.");
add("ha_021", "hard", "flipped_part", scene("flag"),   (s) => corruptFlippedPart(s, "windline"),      "The windline has been horizontally reversed. Flip it back.");
add("ha_022", "hard", "flipped_part", scene("bulb"),   (s) => corruptFlippedPart(s, "filament"),      "The filament zigzag was mirrored. Restore the original direction.");
add("ha_023", "hard", "flipped_part", scene("cog"),    (s) => corruptFlippedPart(s, "rotation-arrow"),"The rotation arrow points the wrong way. Mirror it back.");
add("ha_024", "hard", "flipped_part", scene("face"),   (s) => corruptFlippedPart(s, "tear-left"),     "The tear was mirrored — its hook points the wrong way. Flip it back.");
add("ha_025", "hard", "flipped_part", scene("heart"),  (s) => corruptFlippedPart(s, "arrow"),         "The arrow line on the heart was reversed. Restore the original direction.");
add("ha_026", "hard", "flipped_part", scene("bell"),   (s) => corruptFlippedPart(s, "ringer"),        "The ringer (a single dot) wasn't actually flippable — author note: the polygon was reversed elsewhere; restore everything to the clean state.");
add("ha_027", "hard", "flipped_part", scene("envelope"),(s) => corruptFlippedPart(s, "address"),      "The address line is reversed left-to-right. Flip it back.");
add("ha_028", "hard", "flipped_part", scene("clock"),  (s) => corruptFlippedPart(s, "minute-hand"),   "Minute hand got mirrored. Restore its original orientation.");
add("ha_029", "hard", "flipped_part", scene("cog"),    (s) => corruptFlippedPart(s, "rotation-arrow"),"The cog's rotation arrow has been mirrored. Flip it back to point the original way.");
add("ha_030", "hard", "flipped_part", scene("flag"),   (s) => corruptFlippedPart(s, "windline"),      "The wind-indicator polyline is reversed. Restore the original orientation.");

// ---- HA very subtle displaced_part (15) — 2-5px offsets ----------------
add("ha_031", "hard", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "door",        { dx: 3, dy: 0 }), "The door is just 3px off to the right. Restore the exact original position.");
add("ha_032", "hard", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "window",      { dx: 0, dy: 3 }), "The window has sunk a few pixels. Restore the precise original y.");
add("ha_033", "hard", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "doorknob",    { dx: -2, dy: 0 }), "The doorknob is 2px to the left of where it should be. Fix it.");
add("ha_034", "hard", "displaced_part", scene("house"),    (s) => corruptDisplacedPart(s, "chimney",     { dx: 4, dy: 0 }), "The chimney slid 4px to the right. Restore the original alignment.");
add("ha_035", "hard", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "hour-hand",   { dx: 3, dy: 0 }), "The hour hand's tip is barely off — 3px right. Restore it exactly.");
add("ha_036", "hard", "displaced_part", scene("clock"),    (s) => corruptDisplacedPart(s, "pivot",       { dx: 2, dy: 2 }), "The pivot is 2px off from center. Restore it to the exact center of the face.");
add("ha_037", "hard", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "urgent",      { dx: 3, dy: 0 }), "The urgent dot is 3px off to the right. Restore it.");
add("ha_038", "hard", "displaced_part", scene("envelope"), (s) => corruptDisplacedPart(s, "stamp",       { dx: 0, dy: 3 }), "The stamp dropped 3px. Move it back to its precise position.");
add("ha_039", "hard", "displaced_part", scene("bell"),     (s) => corruptDisplacedPart(s, "badge",       { dx: -3, dy: 0 }), "The badge is 3px to the left of its intended spot. Fix it.");
add("ha_040", "hard", "displaced_part", scene("face"),     (s) => corruptDisplacedPart(s, "blush-left",  { dx: 3, dy: 0 }), "Left blush is 3px to the right. Restore the precise original position.");
add("ha_041", "hard", "displaced_part", scene("cart"),     (s) => corruptDisplacedPart(s, "wheel-left",  { dx: -3, dy: 0 }), "Left wheel is 3px off-track. Restore it.");
add("ha_042", "hard", "displaced_part", scene("pin"),      (s) => corruptDisplacedPart(s, "pin-dot",     { dx: 0, dy: 4 }), "The pin-dot dropped a few pixels. Restore it.");
add("ha_043", "hard", "displaced_part", scene("gift"),     (s) => corruptDisplacedPart(s, "bow-knot",    { dx: 3, dy: 0 }), "The bow knot is 3px off-center. Restore it.");
add("ha_044", "hard", "displaced_part", scene("flag"),     (s) => corruptDisplacedPart(s, "pole-tip",    { dx: 0, dy: 4 }), "The pole-tip slipped 4px down. Restore it to the very top.");
add("ha_045", "hard", "displaced_part", scene("cog"),      (s) => corruptDisplacedPart(s, "center-dot",  { dx: 2, dy: 2 }), "The center dot is 2px off-center. Fix it.");

// ---- HA very close miscolor_part (15) ----------------------------------
add("ha_046", "hard", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "door",         "#7a4624"), "The door is a slightly wrong shade of brown. Restore the original #6a3819.");
add("ha_047", "hard", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "window",       "#84b8ef"), "The window's blue tint is wrong. Restore the original #94c8ff.");
add("ha_048", "hard", "miscolor_part", scene("house"),    (s) => corruptMiscolorPart(s, "chimney",      "#502820"), "The chimney's brown is too dark. Restore the original #603020.");
add("ha_049", "hard", "miscolor_part", scene("clock"),    (s) => corruptMiscolorPart(s, "pivot",        "#c63036"), "The pivot's red is slightly off. Restore the exact #e63946.");
add("ha_050", "hard", "miscolor_part", scene("envelope"), (s) => corruptMiscolorPart(s, "stamp",        "#d62936"), "The stamp's red drifted. Restore the exact original red (#e63946).");
add("ha_051", "hard", "miscolor_part", scene("bell"),     (s) => corruptMiscolorPart(s, "badge",        "#d33036"), "The notification badge red is a tone off. Restore the exact #e63946.");
add("ha_052", "hard", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "blush-left",   "#fa94a0"), "The left blush pink is slightly off. Restore the exact #fda4af.");
add("ha_053", "hard", "miscolor_part", scene("face"),     (s) => corruptMiscolorPart(s, "blush-right",  "#fa94a0"), "Right blush pink is slightly off. Restore the exact #fda4af.");
add("ha_054", "hard", "miscolor_part", scene("heart"),    (s) => corruptMiscolorPart(s, "crack",        "#1a1a1a"), "The crack line's black is slightly darker than the spec. Restore the exact #222.");
add("ha_055", "hard", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "item-1",       "#2c70ec"), "Item-1's blue is slightly off. Restore the exact #3b82f6.");
add("ha_056", "hard", "miscolor_part", scene("cart"),     (s) => corruptMiscolorPart(s, "item-2",       "#fcc340"), "Item-2's yellow is a tone off. Restore the exact #fde047.");
add("ha_057", "hard", "miscolor_part", scene("gift"),     (s) => corruptMiscolorPart(s, "bow-knot",     "#fcc340"), "The bow knot yellow is slightly off. Restore the exact #fde047.");
add("ha_058", "hard", "miscolor_part", scene("flag"),     (s) => corruptMiscolorPart(s, "pole-tip",     "#fcc340"), "Pole-tip yellow is slightly off. Restore the exact #fde047.");
add("ha_059", "hard", "miscolor_part", scene("bulb"),     (s) => corruptMiscolorPart(s, "filament",     "#ee6608"), "The filament's orange is a touch off. Restore the exact #f97316.");
add("ha_060", "hard", "miscolor_part", scene("cog"),      (s) => corruptMiscolorPart(s, "center-dot",   "#d33036"), "The center dot's red is slightly off. Restore the exact #e63946.");

// ==========================================================================
// VERY HARD (30)
// ==========================================================================

// ---- VH three-issue multi-corruption (15) -------------------------------
add("vh_001", "very_hard", "multi", scene("house"), m(
    (s) => corruptMissingPart(s, "door"),
    (s) => corruptMiscolorPart(s, "window", "#e63946"),
    (s) => corruptDisplacedPart(s, "chimney", { dx: 0, dy: 8 }),
  ), "Three things are wrong with this house: the door is missing, the window is the wrong color, AND the chimney has sagged. Fix all three.");
add("vh_002", "very_hard", "multi", scene("house"), m(
    (s) => corruptMissingPart(s, "doorknob"),
    (s) => corruptDisplacedPart(s, "window", { dx: 6, dy: 0 }),
    (s) => corruptExtraPart(s, extra("stray", "circle", { cx: 24, cy: 22, r: 3, fill: "#22c55e" })),
  ), "Three issues: doorknob is gone, window has shifted right, AND there's a stray green dot in the corner. Repair them all.");
add("vh_003", "very_hard", "multi", scene("clock"), m(
    (s) => corruptMissingPart(s, "hour-hand"),
    (s) => corruptMiscolorPart(s, "pivot", "#22c55e"),
    (s) => corruptDisplacedPart(s, "minute-hand", { dx: 0, dy: 6 }),
  ), "The clock has three problems: hour hand missing, pivot is green, and minute hand dropped slightly. Restore the clean state.");
add("vh_004", "very_hard", "multi", scene("clock"), m(
    (s) => corruptDisplacedPart(s, "hour-hand", { dx: 4, dy: 0 }),
    (s) => corruptDisplacedPart(s, "minute-hand", { dx: 0, dy: 4 }),
    (s) => corruptDisplacedPart(s, "pivot", { dx: 2, dy: 2 }),
  ), "All three clock parts have drifted by small amounts. Restore each to its precise original position.");
add("vh_005", "very_hard", "multi", scene("envelope"), m(
    (s) => corruptMissingPart(s, "stamp"),
    (s) => corruptMissingPart(s, "address"),
    (s) => corruptMiscolorPart(s, "urgent", "#3b82f6"),
  ), "Three problems on the envelope: stamp missing, address line missing, urgent dot is blue. Fix them all.");
add("vh_006", "very_hard", "multi", scene("bell"), m(
    (s) => corruptMissingPart(s, "badge"),
    (s) => corruptMissingPart(s, "badge-count"),
    (s) => corruptDisplacedPart(s, "ringer", { dx: -6, dy: 0 }),
  ), "The bell has lost its badge and the inner dot, and the ringer has drifted left. Restore the clean state.");
add("vh_007", "very_hard", "multi", scene("face"), m(
    (s) => corruptMissingPart(s, "tear-left"),
    (s) => corruptMiscolorPart(s, "blush-left", "#3b82f6"),
    (s) => corruptMiscolorPart(s, "blush-right", "#22c55e"),
  ), "Three things wrong: tear missing, left blush is blue, right blush is green. Fix everything.");
add("vh_008", "very_hard", "multi", scene("heart"), m(
    (s) => corruptMissingPart(s, "crack"),
    (s) => corruptMissingPart(s, "arrow"),
    (s) => corruptIconColor(s, "#3b82f6", "#222"),
  ), "Crack and arrow gone, AND the heart outline got tinted blue. Restore the original state completely.");
add("vh_009", "very_hard", "multi", scene("cart"), m(
    (s) => corruptMissingPart(s, "wheel-left"),
    (s) => corruptMissingPart(s, "item-1"),
    (s) => corruptMiscolorPart(s, "item-2", "#3b82f6"),
  ), "The cart has three problems: missing left wheel, missing item-1, and item-2 is the wrong color. Fix them all.");
add("vh_010", "very_hard", "multi", scene("pin"), m(
    (s) => corruptMiscolorPart(s, "pin-dot", "#22c55e"),
    (s) => corruptDisplacedPart(s, "shadow", { dx: 12, dy: 0 }),
    (s) => corruptExtraPart(s, extra("stray-dot", "circle", { cx: 30, cy: 30, r: 3, fill: "#fde047" })),
  ), "Three issues on the pin: pin-dot is green, shadow shifted right, AND there's an extra yellow dot in the corner. Repair them all.");
add("vh_011", "very_hard", "multi", scene("gift"), m(
    (s) => corruptMissingPart(s, "bow-left"),
    (s) => corruptMissingPart(s, "bow-right"),
    (s) => corruptDisplacedPart(s, "bow-knot", { dx: 0, dy: 6 }),
  ), "The gift's bows are gone (both sides) and the knot dropped slightly. Restore the clean state.");
add("vh_012", "very_hard", "multi", scene("flag"), m(
    (s) => corruptMissingPart(s, "pole-tip"),
    (s) => corruptMiscolorPart(s, "windline", "#e63946"),
    (s) => corruptDisplacedPart(s, "windline", { dx: 6, dy: 0 }),
  ), "Pole-tip missing, windline recolored red AND shifted right. Restore the entire scene.");
add("vh_013", "very_hard", "multi", scene("bulb"), m(
    (s) => corruptMissingPart(s, "halo"),
    (s) => corruptMissingPart(s, "filament"),
    (s) => corruptIconColor(s, "#fde047", "#222"),
  ), "The bulb has no halo or filament, AND the base icon is yellow instead of black. Restore everything.");
add("vh_014", "very_hard", "multi", scene("cog"), m(
    (s) => corruptDisplacedPart(s, "center-dot", { dx: 4, dy: 0 }),
    (s) => corruptMiscolorPart(s, "rotation-arrow", "#22c55e"),
    (s) => corruptExtraPart(s, extra("scratch", "line", { x1: 20, y1: 20, x2: 30, y2: 30, stroke: "#222", strokeWidth: 1 })),
  ), "Three issues on the cog: center-dot drifted, rotation arrow is green, AND there's a small scratch in the corner. Fix all of them.");
add("vh_015", "very_hard", "multi", scene("house"), m(
    (s) => corruptFlippedPart(s, "chimney"),
    (s) => corruptDuplicatePart(s, "window", { dx: 24, dy: 0 }),
    (s) => corruptMiscolorPart(s, "door", "#22c55e"),
  ), "The chimney was flipped, the window was duplicated, AND the door is the wrong color. Restore the clean state.");

// ---- VH subtle multi-issue (10) ----------------------------------------
add("vh_016", "very_hard", "multi", scene("house"), m(
    (s) => corruptDisplacedPart(s, "door", { dx: 3, dy: 0 }),
    (s) => corruptDisplacedPart(s, "window", { dx: -3, dy: 0 }),
  ), "Two parts of the house have drifted by 3px in opposite directions. Detect and fix both.");
add("vh_017", "very_hard", "multi", scene("clock"), m(
    (s) => corruptDisplacedPart(s, "hour-hand", { dx: 0, dy: 3 }),
    (s) => corruptMiscolorPart(s, "pivot", "#c63036"),
  ), "The hour hand dropped 3px AND the pivot's red is slightly off. Restore both precisely.");
add("vh_018", "very_hard", "multi", scene("envelope"), m(
    (s) => corruptDisplacedPart(s, "stamp", { dx: 0, dy: 3 }),
    (s) => corruptDisplacedPart(s, "urgent", { dx: 3, dy: 0 }),
  ), "Both decorative parts have shifted slightly. Detect and restore each.");
add("vh_019", "very_hard", "multi", scene("bell"), m(
    (s) => corruptDisplacedPart(s, "badge", { dx: -3, dy: 3 }),
    (s) => corruptMiscolorPart(s, "badge-count", "#fcfcfc"),
  ), "The badge drifted slightly AND the inner dot's white is a hair off. Restore both.");
add("vh_020", "very_hard", "multi", scene("face"), m(
    (s) => corruptDisplacedPart(s, "blush-left", { dx: 3, dy: 0 }),
    (s) => corruptDisplacedPart(s, "blush-right", { dx: -3, dy: 0 }),
  ), "Both blushes drifted inward by 3px. Restore each to its original outer position.");
add("vh_021", "very_hard", "multi", scene("cart"), m(
    (s) => corruptDisplacedPart(s, "wheel-left", { dx: 3, dy: 0 }),
    (s) => corruptDisplacedPart(s, "wheel-right", { dx: -3, dy: 0 }),
  ), "Both wheels drifted slightly inward. Restore each to its original outer position.");
add("vh_022", "very_hard", "multi", scene("pin"), m(
    (s) => corruptDisplacedPart(s, "pin-dot", { dx: 0, dy: 2 }),
    (s) => corruptMiscolorPart(s, "pin-dot", "#d33036"),
  ), "The pin-dot slipped 2px AND its red is slightly off. Restore the exact original position and color.");
add("vh_023", "very_hard", "multi", scene("gift"), m(
    (s) => corruptDisplacedPart(s, "bow-left", { dx: -3, dy: 0 }),
    (s) => corruptDisplacedPart(s, "bow-right", { dx: 3, dy: 0 }),
  ), "Both bows drifted slightly outward. Restore each to the original inner position.");
add("vh_024", "very_hard", "multi", scene("flag"), m(
    (s) => corruptDisplacedPart(s, "pole-tip", { dx: 0, dy: 2 }),
    (s) => corruptDisplacedPart(s, "windline", { dx: -3, dy: 0 }),
  ), "Pole-tip and windline have both shifted by small amounts. Restore both.");
add("vh_025", "very_hard", "multi", scene("cog"), m(
    (s) => corruptDisplacedPart(s, "center-dot", { dx: 2, dy: 0 }),
    (s) => corruptMiscolorPart(s, "rotation-arrow", "#2c70ec"),
  ), "The center-dot is 2px off AND the rotation arrow's blue is slightly wrong. Restore both precisely.");

// ---- VH wrong_color + clipped_viewbox combos (5) ----------------------
add("vh_026", "very_hard", "multi", scene("house"), m(
    (s) => corruptIconColor(s, "#3b82f6", "#222"),
    (s) => corruptClippedViewBox(s, 96, 96),
  ), "The home base icon is wrongly tinted blue AND the canvas is clipping the icon. Restore both.");
add("vh_027", "very_hard", "multi", scene("clock"), m(
    (s) => corruptIconColor(s, "#e63946", "#222"),
    (s) => corruptClippedViewBox(s, 96, 96),
  ), "The clock outline is red AND the canvas is too small. Repair the color and expand the viewBox.");
add("vh_028", "very_hard", "multi", scene("bell"), m(
    (s) => corruptIconColor(s, "#22c55e", "#222"),
    (s) => corruptClippedViewBox(s, 80, 80),
  ), "The bell outline is green AND the canvas is way too small. Restore the original colors and viewBox.");
add("vh_029", "very_hard", "multi", scene("envelope"), m(
    (s) => corruptIconColor(s, "#a855f7", "#222"),
    (s) => corruptClippedViewBox(s, 96, 80),
  ), "The envelope outline is purple AND part of it is cropped. Restore both.");
add("vh_030", "very_hard", "multi", scene("heart"), m(
    (s) => corruptIconColor(s, "#fde047", "#222"),
    (s) => corruptClippedViewBox(s, 80, 80),
  ), "The heart base is yellow AND the canvas is clipping it. Restore the original color and expand the viewBox.");

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

const seen = new Set();
for (const t of TASKS) {
  if (seen.has(t.id)) throw new Error(`duplicate task id: ${t.id}`);
  seen.add(t.id);
  const clean = t.sceneBuilder();
  const { corrupted, fix } = t.corruptionBuilder(clean);
  const { spec: target, diff } = fix(corrupted);
  const initialIds = sceneIds(corrupted);
  const targetIds = sceneIds(target);
  const allIds = [...new Set([...initialIds, ...targetIds])];
  const changed = new Set(diff.map((d) => d.part).filter((p) => p !== "__svg"));
  const record = {
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
  };
  writeFileSync(join(OUT, `${t.id}.json`), JSON.stringify(record, null, 2));
}

const byDiff = TASKS.reduce((acc, t) => ((acc[t.difficulty] = (acc[t.difficulty] ?? 0) + 1), acc), {});
console.log(`authored ${TASKS.length} tasks:`, byDiff);
