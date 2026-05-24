// Composite scene library.
//
// Each function returns a fresh spec — DO NOT cache. Generators run multiple
// edits per scene and need independent copies. Part `id`s are
// semantically meaningful so instructions can reference them by name.

const CANVAS = [128, 128];

// ---------- house ----------------------------------------------------------
export const house = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "wall",    type: "rect",    x: 28, y: 56, width: 72, height: 56, fill: "#e3c084" },
    { id: "roof",    type: "polygon", points: [[20, 56], [64, 16], [108, 56]], fill: "#8c3b2c" },
    { id: "door",    type: "rect",    x: 56, y: 80, width: 16, height: 32, fill: "#6a3819" },
    { id: "window",  type: "rect",    x: 36, y: 68, width: 16, height: 16, fill: "#94c8ff" },
    { id: "chimney", type: "rect",    x: 84, y: 28, width: 10, height: 22, fill: "#603020" },
  ],
});

// ---------- traffic light --------------------------------------------------
export const trafficLight = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "pole",   type: "rect",   x: 60, y: 90, width: 8, height: 32, fill: "#555" },
    { id: "frame",  type: "rect",   x: 48, y: 16, width: 32, height: 76, rx: 6, ry: 6, fill: "#222" },
    { id: "red",    type: "circle", cx: 64, cy: 30, r: 9, fill: "#e63946" },
    { id: "yellow", type: "circle", cx: 64, cy: 52, r: 9, fill: "#f6c453" },
    { id: "green",  type: "circle", cx: 64, cy: 74, r: 9, fill: "#3a9d5d" },
  ],
});

// ---------- smiley ---------------------------------------------------------
export const smiley = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "face",     type: "circle", cx: 64, cy: 64, r: 48, fill: "#ffe156" },
    { id: "eye-left", type: "circle", cx: 48, cy: 54, r: 5, fill: "#222" },
    { id: "eye-right",type: "circle", cx: 80, cy: 54, r: 5, fill: "#222" },
    // mouth as a tall ellipse to suggest a smile
    { id: "mouth",    type: "ellipse", cx: 64, cy: 78, rx: 16, ry: 8, fill: "#222" },
  ],
});

// ---------- calendar -------------------------------------------------------
export const calendar = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "body",   type: "rect", x: 16, y: 28, width: 96, height: 84, fill: "#f4f4f4", stroke: "#222", strokeWidth: 2 },
    { id: "header", type: "rect", x: 16, y: 28, width: 96, height: 18, fill: "#3b82f6" },
    { id: "ring-left",  type: "rect", x: 32, y: 18, width: 6, height: 18, fill: "#555" },
    { id: "ring-right", type: "rect", x: 90, y: 18, width: 6, height: 18, fill: "#555" },
    { id: "day1", type: "rect", x: 28, y: 56, width: 14, height: 14, fill: "#cbd5e1" },
    { id: "day2", type: "rect", x: 56, y: 56, width: 14, height: 14, fill: "#cbd5e1" },
    { id: "day3", type: "rect", x: 84, y: 56, width: 14, height: 14, fill: "#cbd5e1" },
    { id: "day4", type: "rect", x: 28, y: 84, width: 14, height: 14, fill: "#cbd5e1" },
    { id: "day5", type: "rect", x: 56, y: 84, width: 14, height: 14, fill: "#fb7185" },
    { id: "day6", type: "rect", x: 84, y: 84, width: 14, height: 14, fill: "#cbd5e1" },
  ],
});

// ---------- robot ----------------------------------------------------------
export const robot = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "antenna",  type: "line",   x1: 64, y1: 12, x2: 64, y2: 28, stroke: "#222", strokeWidth: 3 },
    { id: "antenna-bulb", type: "circle", cx: 64, cy: 10, r: 4, fill: "#e63946" },
    { id: "head",     type: "rect",   x: 38, y: 28, width: 52, height: 36, rx: 6, ry: 6, fill: "#9aa6b2" },
    { id: "eye-left", type: "circle", cx: 52, cy: 46, r: 4, fill: "#222" },
    { id: "eye-right",type: "circle", cx: 76, cy: 46, r: 4, fill: "#222" },
    { id: "mouth",    type: "rect",   x: 54, y: 56, width: 20, height: 4, fill: "#222" },
    { id: "body",     type: "rect",   x: 32, y: 68, width: 64, height: 44, rx: 6, ry: 6, fill: "#5d6b7c" },
    { id: "chest-light", type: "circle", cx: 64, cy: 90, r: 5, fill: "#3a9d5d" },
  ],
});

