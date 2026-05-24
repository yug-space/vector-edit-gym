// Composite scenes that combine a real Heroicon (base) with hand-placed
// primitive parts that act as semantic "details" the AI can manipulate.
//
// Each builder returns a FRESH spec — generators run independent edits per
// task, so they need their own copies.
//
// Layout convention: 128x128 canvas; the base icon occupies x=8..120, y=8..120
// (size=112). Detail parts are positioned relative to that.

import { lookupIcon, place } from "./icon-catalog.mjs";

const CANVAS = [128, 128];
const BASE_X = 8, BASE_Y = 8, BASE_SIZE = 112;

const baseIcon = (name, { color = "#222", strokeWidth } = {}) => ({
  id: name,
  source: lookupIcon(name).source,
  x: BASE_X,
  y: BASE_Y,
  size: BASE_SIZE,
  color,
  ...(strokeWidth !== undefined ? { strokeWidth } : {}),
});

// ---------- house: door, window, chimney, doormat -------------------------
// The Heroicons home is a roof+walls silhouette. We add semantic details
// (door, window, chimney) on top so they have stable ids the AI can target.
export const house = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("home"),
  parts: [
    { id: "door",     type: "rect",   x: 56, y: 78, width: 16, height: 30, fill: "#6a3819" },
    { id: "window",   type: "rect",   x: 32, y: 56, width: 12, height: 12, fill: "#94c8ff" },
    { id: "chimney",  type: "rect",   x: 84, y: 26, width: 8,  height: 16, fill: "#603020" },
    { id: "doorknob", type: "circle", cx: 70, cy: 94, r: 1.5, fill: "#fde047" },
  ],
});

// ---------- clock: hands + center dot + tick marks ------------------------
// Heroicons clock outline already contains hands inside its path, but we add
// our own labeled hands so dexterity tasks ("rotate the hour hand to 9") can
// target a known part. Visually our hands sit on top of the icon's outline.
export const clockScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("clock"),
  parts: [
    { id: "hour-hand",   type: "line",   x1: 64, y1: 64, x2: 64, y2: 38, stroke: "#222", strokeWidth: 3 },
    { id: "minute-hand", type: "line",   x1: 64, y1: 64, x2: 88, y2: 64, stroke: "#222", strokeWidth: 2 },
    { id: "pivot",       type: "circle", cx: 64, cy: 64, r: 2,  fill: "#e63946" },
  ],
});

// ---------- envelope: stamp, address line, urgent dot ---------------------
export const envelopeScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("envelope"),
  parts: [
    { id: "stamp",     type: "rect", x: 92, y: 32, width: 16, height: 12, fill: "#e63946", stroke: "#222", strokeWidth: 1 },
    { id: "address",   type: "line", x1: 36, y1: 84, x2: 76, y2: 84, stroke: "#222", strokeWidth: 1.5 },
    { id: "urgent",    type: "circle", cx: 100, cy: 64, r: 4, fill: "#e63946" },
  ],
});

// ---------- bell: ringer + notification badge -----------------------------
export const bellScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("bell"),
  parts: [
    { id: "ringer", type: "circle", cx: 64, cy: 110, r: 3, fill: "#222" },
    { id: "badge",  type: "circle", cx: 92, cy: 28, r: 6, fill: "#e63946" },
    { id: "badge-count", type: "circle", cx: 92, cy: 28, r: 1.5, fill: "white" },
  ],
});

// ---------- face-smile: tear, blush, hat-brim -----------------------------
// The face-smile Heroicon already has eyes + smile. We add tear/blush as
// extra details; tasks add/remove these.
export const faceScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("face-smile"),
  parts: [
    { id: "tear-left",  type: "polyline", points: [[44, 72], [42, 84], [46, 84]], stroke: "#3b82f6", strokeWidth: 2, fill: "none" },
    { id: "blush-left", type: "circle", cx: 36, cy: 70, r: 5, fill: "#fda4af", opacity: 0.7 },
    { id: "blush-right",type: "circle", cx: 92, cy: 70, r: 5, fill: "#fda4af", opacity: 0.7 },
  ],
});

