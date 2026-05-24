// Higher-level edit ops built on top of edits.mjs.
//
// These compose primitive ops or apply set-based transforms. Each op still
// returns { spec, diff } so the task pipeline doesn't care which tier of
// operation produced the diff.

import { cloneSpec } from "./render.mjs";
import { colorEdit, strokeEdit, moveEdit, resizeEdit, deleteEdit } from "./edits.mjs";

// Chain ops on a single spec. Each `step` is { op, target, params }.
//   op:     "color" | "stroke" | "move" | "resize" | "delete"
//   target: object id to edit
//   params: op-specific params (e.g. { fill: "blue" })
export const multiEdit = (spec, steps) => {
  let cur = spec;
  const diff = [];
  for (const step of steps) {
    const fn = OP_MAP[step.op];
    if (!fn) throw new Error(`unknown op ${step.op}`);
    const out = fn(cur, step.target, step.params ?? {});
    cur = out.spec;
    diff.push(...out.diff);
  }
  return { spec: cur, diff };
};

const OP_MAP = {
  color: colorEdit,
  stroke: strokeEdit,
  move: moveEdit,
  resize: resizeEdit,
  delete: (s, id) => deleteEdit(s, id),
};

// Recolor every object matching a predicate.
export const recolorMatching = (spec, predicate, newFill) => {
  const next = cloneSpec(spec);
  const diff = [];
  for (const o of next.objects) {
    if (predicate(o)) {
      const before = o.fill;
      if (before !== newFill) {
        o.fill = newFill;
        diff.push({ part: o.id, attribute: "fill", before, after: newFill });
      }
    }
  }
  return { spec: next, diff };
};

// Delete every object whose id is in `ids`.
export const deleteMany = (spec, ids) => {
  const next = cloneSpec(spec);
  const diff = [];
  for (const id of ids) {
    const idx = next.objects.findIndex((o) => o.id === id);
    if (idx < 0) continue;
    const removed = next.objects[idx];
    next.objects.splice(idx, 1);
    diff.push({ part: id, attribute: "exists", before: true, after: false, removed });
  }
  return { spec: next, diff };
};

// Keep only the listed ids (used for simplification tasks).
export const keepOnly = (spec, ids) => {
  const next = cloneSpec(spec);
  const diff = [];
  const keep = new Set(ids);
  const survivors = [];
  for (const o of next.objects) {
    if (keep.has(o.id)) {
      survivors.push(o);
    } else {
      diff.push({ part: o.id, attribute: "exists", before: true, after: false, removed: o });
    }
  }
  next.objects = survivors;
  return { spec: next, diff };
};

// Apply a uniform stroke to every object in the scene. Useful for
// "outline everything in black" constraint tasks.
export const strokeAll = (spec, stroke, strokeWidth = 2) => {
  const next = cloneSpec(spec);
  const diff = [];
  for (const o of next.objects) {
    const wasStroke = o.stroke;
    const wasW = o.strokeWidth;
    if (wasStroke !== stroke) {
      diff.push({ part: o.id, attribute: "stroke", before: wasStroke ?? null, after: stroke });
      o.stroke = stroke;
    }
    if ((wasW ?? 0) !== strokeWidth) {
      diff.push({ part: o.id, attribute: "stroke-width", before: wasW ?? null, after: strokeWidth });
      o.strokeWidth = strokeWidth;
    }
  }
  return { spec: next, diff };
};

// Repair: shift the canvas so an out-of-bounds object becomes visible.
// We model this by changing the spec's `canvas` (= viewBox) dims.
export const repairViewBox = (spec, [newW, newH]) => {
  const next = cloneSpec(spec);
  const [oldW, oldH] = next.canvas;
  next.canvas = [newW, newH];
  return {
    spec: next,
    diff: [
      { part: "__svg", attribute: "viewBox", before: [0, 0, oldW, oldH], after: [0, 0, newW, newH] },
    ],
  };
};

// Repair: align an object to a target reference position.
export const alignTo = (spec, id, { x, y }) => {
  const next = cloneSpec(spec);
  const o = next.objects.find((x) => x.id === id);
  if (!o) throw new Error(`no object with id ${id}`);
  const diff = [];
  const set = (attr, val) => {
    if (o[attr] === undefined || val === undefined) return;
    const before = o[attr];
    o[attr] = val;
    diff.push({ part: id, attribute: attr, before, after: val });
  };
  set("x", x);
  set("y", y);
  set("cx", x);
  set("cy", y);
  return { spec: next, diff };
};