// ---------- shopping cart --------------------------------------------------
export const cart = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "handle",     type: "line", x1: 14, y1: 30, x2: 30, y2: 30, stroke: "#222", strokeWidth: 4 },
    { id: "handle-down",type: "line", x1: 30, y1: 30, x2: 38, y2: 64, stroke: "#222", strokeWidth: 4 },
    { id: "basket",     type: "rect", x: 28, y: 48, width: 80, height: 32, fill: "#94c8ff", stroke: "#222", strokeWidth: 2 },
    { id: "wheel-left", type: "circle", cx: 48, cy: 96, r: 8, fill: "#222" },
    { id: "wheel-right",type: "circle", cx: 92, cy: 96, r: 8, fill: "#222" },
  ],
});

// ---------- flag -----------------------------------------------------------
export const flag = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "pole",   type: "rect", x: 28, y: 16, width: 6, height: 96, fill: "#444" },
    { id: "banner", type: "polygon", points: [[34, 20], [104, 32], [34, 56]], fill: "#e63946" },
    { id: "ground", type: "line", x1: 16, y1: 112, x2: 112, y2: 112, stroke: "#222", strokeWidth: 3 },
  ],
});

// ---------- clock ----------------------------------------------------------
export const clock = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "face",        type: "circle", cx: 64, cy: 64, r: 48, fill: "#fff", stroke: "#222", strokeWidth: 3 },
    { id: "mark-12",     type: "rect",   x: 62, y: 18, width: 4, height: 8, fill: "#222" },
    { id: "mark-6",      type: "rect",   x: 62, y: 102, width: 4, height: 8, fill: "#222" },
    { id: "mark-3",      type: "rect",   x: 102, y: 62, width: 8, height: 4, fill: "#222" },
    { id: "mark-9",      type: "rect",   x: 18, y: 62, width: 8, height: 4, fill: "#222" },
    { id: "hour-hand",   type: "line",   x1: 64, y1: 64, x2: 64, y2: 36, stroke: "#222", strokeWidth: 4 },
    { id: "minute-hand", type: "line",   x1: 64, y1: 64, x2: 86, y2: 64, stroke: "#222", strokeWidth: 3 },
    { id: "center",      type: "circle", cx: 64, cy: 64, r: 3, fill: "#e63946" },
  ],
});

// ---------- car ------------------------------------------------------------
export const car = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "body",       type: "rect", x: 12, y: 64, width: 104, height: 28, rx: 6, ry: 6, fill: "#3b82f6" },
    { id: "roof",       type: "polygon", points: [[28, 64], [44, 44], [88, 44], [104, 64]], fill: "#3b82f6" },
    { id: "window",     type: "polygon", points: [[34, 62], [48, 48], [84, 48], [98, 62]], fill: "#bae6fd" },
    { id: "wheel-left", type: "circle", cx: 36, cy: 96, r: 10, fill: "#222" },
    { id: "wheel-right",type: "circle", cx: 92, cy: 96, r: 10, fill: "#222" },
    { id: "headlight",  type: "circle", cx: 110, cy: 76, r: 3, fill: "#fde047" },
  ],
});

// ---------- tree -----------------------------------------------------------
export const tree = () => ({
  canvas: CANVAS,
  bg: "white",
  objects: [
    { id: "trunk", type: "rect",   x: 56, y: 76, width: 16, height: 36, fill: "#6a3819" },
    { id: "crown", type: "circle", cx: 64, cy: 52, r: 32, fill: "#3a9d5d" },
    { id: "fruit-1", type: "circle", cx: 50, cy: 42, r: 4, fill: "#e63946" },
    { id: "fruit-2", type: "circle", cx: 76, cy: 56, r: 4, fill: "#e63946" },
    { id: "fruit-3", type: "circle", cx: 60, cy: 64, r: 4, fill: "#e63946" },
    { id: "ground", type: "line",   x1: 16, y1: 112, x2: 112, y2: 112, stroke: "#222", strokeWidth: 3 },
  ],
});

// ---------- registry ------------------------------------------------------
export const SCENES = {
  house,
  "traffic-light": trafficLight,
  smiley,
  calendar,
  robot,
  cart,
  flag,
  clock,
  car,
  tree,
};

export const sceneIds = () => Object.keys(SCENES);