// ---------- heart: crack line, arrow ---------------------------------------
export const heartScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("heart"),
  parts: [
    // a "crack" running down the middle of the heart
    { id: "crack", type: "polyline", points: [[64, 36], [58, 56], [70, 76], [62, 100]], stroke: "#222", strokeWidth: 2, fill: "none" },
    // a tiny arrow tail to suggest cupid's arrow
    { id: "arrow", type: "line", x1: 22, y1: 30, x2: 50, y2: 58, stroke: "#92400e", strokeWidth: 2 },
  ],
});

// ---------- shopping-cart: wheels (separate), items inside ----------------
export const cartScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("shopping-cart"),
  parts: [
    { id: "wheel-left",  type: "circle", cx: 52, cy: 110, r: 4, fill: "#222" },
    { id: "wheel-right", type: "circle", cx: 92, cy: 110, r: 4, fill: "#222" },
    { id: "item-1",      type: "rect",   x: 56, y: 60, width: 10, height: 10, fill: "#3b82f6" },
    { id: "item-2",      type: "circle", cx: 80, cy: 65, r: 5, fill: "#fde047" },
  ],
});

// ---------- map-pin: pin head + ground shadow -----------------------------
export const mapPinScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("map-pin"),
  parts: [
    { id: "pin-dot", type: "circle", cx: 64, cy: 46, r: 4, fill: "#e63946" },
    { id: "shadow",  type: "ellipse", cx: 64, cy: 112, rx: 18, ry: 3, fill: "#0009" },
  ],
});

// ---------- gift: ribbon-cross + bow knot ---------------------------------
export const giftScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("gift"),
  parts: [
    { id: "bow-left",  type: "circle", cx: 56, cy: 36, r: 4, fill: "#e63946" },
    { id: "bow-right", type: "circle", cx: 72, cy: 36, r: 4, fill: "#e63946" },
    { id: "bow-knot",  type: "circle", cx: 64, cy: 36, r: 2, fill: "#fde047" },
  ],
});

// ---------- flag: pole-tip + windline -------------------------------------
export const flagScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("flag"),
  parts: [
    { id: "pole-tip", type: "circle", cx: 28, cy: 22, r: 3, fill: "#fde047" },
    { id: "windline", type: "polyline", points: [[78, 64], [86, 60], [78, 56], [86, 52]], stroke: "#3b82f6", strokeWidth: 1.5, fill: "none" },
  ],
});

// ---------- light-bulb: filament + glow halo ------------------------------
export const bulbScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("light-bulb"),
  parts: [
    { id: "halo", type: "circle", cx: 64, cy: 50, r: 24, fill: "#fde047", opacity: 0.25 },
    { id: "filament", type: "polyline", points: [[58, 50], [62, 54], [66, 50], [70, 54]], stroke: "#f97316", strokeWidth: 1.5, fill: "none" },
  ],
});

// ---------- cog: rotation arrow + center marker ---------------------------
export const cogScene = () => ({
  canvas: CANVAS,
  bg: "white",
  base: baseIcon("cog"),
  parts: [
    { id: "center-dot", type: "circle", cx: 64, cy: 64, r: 3, fill: "#e63946" },
    { id: "rotation-arrow", type: "polyline", points: [[80, 50], [86, 56], [80, 62]], stroke: "#3b82f6", strokeWidth: 2, fill: "none" },
  ],
});

// ---------- registry ------------------------------------------------------
export const SCENES = {
  house: house,
  clock: clockScene,
  envelope: envelopeScene,
  bell: bellScene,
  face: faceScene,
  heart: heartScene,
  cart: cartScene,
  pin: mapPinScene,
  gift: giftScene,
  flag: flagScene,
  bulb: bulbScene,
  cog: cogScene,
};

export const sceneNames = () => Object.keys(SCENES);
