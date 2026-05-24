// Workflow scenes — ordered parts that build up one SVG.
//
// Each scene has 7 parts. The first part is the BASE (drawn already as the
// start state) and the following 6 parts each become one task. Each part
// carries a `prompt` field: the simple natural-language instruction shown to
// the model, e.g. "Add the front door." The model has to infer the exact
// shape/position from the existing canvas + the partial composition.

export const WORKFLOWS = {
  // 1. HOUSE -----------------------------------------------------------
  house: {
    label: "house",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "walls",    type: "rect",    x: 28, y: 56, width: 72, height: 56, fill: "#e3c084" },
      { id: "roof",     type: "polygon", points: [[20, 56], [64, 16], [108, 56]], fill: "#8c3b2c",  prompt: "Add the roof on top of the house." },
      { id: "door",     type: "rect",    x: 56, y: 80, width: 16, height: 32, fill: "#6a3819",     prompt: "Add a front door." },
      { id: "window",   type: "rect",    x: 36, y: 68, width: 16, height: 16, fill: "#94c8ff",     prompt: "Add a window." },
      { id: "chimney",  type: "rect",    x: 84, y: 28, width: 10, height: 22, fill: "#603020",     prompt: "Add a chimney on the roof." },
      { id: "doorknob", type: "circle",  cx: 70, cy: 94, r: 1.5, fill: "#fde047",                   prompt: "Add a doorknob on the door." },
      { id: "smoke",    type: "ellipse", cx: 89, cy: 18, rx: 6, ry: 4, fill: "#cccccc",             prompt: "Add a puff of smoke above the chimney." },
    ],
  },

  // 2. SMILEY ----------------------------------------------------------
  smiley: {
    label: "smiley face",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "face",         type: "circle",   cx: 64, cy: 64, r: 48, fill: "#fde047", stroke: "#222", strokeWidth: 2 },
      { id: "eye-left",     type: "circle",   cx: 50, cy: 54, r: 4, fill: "#222",                                            prompt: "Add the left eye." },
      { id: "eye-right",    type: "circle",   cx: 78, cy: 54, r: 4, fill: "#222",                                            prompt: "Add the right eye." },
      { id: "nose",         type: "circle",   cx: 64, cy: 64, r: 2, fill: "#222",                                            prompt: "Add a small nose at the center." },
      { id: "mouth",        type: "polyline", points: [[50, 78], [64, 86], [78, 78]], stroke: "#222", strokeWidth: 2, fill: "none", prompt: "Add a smiling mouth." },
      { id: "blush-left",   type: "ellipse",  cx: 38, cy: 70, rx: 5, ry: 3, fill: "#fda4af",                                 prompt: "Add a blush on the left cheek." },
      { id: "blush-right",  type: "ellipse",  cx: 90, cy: 70, rx: 5, ry: 3, fill: "#fda4af",                                 prompt: "Add a blush on the right cheek." },
    ],
  },

  // 3. CLOCK -----------------------------------------------------------
  clock: {
    label: "clock",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "face",        type: "circle", cx: 64, cy: 64, r: 48, fill: "#ffffff", stroke: "#222", strokeWidth: 2 },
      { id: "mark-12",     type: "rect",   x: 62, y: 18, width: 4, height: 8, fill: "#222",        prompt: "Add the 12-o'clock tick mark." },
      { id: "mark-6",      type: "rect",   x: 62, y: 102, width: 4, height: 8, fill: "#222",       prompt: "Add the 6-o'clock tick mark." },
      { id: "mark-3",      type: "rect",   x: 102, y: 62, width: 8, height: 4, fill: "#222",       prompt: "Add the 3-o'clock tick mark." },
      { id: "hour-hand",   type: "line",   x1: 64, y1: 64, x2: 64, y2: 36, stroke: "#222", strokeWidth: 3, prompt: "Add the hour hand pointing straight up." },
      { id: "minute-hand", type: "line",   x1: 64, y1: 64, x2: 86, y2: 64, stroke: "#222", strokeWidth: 2, prompt: "Add the minute hand pointing right." },
      { id: "pivot",       type: "circle", cx: 64, cy: 64, r: 3, fill: "#e63946",                  prompt: "Add the red pivot dot at the center." },
    ],
  },

  // 4. CAR -------------------------------------------------------------
  car: {
    label: "car",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "body",          type: "rect",    x: 16, y: 64, width: 96, height: 24, rx: 4, ry: 4, fill: "#3b82f6" },
      { id: "roof",          type: "polygon", points: [[28, 64], [40, 44], [88, 44], [100, 64]], fill: "#3b82f6", prompt: "Add the roof on top of the body." },
      { id: "window",        type: "rect",    x: 42, y: 46, width: 44, height: 18, fill: "#bae6fd",               prompt: "Add the windshield." },
      { id: "wheel-left",    type: "circle",  cx: 32, cy: 92, r: 8, fill: "#222",                                  prompt: "Add the left wheel." },
      { id: "wheel-right",   type: "circle",  cx: 96, cy: 92, r: 8, fill: "#222",                                  prompt: "Add the right wheel." },
      { id: "headlight",     type: "circle",  cx: 110, cy: 72, r: 3, fill: "#fde047",                              prompt: "Add the headlight." },
      { id: "license-plate", type: "rect",    x: 104, y: 80, width: 10, height: 4, fill: "#f5f5f5", stroke: "#222", strokeWidth: 0.5, prompt: "Add a small license plate." },
    ],
  },

  // 5. TREE ------------------------------------------------------------
  tree: {
    label: "tree",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "trunk",   type: "rect",   x: 56, y: 72, width: 16, height: 40, fill: "#6a3819" },
      { id: "crown",   type: "circle", cx: 64, cy: 48, r: 32, fill: "#3a9d5d",                  prompt: "Add the leafy crown." },
      { id: "fruit-1", type: "circle", cx: 50, cy: 40, r: 4, fill: "#e63946",                    prompt: "Add a fruit on the upper-left of the crown." },
      { id: "fruit-2", type: "circle", cx: 78, cy: 52, r: 4, fill: "#e63946",                    prompt: "Add a fruit on the right of the crown." },
      { id: "fruit-3", type: "circle", cx: 60, cy: 60, r: 4, fill: "#e63946",                    prompt: "Add a fruit near the bottom of the crown." },
      { id: "ground",  type: "line",   x1: 8, y1: 116, x2: 120, y2: 116, stroke: "#222", strokeWidth: 2, prompt: "Add a ground line." },
      { id: "bird",    type: "polyline", points: [[20, 24], [26, 20], [32, 24]], stroke: "#222", strokeWidth: 2, fill: "none", prompt: "Add a small bird flying above the tree." },
    ],
  },

  // 6. CAKE ------------------------------------------------------------
  cake: {
    label: "cake",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "plate",      type: "ellipse",  cx: 64, cy: 108, rx: 44, ry: 6, fill: "#888888" },
      { id: "base-layer", type: "rect",     x: 24, y: 72, width: 80, height: 32, fill: "#b85c38",  prompt: "Add the bottom cake layer." },
      { id: "top-layer",  type: "rect",     x: 32, y: 48, width: 64, height: 24, fill: "#f0c0c0",  prompt: "Add the top cake layer." },
      { id: "frosting",   type: "polyline", points: [[32, 48], [40, 40], [48, 48], [56, 40], [64, 48], [72, 40], [80, 48], [88, 40], [96, 48]], stroke: "#ffffff", strokeWidth: 2, fill: "none", prompt: "Add the frosting zigzag along the top of the cake." },
      { id: "candle",     type: "rect",     x: 62, y: 24, width: 4, height: 20, fill: "#f0c0c0",   prompt: "Add a candle on top." },
      { id: "flame",      type: "ellipse",  cx: 64, cy: 20, rx: 3, ry: 5, fill: "#f97316",         prompt: "Add a flame on the candle." },
      { id: "cherry",     type: "circle",   cx: 80, cy: 48, r: 3, fill: "#e63946",                 prompt: "Add a cherry on top of the cake." },
    ],
  },

  // 7. BOAT ------------------------------------------------------------
  boat: {
    label: "boat",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "hull",   type: "polygon",  points: [[16, 88], [112, 88], [96, 104], [32, 104]], fill: "#92400e" },
      { id: "mast",   type: "line",     x1: 64, y1: 88, x2: 64, y2: 16, stroke: "#222", strokeWidth: 3,             prompt: "Add the mast." },
      { id: "sail",   type: "polygon",  points: [[64, 20], [96, 72], [64, 72]], fill: "#fde047",                     prompt: "Add the sail." },
      { id: "flag",   type: "polygon",  points: [[64, 16], [76, 20], [64, 24]], fill: "#e63946",                     prompt: "Add a flag at the top of the mast." },
      { id: "wave-1", type: "polyline", points: [[8, 112], [24, 108], [40, 112], [56, 108], [72, 112], [88, 108], [104, 112], [120, 108]], stroke: "#3b82f6", strokeWidth: 2, fill: "none", prompt: "Add a wave below the boat." },
      { id: "wave-2", type: "polyline", points: [[16, 120], [32, 116], [48, 120], [64, 116], [80, 120], [96, 116], [112, 120]], stroke: "#3b82f6", strokeWidth: 1, fill: "none",      prompt: "Add a second smaller wave below the first." },
      { id: "sun",    type: "circle",   cx: 104, cy: 28, r: 8, fill: "#fde047",                                      prompt: "Add a sun in the upper-right of the sky." },
    ],
  },

  // 8. CUP -------------------------------------------------------------
  cup: {
    label: "coffee cup",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "cup-body", type: "rect",     x: 36, y: 56, width: 48, height: 48, fill: "#f5f5f5", stroke: "#222", strokeWidth: 2 },
      { id: "saucer",   type: "ellipse",  cx: 64, cy: 108, rx: 40, ry: 6, fill: "#cccccc",                                         prompt: "Add a saucer underneath the cup." },
      { id: "handle",   type: "circle",   cx: 88, cy: 80, r: 10, fill: "none", stroke: "#222", strokeWidth: 3,                      prompt: "Add the handle on the right of the cup." },
      { id: "steam-1",  type: "polyline", points: [[54, 40], [50, 32], [56, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none", prompt: "Add a wisp of steam above the cup." },
      { id: "steam-2",  type: "polyline", points: [[64, 40], [60, 32], [66, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none", prompt: "Add another wisp of steam in the middle." },
      { id: "steam-3",  type: "polyline", points: [[74, 40], [70, 32], [76, 24]], stroke: "#aaaaaa", strokeWidth: 2, fill: "none", prompt: "Add a third wisp of steam on the right." },
      { id: "coaster",  type: "rect",     x: 16, y: 116, width: 96, height: 4, fill: "#92400e",                                    prompt: "Add a brown coaster beneath the saucer." },
    ],
  },

  // 9. FLOWER ---------------------------------------------------------
  flower: {
    label: "flower",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "stem",    type: "line",    x1: 64, y1: 72, x2: 64, y2: 116, stroke: "#22c55e", strokeWidth: 3 },
      { id: "petal-n", type: "ellipse", cx: 64, cy: 36, rx: 10, ry: 16, fill: "#ec4899",  prompt: "Add a petal at the top." },
      { id: "petal-e", type: "ellipse", cx: 84, cy: 56, rx: 16, ry: 10, fill: "#ec4899",  prompt: "Add a petal on the right." },
      { id: "petal-s", type: "ellipse", cx: 64, cy: 76, rx: 10, ry: 16, fill: "#ec4899",  prompt: "Add a petal at the bottom." },
      { id: "petal-w", type: "ellipse", cx: 44, cy: 56, rx: 16, ry: 10, fill: "#ec4899",  prompt: "Add a petal on the left." },
      { id: "center",  type: "circle",  cx: 64, cy: 56, r: 8, fill: "#fde047",            prompt: "Add the yellow center of the flower." },
      { id: "leaf",    type: "ellipse", cx: 80, cy: 96, rx: 10, ry: 4, fill: "#22c55e",    prompt: "Add a leaf on the right side of the stem." },
    ],
  },

  // 10. ROCKET --------------------------------------------------------
  rocket: {
    label: "rocket",
    canvas: [128, 128],
    bg: "white",
    parts: [
      { id: "body",       type: "rect",    x: 48, y: 40, width: 32, height: 70, fill: "#cccccc", stroke: "#222", strokeWidth: 2 },
      { id: "nose-cone",  type: "polygon", points: [[48, 40], [80, 40], [64, 12]], fill: "#e63946",                                prompt: "Add the nose cone on top." },
      { id: "fin-left",   type: "polygon", points: [[48, 80], [32, 110], [48, 110]], fill: "#e63946",                              prompt: "Add the left fin." },
      { id: "fin-right",  type: "polygon", points: [[80, 80], [96, 110], [80, 110]], fill: "#e63946",                              prompt: "Add the right fin." },
      { id: "window",     type: "circle",  cx: 64, cy: 56, r: 8, fill: "#94c8ff", stroke: "#222", strokeWidth: 2,                  prompt: "Add a circular porthole window." },
      { id: "flame",      type: "polygon", points: [[52, 110], [64, 124], [76, 110]], fill: "#f97316",                             prompt: "Add a flame underneath the rocket." },
      { id: "star",       type: "polygon", points: [[20, 24], [22, 30], [28, 30], [23, 34], [25, 40], [20, 36], [15, 40], [17, 34], [12, 30], [18, 30]], fill: "#fde047", prompt: "Add a small star in the corner." },
    ],
  },
};

export const workflowNames = () => Object.keys(WORKFLOWS);
