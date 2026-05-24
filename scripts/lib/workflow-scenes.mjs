// Workflow scenes: ordered list of parts that build up one SVG step by step.
//
// Each scene's `parts` array is in DRAWING ORDER. A workflow task at step N
// gives the model a canvas containing parts[0..N-1] and asks it to add
// parts[N-1] (the Nth part). Step 1 starts from an empty canvas.
//
// Coordinates target a 128x128 canvas so the assembled scene fits cleanly.

export const WORKFLOWS = {
  // 1. HOUSE -----------------------------------------------------------
  house: {
    label: "house",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "ground",   type: "line",    x1: 8, y1: 116, x2: 120, y2: 116, stroke: "#222", strokeWidth: 2 },
      { id: "walls",    type: "rect",    x: 28, y: 56, width: 72, height: 56, fill: "#e3c084" },
      { id: "roof",     type: "polygon", points: [[20, 56], [64, 16], [108, 56]], fill: "#8c3b2c" },
      { id: "door",     type: "rect",    x: 56, y: 80, width: 16, height: 32, fill: "#6a3819" },
      { id: "window",   type: "rect",    x: 36, y: 68, width: 16, height: 16, fill: "#94c8ff" },
      { id: "chimney",  type: "rect",    x: 84, y: 28, width: 10, height: 22, fill: "#603020" },
    ],
  },

  // 2. SMILEY -----------------------------------------------------------
  smiley: {
    label: "smiley face",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "face",      type: "circle",   cx: 64, cy: 64, r: 48, fill: "#fde047", stroke: "#222", strokeWidth: 2 },
      { id: "eye-left",  type: "circle",   cx: 50, cy: 54, r: 4,  fill: "#222" },
      { id: "eye-right", type: "circle",   cx: 78, cy: 54, r: 4,  fill: "#222" },
      { id: "nose",      type: "circle",   cx: 64, cy: 64, r: 2,  fill: "#222" },
      { id: "mouth",     type: "polyline", points: [[50, 78], [64, 86], [78, 78]], stroke: "#222", strokeWidth: 2, fill: "none" },
      { id: "eyebrow",   type: "line",     x1: 44, y1: 42, x2: 56, y2: 40, stroke: "#222", strokeWidth: 2 },
    ],
  },

  // 3. CLOCK ------------------------------------------------------------
  clock: {
    label: "clock",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "face",        type: "circle", cx: 64, cy: 64, r: 48, fill: "#ffffff", stroke: "#222", strokeWidth: 2 },
      { id: "mark-12",     type: "rect",   x: 62, y: 18, width: 4, height: 8, fill: "#222" },
      { id: "mark-6",      type: "rect",   x: 62, y: 102, width: 4, height: 8, fill: "#222" },
      { id: "hour-hand",   type: "line",   x1: 64, y1: 64, x2: 64, y2: 36, stroke: "#222", strokeWidth: 3 },
      { id: "minute-hand", type: "line",   x1: 64, y1: 64, x2: 86, y2: 64, stroke: "#222", strokeWidth: 2 },
      { id: "pivot",       type: "circle", cx: 64, cy: 64, r: 3, fill: "#e63946" },
    ],
  },

  // 4. CAR --------------------------------------------------------------
  car: {
    label: "car",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "body",        type: "rect",    x: 16, y: 64, width: 96, height: 24, rx: 4, ry: 4, fill: "#3b82f6" },
      { id: "roof",        type: "polygon", points: [[28, 64], [40, 44], [88, 44], [100, 64]], fill: "#3b82f6" },
      { id: "window",      type: "rect",    x: 42, y: 46, width: 44, height: 18, fill: "#bae6fd" },
      { id: "wheel-left",  type: "circle",  cx: 32, cy: 92, r: 8, fill: "#222" },
      { id: "wheel-right", type: "circle",  cx: 96, cy: 92, r: 8, fill: "#222" },
      { id: "headlight",   type: "circle",  cx: 110, cy: 72, r: 3, fill: "#fde047" },
    ],
  },

  // 5. TREE -------------------------------------------------------------
  tree: {
    label: "tree",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "ground",  type: "line",   x1: 8, y1: 112, x2: 120, y2: 112, stroke: "#222", strokeWidth: 2 },
      { id: "trunk",   type: "rect",   x: 56, y: 72, width: 16, height: 40, fill: "#6a3819" },
      { id: "crown",   type: "circle", cx: 64, cy: 48, r: 32, fill: "#3a9d5d" },
      { id: "fruit-1", type: "circle", cx: 50, cy: 40, r: 4, fill: "#e63946" },
      { id: "fruit-2", type: "circle", cx: 78, cy: 52, r: 4, fill: "#e63946" },
      { id: "fruit-3", type: "circle", cx: 60, cy: 60, r: 4, fill: "#e63946" },
    ],
  },

  // 6. CAKE -------------------------------------------------------------
  cake: {
    label: "cake",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "plate",      type: "ellipse",  cx: 64, cy: 108, rx: 44, ry: 6, fill: "#888888" },
      { id: "base-layer", type: "rect",     x: 24, y: 72, width: 80, height: 32, fill: "#b85c38" },
      { id: "top-layer",  type: "rect",     x: 32, y: 48, width: 64, height: 24, fill: "#f0c0c0" },
      { id: "frosting",   type: "polyline", points: [[32, 48], [40, 40], [48, 48], [56, 40], [64, 48], [72, 40], [80, 48], [88, 40], [96, 48]], stroke: "#ffffff", strokeWidth: 2, fill: "none" },
      { id: "candle",     type: "rect",     x: 62, y: 24, width: 4, height: 20, fill: "#f0c0c0" },
      { id: "flame",      type: "ellipse",  cx: 64, cy: 20, rx: 3, ry: 5, fill: "#f97316" },
    ],
  },

  // 7. BOAT -------------------------------------------------------------
  boat: {
    label: "boat",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "wave-1", type: "polyline", points: [[8, 108], [24, 104], [40, 108], [56, 104], [72, 108], [88, 104], [104, 108], [120, 104]], stroke: "#3b82f6", strokeWidth: 2, fill: "none" },
      { id: "hull",   type: "polygon",  points: [[16, 88], [112, 88], [96, 104], [32, 104]], fill: "#92400e" },
      { id: "mast",   type: "line",     x1: 64, y1: 88, x2: 64, y2: 16, stroke: "#222", strokeWidth: 3 },
      { id: "sail",   type: "polygon",  points: [[64, 20], [96, 72], [64, 72]], fill: "#fde047" },
      { id: "flag",   type: "polygon",  points: [[64, 16], [76, 20], [64, 24]], fill: "#e63946" },
      { id: "wave-2", type: "polyline", points: [[16, 116], [32, 112], [48, 116], [64, 112], [80, 116], [96, 112], [112, 116]], stroke: "#3b82f6", strokeWidth: 1, fill: "none" },
    ],
  },

  // 8. CUP --------------------------------------------------------------
  cup: {
    label: "coffee cup",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "saucer",   type: "ellipse",  cx: 64, cy: 104, rx: 40, ry: 6, fill: "#cccccc" },
      { id: "cup-body", type: "rect",     x: 36, y: 56, width: 48, height: 48, fill: "#f5f5f5", stroke: "#222", strokeWidth: 2 },
      { id: "handle",   type: "circle",   cx: 88, cy: 80, r: 10, fill: "none", stroke: "#222", strokeWidth: 3 },
      { id: "steam-1",  type: "polyline", points: [[54, 40], [50, 32], [56, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none" },
      { id: "steam-2",  type: "polyline", points: [[64, 40], [60, 32], [66, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none" },
      { id: "steam-3",  type: "polyline", points: [[74, 40], [70, 32], [76, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none" },
    ],
  },

  // 9. FLOWER -----------------------------------------------------------
  flower: {
    label: "flower",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "stem",    type: "line",    x1: 64, y1: 72, x2: 64, y2: 116, stroke: "#22c55e", strokeWidth: 3 },
      { id: "petal-n", type: "ellipse", cx: 64, cy: 36, rx: 10, ry: 16, fill: "#ec4899" },
      { id: "petal-e", type: "ellipse", cx: 84, cy: 56, rx: 16, ry: 10, fill: "#ec4899" },
      { id: "petal-s", type: "ellipse", cx: 64, cy: 76, rx: 10, ry: 16, fill: "#ec4899" },
      { id: "petal-w", type: "ellipse", cx: 44, cy: 56, rx: 16, ry: 10, fill: "#ec4899" },
      { id: "center",  type: "circle",  cx: 64, cy: 56, r: 8, fill: "#fde047" },
    ],
  },

  // 10. ROCKET ----------------------------------------------------------
  rocket: {
    label: "rocket",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "flame",      type: "polygon", points: [[52, 108], [64, 124], [76, 108]], fill: "#f97316" },
      { id: "body",       type: "rect",    x: 48, y: 40, width: 32, height: 70, fill: "#cccccc", stroke: "#222", strokeWidth: 2 },
      { id: "nose-cone",  type: "polygon", points: [[48, 40], [80, 40], [64, 12]], fill: "#e63946" },
      { id: "fin-left",   type: "polygon", points: [[48, 80], [32, 110], [48, 110]], fill: "#e63946" },
      { id: "fin-right",  type: "polygon", points: [[80, 80], [96, 110], [80, 110]], fill: "#e63946" },
      { id: "window",     type: "circle",  cx: 64, cy: 56, r: 8, fill: "#94c8ff", stroke: "#222", strokeWidth: 2 },
    ],
  },
};

export const workflowNames = () => Object.keys(WORKFLOWS);

// Friendly description used in instructions, e.g. "rect at x=28, y=56, width=72, height=56, fill #e3c084".
export const describePart = (p) => {
  const parts = [`${p.type}`];
  if (p.type === "rect") {
    parts.push(`x=${p.x}, y=${p.y}, width=${p.width}, height=${p.height}`);
    if (p.rx !== undefined) parts.push(`rx=${p.rx}`);
    parts.push(`fill ${p.fill}`);
  } else if (p.type === "circle") {
    parts.push(`cx=${p.cx}, cy=${p.cy}, r=${p.r}`);
    parts.push(`fill ${p.fill}`);
  } else if (p.type === "ellipse") {
    parts.push(`cx=${p.cx}, cy=${p.cy}, rx=${p.rx}, ry=${p.ry}`);
    parts.push(`fill ${p.fill}`);
  } else if (p.type === "line") {
    parts.push(`(${p.x1},${p.y1})→(${p.x2},${p.y2})`);
    parts.push(`stroke ${p.stroke}, stroke-width ${p.strokeWidth}`);
  } else if (p.type === "polygon" || p.type === "polyline") {
    parts.push(`points ${p.points.map((q) => q.join(",")).join(" ")}`);
    if (p.fill !== undefined) parts.push(`fill ${p.fill}`);
    if (p.stroke !== undefined) parts.push(`stroke ${p.stroke}`);
    if (p.strokeWidth !== undefined) parts.push(`stroke-width ${p.strokeWidth}`);
  }
  if (p.stroke !== undefined && p.type !== "line" && p.type !== "polyline" && p.type !== "polygon") {
    parts.push(`stroke ${p.stroke}, stroke-width ${p.strokeWidth}`);
  }
  return `${parts[0]} (${parts.slice(1).join(", ")}) with id "${p.id}"`;
};
