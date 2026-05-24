// Very Hard — 30 tasks.
//
//   10 multi-step on composites    — 2-3 chained edits, preserve everything else
//    8 complex constraints         — "all hearts red except the cracked one"
//    6 real-icon attribute edits   — recolor scraped Heroicons by toggling root attrs
//    6 adversarial preservation    — dense duplicate scenes; surgical single-target edit

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { place, lookupIcon } from "./lib/icon-catalog.mjs";
import { recolor, restroke, move, resize, addPart, deletePart, chain } from "./lib/icon-edits.mjs";
import { cloneSpec } from "./lib/icon-render.mjs";
import { SCENES } from "./lib/icon-scenes.mjs";
import { iconTaskBuilder } from "./lib/icon-emit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const OUT = join(DATA, "tasks");

const { make, pushRaw, write } = iconTaskBuilder("vh", "very_hard");

// ---- 10 MULTI-STEP ON COMPOSITES ----------------------------------------
const MULTISTEP = [
  ["house", [
    { op: "color", target: "door",    params: { value: "#3b82f6" } },
    { op: "move",  target: "door",    params: { dx: -8, dy: 0 } },
  ], "Recolor the door blue (#3b82f6) AND shift it 8px left (x: 56→48). Window, chimney, doorknob, home outline unchanged."],

  ["house", [
    { op: "color", target: "window",  params: { value: "#fde047" } },
    { op: "color", target: "chimney", params: { value: "#22c55e" } },
  ], "Recolor the window yellow (#fde047) AND the chimney green (#22c55e). Door, doorknob, home outline unchanged."],

  ["clock", [
    { op: "move",  target: "hour-hand",   params: { dx: 0, dy: 26 } },
    { op: "move",  target: "minute-hand", params: { dx: -24, dy: 0 } },
    { op: "color", target: "pivot",       params: { value: "#3b82f6" } },
  ], "Set the time to 6:45: shift hour-hand y2 by +26 AND minute-hand x2 by -24, then repaint the pivot blue (#3b82f6). Clock outline unchanged."],

  ["envelope", [
    { op: "color",  target: "stamp",  params: { value: "#22c55e" } },
    { op: "delete", target: "urgent" },
  ], "Repaint the stamp green (#22c55e) AND remove the urgent dot. Address, envelope outline unchanged."],

  ["bell", [
    { op: "color",  target: "badge",  params: { value: "#22c55e" } },
    { op: "delete", target: "badge-count" },
  ], "Repaint the badge green (#22c55e) AND remove the small white center dot. Bell + ringer unchanged."],

  ["face", [
    { op: "delete", target: "tear-left" },
    { op: "color",  target: "blush-left", params: { value: "#a855f7" } },
    { op: "color",  target: "blush-right", params: { value: "#a855f7" } },
  ], "Wipe the tear AND make both blushes purple (#a855f7). Face outline unchanged."],

  ["cart", [
    { op: "color",  target: "item-1",  params: { value: "#22c55e" } },
    { op: "color",  target: "item-2",  params: { value: "#e63946" } },
    { op: "resize", target: "item-1",  params: { factor: 1.4 } },
  ], "Color item-1 green (#22c55e), item-2 red (#e63946), AND enlarge item-1 by 40%. Wheels + base cart unchanged."],

  ["heart", [
    { op: "delete", target: "crack" },
    { op: "color",  target: "arrow", params: { value: "#fde047" } },
  ], "Heal the heart (delete the crack) AND repaint the arrow yellow (#fde047) — change its stroke. Heart outline unchanged."],

  ["gift", [
    { op: "color",  target: "bow-left",  params: { value: "#3b82f6" } },
    { op: "color",  target: "bow-right", params: { value: "#3b82f6" } },
    { op: "color",  target: "bow-knot",  params: { value: "#fde047" } },
  ], "Make both bow circles blue (#3b82f6) AND the bow-knot yellow (#fde047). Gift outline unchanged."],

  ["cog", [
    { op: "color",  target: "center-dot", params: { value: "#22c55e" } },
    { op: "delete", target: "rotation-arrow" },
  ], "Repaint the center-dot green (#22c55e) AND remove the rotation-arrow. Cog outline unchanged."],
];

