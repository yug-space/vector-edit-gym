// Edits over real-icon-grounded scene specs.
//
// Every op returns { spec, diff } where diff is a list of
// { part, attribute, before, after } records. `part` is the element id;
// "__svg" is used for canvas-level changes.

import { cloneSpec } from "./icon-render.mjs";

const findRef = (spec, id) => {
  if (spec.base?.id === id) return { container: "base", obj: spec.base };
  const idx = (spec.parts ?? []).findIndex((p) => p.id === id);
  if (idx >= 0) return { container: "parts", obj: spec.parts[idx], idx };
  return null;
};

const isIconLike = (o) => o.type === "icon" || o.source !== undefined;

// ---- color ----------------------------------------------------------------
// For real icons: change `color` (drives currentColor in inner paths).
// For primitive parts: change `fill`.
export const recolor = (spec, id, value) => {
  const next = cloneSpec(spec);
  const ref = findRef(next, id);
  if (!ref) throw new Error(`no part ${id}`);
  const o = ref.obj;
  if (isIconLike(o) || ref.container === "base") {
    const before = o.color;
    o.color = value;
    return { spec: next, diff: [{ part: id, attribute: "color", before, after: value }] };
  }
  const before = o.fill;
  o.fill = value;
  return { spec: next, diff: [{ part: id, attribute: "fill", before, after: value }] };
};

// ---- stroke (color + width) ----------------------------------------------
export const restroke = (spec, id, { stroke, strokeWidth }) => {
  const next = cloneSpec(spec);
  const ref = findRef(next, id);
  if (!ref) throw new Error(`no part ${id}`);
  const o = ref.obj;
  const diff = [];
  if (stroke !== undefined) {
    if (isIconLike(o) || ref.container === "base") {
      const before = o.color;
      o.color = stroke;
      diff.push({ part: id, attribute: "color", before, after: stroke });
    } else {
      const before = o.stroke ?? null;
      o.stroke = stroke;
      diff.push({ part: id, attribute: "stroke", before, after: stroke });
    }
  }
  if (strokeWidth !== undefined) {
    const before = o.strokeWidth ?? null;
    o.strokeWidth = strokeWidth;
    diff.push({ part: id, attribute: "stroke-width", before, after: strokeWidth });
  }
  return { spec: next, diff };
};

// ---- move -----------------------------------------------------------------
export const move = (spec, id, { dx = 0, dy = 0 }) => {
  const next = cloneSpec(spec);
  const ref = findRef(next, id);
  if (!ref) throw new Error(`no part ${id}`);
  const o = ref.obj;
  const diff = [];
  const set = (attr, delta) => {
    if (o[attr] === undefined || delta === 0) return;
    const before = o[attr];
    o[attr] = before + delta;
    diff.push({ part: id, attribute: attr, before, after: o[attr] });
  };
  if (o.type === "polygon" || o.type === "polyline") {
    const before = o.points.map((q) => [...q]);
    o.points = o.points.map(([x, y]) => [x + dx, y + dy]);
    diff.push({ part: id, attribute: "points", before, after: o.points });
  } else {
    set("x", dx);
    set("y", dy);
    set("cx", dx);
    set("cy", dy);
    set("x1", dx);
    set("y1", dy);
    set("x2", dx);
    set("y2", dy);
  }
  return { spec: next, diff };
};

// ---- resize ---------------------------------------------------------------
export const resize = (spec, id, { factor }) => {
  const next = cloneSpec(spec);
  const ref = findRef(next, id);
  if (!ref) throw new Error(`no part ${id}`);
  const o = ref.obj;
  const diff = [];
  if (isIconLike(o) || ref.container === "base") {
    const before = o.size;
    o.size = +(before * factor).toFixed(2);
    // recenter so growth is around current center
    const dx = (before - o.size) / 2;
    o.x = +(o.x + dx).toFixed(2);
    o.y = +(o.y + dx).toFixed(2);
    diff.push({ part: id, attribute: "size", before, after: o.size });
    return { spec: next, diff };
  }
  const scale = (attr) => {
    if (o[attr] === undefined) return;
    const before = o[attr];
    o[attr] = +(before * factor).toFixed(2);
    diff.push({ part: id, attribute: attr, before, after: o[attr] });
  };
  switch (o.type) {
    case "circle":
      scale("r");
      break;
    case "ellipse":
      scale("rx");
      scale("ry");
      break;
    case "rect": {
      const cx = o.x + o.width / 2;
      const cy = o.y + o.height / 2;
      const beforeW = o.width;
      const beforeH = o.height;
      const beforeX = o.x;
      const beforeY = o.y;
      o.width = +(beforeW * factor).toFixed(2);
      o.height = +(beforeH * factor).toFixed(2);
      o.x = +(cx - o.width / 2).toFixed(2);
      o.y = +(cy - o.height / 2).toFixed(2);
      diff.push({ part: id, attribute: "width", before: beforeW, after: o.width });
      diff.push({ part: id, attribute: "height", before: beforeH, after: o.height });
      diff.push({ part: id, attribute: "x", before: beforeX, after: o.x });
      diff.push({ part: id, attribute: "y", before: beforeY, after: o.y });
      break;
    }
    case "polygon":
    case "polyline": {
      const cx = avg(o.points.map((p) => p[0]));
      const cy = avg(o.points.map((p) => p[1]));
      const before = o.points.map((p) => [...p]);
      o.points = o.points.map(([x, y]) => [
        +(cx + (x - cx) * factor).toFixed(2),
        +(cy + (y - cy) * factor).toFixed(2),
      ]);
      diff.push({ part: id, attribute: "points", before, after: o.points });
      break;
    }
    default:
      throw new Error(`resize not supported on ${o.type}`);
  }
  return { spec: next, diff };
};

// ---- delete a part -------------------------------------------------------
export const deletePart = (spec, id) => {
  const next = cloneSpec(spec);
  const idx = (next.parts ?? []).findIndex((p) => p.id === id);
  if (idx < 0) throw new Error(`no part ${id} to delete`);
  const removed = next.parts[idx];
  next.parts.splice(idx, 1);
  return { spec: next, diff: [{ part: id, attribute: "exists", before: true, after: false, removed }] };
};

// ---- add a part ----------------------------------------------------------
// Caller supplies the spec for the part to add. This is how "draw the
// missing X" tasks are encoded: initial omits the part; target appends it;
// the model must produce that exact part.
export const addPart = (spec, partSpec) => {
  const next = cloneSpec(spec);
  next.parts = next.parts ?? [];
  next.parts.push(partSpec);
  return {
    spec: next,
    diff: [{ part: partSpec.id, attribute: "exists", before: false, after: true, added: partSpec }],
  };
};

// ---- chain ---------------------------------------------------------------
const OPS = { color: recolor, stroke: restroke, move, resize, delete: (s, id) => deletePart(s, id), add: (s, _id, p) => addPart(s, p.partSpec) };
export const chain = (spec, steps) => {
  let cur = spec;
  const diff = [];
  for (const st of steps) {
    const fn = OPS[st.op];
    if (!fn) throw new Error(`unknown op ${st.op}`);
    const out = st.op === "color" ? fn(cur, st.target, st.params.value)
              : st.op === "delete" ? fn(cur, st.target)
              : st.op === "add"    ? fn(cur, null, st.params)
              : fn(cur, st.target, st.params ?? {});
    cur = out.spec;
    diff.push(...out.diff);
  }
  return { spec: cur, diff };
};

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
