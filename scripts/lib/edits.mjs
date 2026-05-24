// Edit operations.
//
// Each op takes a spec + the id of the part to edit + params, and returns
//   { spec: newSpec, diff: [{ part, attribute, before, after }] }
// where `diff` enumerates every attribute change. Edits never mutate the
// input — they return fresh specs so callers can diff freely.

import { cloneSpec } from "./render.mjs";

const findObject = (spec, id) => {
  const o = spec.objects.find((x) => x.id === id);
  if (!o) throw new Error(`no object with id ${id}`);
  return o;
};

export const colorEdit = (spec, id, { fill }) => {
  const next = cloneSpec(spec);
  const o = findObject(next, id);
  const before = o.fill;
  o.fill = fill;
  return {
    spec: next,
    diff: [{ part: id, attribute: "fill", before, after: fill }],
  };
};

export const strokeEdit = (spec, id, { stroke, strokeWidth = 4 }) => {
  const next = cloneSpec(spec);
  const o = findObject(next, id);
  const diff = [];
  if (o.stroke !== stroke) {
    diff.push({ part: id, attribute: "stroke", before: o.stroke ?? null, after: stroke });
    o.stroke = stroke;
  }
  if ((o.strokeWidth ?? 0) !== strokeWidth) {
    diff.push({
      part: id,
      attribute: "stroke-width",
      before: o.strokeWidth ?? null,
      after: strokeWidth,
    });
    o.strokeWidth = strokeWidth;
  }
  return { spec: next, diff };
};

// Move by (dx, dy) — works for any shape because we touch only positional
// attributes that exist on the object.
export const moveEdit = (spec, id, { dx = 0, dy = 0 }) => {
  const next = cloneSpec(spec);
  const o = findObject(next, id);
  const diff = [];
  const move1d = (attr, delta) => {
    if (o[attr] === undefined) return;
    const before = o[attr];
    o[attr] = before + delta;
    diff.push({ part: id, attribute: attr, before, after: o[attr] });
  };
  if (o.type === "polygon") {
    const before = o.points.map((p) => [...p]);
    o.points = o.points.map(([x, y]) => [x + dx, y + dy]);
    diff.push({ part: id, attribute: "points", before, after: o.points });
  } else {
    move1d("cx", dx);
    move1d("cy", dy);
    move1d("x", dx);
    move1d("y", dy);
    move1d("x1", dx);
    move1d("y1", dy);
    move1d("x2", dx);
    move1d("y2", dy);
  }
  return { spec: next, diff };
};

// Scale by `factor` around the object's own center. Returns a diff that
// lists the changed size attributes only (position stays the same after
// centering correction).
export const resizeEdit = (spec, id, { factor }) => {
  const next = cloneSpec(spec);
  const o = findObject(next, id);
  const diff = [];
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
      // scale around center
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
    case "polygon": {
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
      throw new Error(`resize unsupported for type ${o.type}`);
  }
  return { spec: next, diff };
};

export const deleteEdit = (spec, id) => {
  const next = cloneSpec(spec);
  const idx = next.objects.findIndex((o) => o.id === id);
  if (idx < 0) throw new Error(`no object with id ${id}`);
  const removed = next.objects[idx];
  next.objects.splice(idx, 1);
  return {
    spec: next,
    diff: [{ part: id, attribute: "exists", before: true, after: false, removed }],
  };
};

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