for (const [sceneName, steps, instr] of MULTISTEP) {
  const initial = SCENES[sceneName]();
  // route line/polyline color changes through restroke
  const adapted = steps.map((st) => {
    if (st.op === "color") {
      const p = initial.parts.find((x) => x.id === st.target);
      if (p && (p.type === "line" || p.type === "polyline")) {
        return { op: "stroke", target: st.target, params: { stroke: st.params.value } };
      }
    }
    return st;
  });
  const targetIds = [...new Set(adapted.map((s) => s.target).filter(Boolean))];
  make({
    category: "multi_step",
    initialSpec: initial,
    edit: (s) => chain(s, adapted),
    instruction: `[${sceneName} scene] ${instr}`,
    targetIds,
  });
}

// ---- 8 COMPLEX CONSTRAINTS ----------------------------------------------
// Scenes of duplicates with one "exception" rule.

const constraintBuilders = [
  // 1. Row of 5 identical hearts; make all red EXCEPT the third.
  () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      parts.push(place("heart", { id: `heart-${i + 1}`, x: 12 + i * 50, y: 32, size: 40, color: "#222" }));
    }
    return {
      initial: { canvas: [262, 96], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          if (p.id === "heart-3") continue;
          const before = p.color;
          p.color = "#e63946";
          diff.push({ part: p.id, attribute: "color", before, after: "#e63946" });
        }
        return { spec: next, diff };
      },
      instr: "Five hearts in a row. Make every heart red (#e63946) EXCEPT the third one (heart-3), which must remain black (#222).",
      targetIds: ["heart-1", "heart-2", "heart-4", "heart-5"],
    };
  },
  // 2. Row of 4 stars; bolden all to stroke-width 3 EXCEPT the first.
  () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const p = place("star", { id: `star-${i + 1}`, x: 16 + i * 60, y: 32, size: 48, color: "#222" });
      p.strokeWidth = 1.5;
      parts.push(p);
    }
    return {
      initial: { canvas: [256, 112], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          if (p.id === "star-1") continue;
          const before = p.strokeWidth;
          p.strokeWidth = 3;
          diff.push({ part: p.id, attribute: "stroke-width", before, after: 3 });
        }
        return { spec: next, diff };
      },
      instr: "Four stars in a row, all at stroke-width 1.5. Set stroke-width to 3 for every star EXCEPT the first one (star-1).",
      targetIds: ["star-2", "star-3", "star-4"],
    };
  },
  // 3. 6 bells; recolor only the ones with even indices.
  () => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      parts.push(place("bell", { id: `bell-${i + 1}`, x: 12 + i * 44, y: 16, size: 40, color: "#222" }));
    }
    return {
      initial: { canvas: [280, 72], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          const n = +p.id.split("-")[1];
          if (n % 2 !== 0) continue;
          const before = p.color;
          p.color = "#fde047";
          diff.push({ part: p.id, attribute: "color", before, after: "#fde047" });
        }
        return { spec: next, diff };
      },
      instr: "Six bells in a row. Recolor every EVEN-indexed bell yellow (#fde047): bell-2, bell-4, bell-6. Odd-indexed bells stay black.",
      targetIds: ["bell-2", "bell-4", "bell-6"],
    };
  },
  // 4. 5 icons of mixed types; recolor only the hearts.
  () => {
    const order = ["heart", "star", "heart", "bell", "heart"];
    const parts = order.map((n, i) => place(n, { id: `i${i + 1}-${n}`, x: 12 + i * 50, y: 24, size: 44, color: "#222" }));
    return {
      initial: { canvas: [262, 88], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          if (!p.id.endsWith("-heart")) continue;
          const before = p.color;
          p.color = "#e63946";
          diff.push({ part: p.id, attribute: "color", before, after: "#e63946" });
        }
        return { spec: next, diff };
      },
      instr: "Five icons (heart, star, heart, bell, heart). Recolor every HEART red (#e63946). Star and bell stay black.",
      targetIds: ["i1-heart", "i3-heart", "i5-heart"],
    };
  },
  // 5. House composite — recolor every detail part EXCEPT the doorknob.
  () => {
    const initial = SCENES.house();
    return {
      initial,
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          if (p.id === "doorknob") continue;
          if (p.fill === undefined) continue;
          const before = p.fill;
          p.fill = "#3b82f6";
          diff.push({ part: p.id, attribute: "fill", before, after: "#3b82f6" });
        }
        return { spec: next, diff };
      },
      instr: "Make every detail of the house blue (#3b82f6) — door, window, chimney — EXCEPT the doorknob. The home outline (base icon) stays untouched.",
      targetIds: ["door", "window", "chimney"],
    };
  },
  // 6. Cart — delete every loose item but keep wheels and cart outline.
  () => {
    const initial = SCENES.cart();
    return {
      initial,
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        const keep = new Set(["wheel-left", "wheel-right"]);
        const survivors = [];
        for (const p of next.parts) {
          if (keep.has(p.id)) survivors.push(p);
          else diff.push({ part: p.id, attribute: "exists", before: true, after: false, removed: p });
        }
        next.parts = survivors;
        return { spec: next, diff };
      },
      instr: "Empty the cart: delete every loose item EXCEPT the two wheels. The cart outline (base icon) must remain.",
      targetIds: ["item-1", "item-2"],
    };
  },
  // 7. 4 clocks each with all 3 hands; rotate the minute-hand on all four AT ONCE.
  () => {
    const parts = [];
    const positions = [[16, 16], [80, 16], [16, 80], [80, 80]];
    positions.forEach(([x, y], i) => {
      // each clock is its own placed icon + its own hands (manual layout)
      parts.push(place("clock", { id: `clock-${i + 1}`, x, y, size: 48, color: "#222" }));
      // hands placed in local-coords relative to each clock face center
      const cx = x + 24;
      const cy = y + 24;
      parts.push({ id: `hand-${i + 1}-h`, type: "line", x1: cx, y1: cy, x2: cx, y2: cy - 12, stroke: "#222", strokeWidth: 2 });
      parts.push({ id: `hand-${i + 1}-m`, type: "line", x1: cx, y1: cy, x2: cx + 16, y2: cy, stroke: "#222", strokeWidth: 1.5 });
    });
    return {
      initial: { canvas: [144, 144], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        for (const p of next.parts) {
          if (!p.id.endsWith("-m")) continue;
          // rotate each minute-hand to point straight down: x2 = cx, y2 = cy + 16
          const cx = p.x1;
          const cy = p.y1;
          const bx = p.x2;
          const by = p.y2;
          p.x2 = cx;
          p.y2 = cy + 16;
          diff.push({ part: p.id, attribute: "x2", before: bx, after: p.x2 });
          diff.push({ part: p.id, attribute: "y2", before: by, after: p.y2 });
        }
        return { spec: next, diff };
      },
      instr: "Four clocks (a 2×2 grid), each with hour and minute hands pointing up/right. Rotate EVERY minute-hand to point straight DOWN (x2 = pivot x, y2 = pivot y + 16). Hour-hands and clock faces unchanged.",
      targetIds: ["hand-1-m", "hand-2-m", "hand-3-m", "hand-4-m"],
    };
  },
  // 8. 5 envelopes; add an unread badge on EVEN ones only.
  () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      parts.push(place("envelope", { id: `env-${i + 1}`, x: 12 + i * 50, y: 24, size: 44, color: "#222" }));
    }
    return {
      initial: { canvas: [262, 96], bg: "white", parts },
      edit: (s) => {
        const next = cloneSpec(s);
        const diff = [];
        const newParts = [...next.parts];
        for (let i = 0; i < 5; i++) {
          if ((i + 1) % 2 !== 0) continue;
          const env = next.parts.find((p) => p.id === `env-${i + 1}`);
          // badge sits at top-right of each envelope; coords in canvas frame
          const badge = { id: `badge-${i + 1}`, type: "circle", cx: env.x + env.size - 6, cy: env.y + 6, r: 4, fill: "#e63946" };
          newParts.push(badge);
          diff.push({ part: badge.id, attribute: "exists", before: false, after: true, added: badge });
        }
        next.parts = newParts;
        return { spec: next, diff };
      },
      instr: "Five envelopes in a row. Add an unread badge (red circle, r=4, fill #e63946) on each EVEN envelope (env-2, env-4) at the top-right corner: cx = envelope.x + 38, cy = envelope.y + 6. Odd envelopes get nothing.",
      targetIds: ["badge-2", "badge-4"],
    };
  },
];

for (const buildFn of constraintBuilders) {
  const { initial, edit, instr, targetIds } = buildFn();
  make({
    category: "complex_constraint",
    initialSpec: initial,
    edit,
    instruction: instr,
    targetIds,
  });
}

// ---- 6 REAL-ICON ROOT ATTRIBUTE EDITS -----------------------------------
// Operate on the scraped SVG TEXT directly: swap the root <svg> stroke or
// fill from currentColor to a specific hex. The path geometry (d=) must
// remain byte-identical.

const replaceRootAttr = (svg, attr, val) =>
  svg.replace(/<svg\b([^>]*)>/, (_, attrs) => {
    let next = attrs;
    const re = new RegExp(`\\b${attr}="([^"]*)"`);
    if (re.test(next)) next = next.replace(re, `${attr}="${val}"`);
    else next = `${next} ${attr}="${val}"`;
    return `<svg${next}>`;
  });

const findRootAttr = (svg, attr) => {
  const m = svg.match(/<svg\b([^>]*)>/);
  if (!m) return null;
  const a = m[1].match(new RegExp(`\\b${attr}="([^"]*)"`));
  return a ? a[1] : null;
};

const REAL_EDITS = [
  ["heroicons/outline/home.svg",         { attr: "stroke", to: "#3b82f6" }, "Recolor the home icon's root stroke attribute to #3b82f6. Path d= must stay byte-identical."],
  ["heroicons/outline/cog-6-tooth.svg",  { attr: "stroke", to: "#e63946" }, "Recolor the cog icon's root stroke attribute to #e63946. Path d= unchanged."],
  ["heroicons/solid/heart.svg",          { attr: "fill",   to: "#e63946" }, "Fill the solid heart's root fill attribute with #e63946. Path d= unchanged."],
  ["feather/star.svg",                    { attr: "stroke", to: "#fde047" }, "Recolor the feather star's root stroke to #fde047. Polygon points unchanged."],
  ["feather/sun.svg",                     { attr: "stroke", to: "#f97316" }, "Recolor the feather sun's root stroke to #f97316. Path/circle/line elements unchanged."],
  ["heroicons/outline/flag.svg",         { attr: "stroke", to: "#22c55e" }, "Recolor the flag icon's root stroke to #22c55e. Path d= unchanged."],
];

for (const [iconPath, { attr, to }, instr] of REAL_EDITS) {
  const abs = join(DATA, "icons", iconPath);
  const svg = readFileSync(abs, "utf-8");
  const before = findRootAttr(svg, attr);
  const targetSvg = replaceRootAttr(svg, attr, to);
  pushRaw({
    category: "real_icon_attr",
    instruction: instr,
    initial_svg: svg,
    target_svg: targetSvg,
    initial_spec: { source: iconPath, canvas: [24, 24], bg: null, parts: [] },
    target_spec: { source: iconPath, canvas: [24, 24], bg: null, parts: [], rootAttrChange: { attr, before, after: to } },
    parts: ["icon"],
    target_parts: ["icon"],
    expected_diff: [{ part: "icon", attribute: attr, before, after: to }],
    should_preserve: ["path-geometry"],
  });
}

// ---- 6 ADVERSARIAL PRESERVATION -----------------------------------------
const adversarial = [
  // 1. 8 hearts in a row, recolor only #5.
  () => {
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(place("heart", { id: `h${i + 1}`, x: 8 + i * 36, y: 16, size: 32, color: "#222" }));
    }
    return {
      initial: { canvas: [304, 64], bg: "white", parts },
      edit: (s) => recolor(s, "h5", "#e63946"),
      instr: "Eight identical hearts. Recolor ONLY h5 (the fifth one) red (#e63946). All seven other hearts must remain pixel-identical at #222.",
      targetIds: ["h5"],
    };
  },
  // 2. 3x3 grid of bells; recolor only the center bell.
  () => {
    const parts = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        parts.push(place("bell", { id: `b${r}${c}`, x: 16 + c * 56, y: 16 + r * 56, size: 48, color: "#222" }));
      }
    }
    return {
      initial: { canvas: [184, 184], bg: "white", parts },
      edit: (s) => recolor(s, "b11", "#3b82f6"),
      instr: "A 3×3 grid of identical bells. Recolor ONLY b11 (the center) blue (#3b82f6). All eight surrounding bells must remain at #222.",
      targetIds: ["b11"],
    };
  },
  // 3. Row of mixed icons; recolor only the one named "x-mark" sitting in slot 3 of 6.
  () => {
    const order = ["check", "plus", "x-mark", "minus", "check", "plus"];
    const parts = order.map((n, i) =>
      place(n, { id: `slot-${i + 1}-${n}`, x: 12 + i * 44, y: 16, size: 40, color: "#222" }),
    );
    return {
      initial: { canvas: [280, 72], bg: "white", parts },
      edit: (s) => recolor(s, "slot-3-x-mark", "#e63946"),
      instr: "Six symbol icons: check, plus, x-mark, minus, check, plus. Recolor ONLY the x-mark in slot 3 (slot-3-x-mark) red (#e63946). All other icons stay at #222.",
      targetIds: ["slot-3-x-mark"],
    };
  },
  // 4. 4 clocks; rotate only clock #2's minute-hand.
  () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 48;
      parts.push(place("clock", { id: `clk-${i + 1}`, x, y: 16, size: 40, color: "#222" }));
      parts.push({ id: `min-${i + 1}`, type: "line", x1: x + 20, y1: 36, x2: x + 30, y2: 36, stroke: "#222", strokeWidth: 1.5 });
    }
    return {
      initial: { canvas: [200, 72], bg: "white", parts },
      edit: (s) => move(s, "min-2", { dx: -10, dy: 10 }),
      instr: "Four clocks in a row, each with an identical minute-hand pointing right. Rotate ONLY clock-2's minute-hand to point down-left: shift x2 by -10 AND y2 by +10. The other three minute-hands and ALL clock faces must remain pixel-identical.",
      targetIds: ["min-2"],
    };
  },
  // 5. 5 envelopes; add a badge on ONLY the last one.
  () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      parts.push(place("envelope", { id: `env-${i + 1}`, x: 12 + i * 50, y: 24, size: 44, color: "#222" }));
    }
    const badge = { id: "badge-5", type: "circle", cx: 254 - 16, cy: 30, r: 4, fill: "#e63946" };
    return {
      initial: { canvas: [262, 96], bg: "white", parts },
      edit: (s) => addPart(s, badge),
      instr: "Five identical envelopes. Add an unread badge (red circle r=4, fill #e63946) ONLY on the fifth envelope at cx=238, cy=30. The other four envelopes must remain pixel-identical.",
      targetIds: ["badge-5"],
    };
  },
  // 6. House scene with a duplicated decoy door; remove the decoy only.
  () => {
    const initial = SCENES.house();
    // add a decoy door of identical color but at a different position
    initial.parts.push({ id: "decoy-door", type: "rect", x: 16, y: 78, width: 16, height: 30, fill: "#6a3819" });
    return {
      initial,
      edit: (s) => deletePart(s, "decoy-door"),
      instr: "The house has TWO doors of identical color: the real one (id 'door' at x=56) and a decoy (id 'decoy-door' at x=16). Remove ONLY the decoy. The real door, window, chimney, doorknob, and home outline must remain pixel-identical.",
      targetIds: ["decoy-door"],
    };
  },
];

for (const buildFn of adversarial) {
  const { initial, edit, instr, targetIds } = buildFn();
  make({
    category: "adversarial_preservation",
    initialSpec: initial,
    edit,
    instruction: instr,
    targetIds,
  });
}

const tasks = write(OUT);
console.log(`very_hard: wrote ${tasks.length} tasks`);
