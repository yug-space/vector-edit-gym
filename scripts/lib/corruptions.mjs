// Corruption operations.
//
// Each fn takes a CLEAN scene spec and returns:
//   {
//     corrupted,   // the broken spec to use as initial_svg
//     fix,         // (cleanSpec) => { spec, diff }  — applied to the
//                  // corrupted spec, restores the clean version and emits
//                  // the diff that represents the FIX (not the breakage).
//     params,      // metadata about what was broken (used by NL templates)
//   }
//
// Convention: the clean scene is always the target. Generators render the
// corrupted spec as initial_svg, the clean spec as target_svg, and apply
// `fix` to verify the diff structure.

import { cloneSpec } from "./icon-render.mjs";

// ---- 1) MISSING PART -----------------------------------------------------
// Remove ONE labeled part from a composite scene. Fix = put it back.
export const corruptMissingPart = (clean, partId) => {
  const corrupted = cloneSpec(clean);
  const idx = (corrupted.parts ?? []).findIndex((p) => p.id === partId);
  if (idx < 0) throw new Error(`no part ${partId}`);
  const removed = corrupted.parts.splice(idx, 1)[0];
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      next.parts = [...(next.parts ?? []), removed];
      return {
        spec: next,
        diff: [{ part: partId, attribute: "exists", before: false, after: true, added: removed }],
      };
    },
    params: { kind: "missing_part", part: partId, removed },
  };
};

// ---- 2) EXTRA PART -------------------------------------------------------
// Inject a stray part. Fix = remove it.
export const corruptExtraPart = (clean, extraPart) => {
  const corrupted = cloneSpec(clean);
  corrupted.parts = [...(corrupted.parts ?? []), extraPart];
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      next.parts = (next.parts ?? []).filter((p) => p.id !== extraPart.id);
      return {
        spec: next,
        diff: [{ part: extraPart.id, attribute: "exists", before: true, after: false, removed: extraPart }],
      };
    },
    params: { kind: "extra_part", part: extraPart.id, extra: extraPart },
  };
};

// ---- 3) DISPLACED PART ---------------------------------------------------
// Offset one part. Fix = slide it back.
export const corruptDisplacedPart = (clean, partId, { dx, dy }) => {
  const corrupted = cloneSpec(clean);
  const p = corrupted.parts.find((x) => x.id === partId);
  if (!p) throw new Error(`no part ${partId}`);
  for (const k of ["cx", "x", "x1", "x2"]) if (p[k] !== undefined) p[k] += dx;
  for (const k of ["cy", "y", "y1", "y2"]) if (p[k] !== undefined) p[k] += dy;
  if (p.points) p.points = p.points.map(([x, y]) => [x + dx, y + dy]);
  const fixDx = -dx, fixDy = -dy;
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.parts.find((x) => x.id === partId);
      const diff = [];
      const move1 = (attr, delta) => {
        if (t[attr] === undefined || delta === 0) return;
        const before = t[attr];
        t[attr] = before + delta;
        diff.push({ part: partId, attribute: attr, before, after: t[attr] });
      };
      if (t.points) {
        const before = t.points.map((q) => [...q]);
        t.points = t.points.map(([x, y]) => [x + fixDx, y + fixDy]);
        diff.push({ part: partId, attribute: "points", before, after: t.points });
      } else {
        move1("x", fixDx); move1("cx", fixDx); move1("x1", fixDx); move1("x2", fixDx);
        move1("y", fixDy); move1("cy", fixDy); move1("y1", fixDy); move1("y2", fixDy);
      }
      return { spec: next, diff };
    },
    params: { kind: "displaced", part: partId, dx, dy },
  };
};

// ---- 4) MISCOLORED PART --------------------------------------------------
// Paint a part the wrong color. Fix = repaint to original.
export const corruptMiscolorPart = (clean, partId, wrongColor) => {
  const corrupted = cloneSpec(clean);
  const p = corrupted.parts.find((x) => x.id === partId);
  if (!p) throw new Error(`no part ${partId}`);
  const isStrokey = p.type === "line" || p.type === "polyline";
  const isIcon = p.type === "icon";
  const attr = isIcon ? "color" : isStrokey ? "stroke" : "fill";
  const originalColor = p[attr];
  p[attr] = wrongColor;
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.parts.find((x) => x.id === partId);
      t[attr] = originalColor;
      return {
        spec: next,
        diff: [{ part: partId, attribute: attr, before: wrongColor, after: originalColor }],
      };
    },
    params: { kind: "miscolor", part: partId, wrongColor, originalColor, attr },
  };
};

// ---- 5) WRONG ROOT COLOR (single icon) -----------------------------------
// Change the `color` of a single base icon. Fix = restore.
export const corruptIconColor = (clean, wrongColor, originalColor = "#222") => {
  const corrupted = cloneSpec(clean);
  // single-icon scenes hold the icon as parts[0] (no base) OR as base
  const target = corrupted.base ?? corrupted.parts.find((p) => p.type === "icon");
  if (!target) throw new Error("no icon target");
  target.color = wrongColor;
  const id = target.id;
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.base?.id === id ? next.base : next.parts.find((p) => p.id === id);
      t.color = originalColor;
      return { spec: next, diff: [{ part: id, attribute: "color", before: wrongColor, after: originalColor }] };
    },
    params: { kind: "wrong_color", iconId: id, wrongColor, originalColor },
  };
};

// ---- 6) WRONG STROKE-WIDTH (single icon) ---------------------------------
export const corruptStrokeWidth = (clean, wrongWidth, originalWidth = 1.5) => {
  const corrupted = cloneSpec(clean);
  const target = corrupted.base ?? corrupted.parts.find((p) => p.type === "icon");
  target.strokeWidth = wrongWidth;
  // ensure clean has the original value set explicitly so diffs are unambiguous
  const id = target.id;
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.base?.id === id ? next.base : next.parts.find((p) => p.id === id);
      t.strokeWidth = originalWidth;
      return { spec: next, diff: [{ part: id, attribute: "stroke-width", before: wrongWidth, after: originalWidth }] };
    },
    params: { kind: "wrong_stroke_width", iconId: id, wrongWidth, originalWidth },
  };
};

// ---- 7) WRONG SCALE (single icon) ----------------------------------------
export const corruptScale = (clean, wrongSize, originalSize) => {
  const corrupted = cloneSpec(clean);
  const target = corrupted.base ?? corrupted.parts.find((p) => p.type === "icon");
  const id = target.id;
  // recenter so growth/shrink is around current center
  const cx = target.x + target.size / 2;
  const cy = target.y + target.size / 2;
  target.size = wrongSize;
  target.x = +(cx - wrongSize / 2).toFixed(2);
  target.y = +(cy - wrongSize / 2).toFixed(2);
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.base?.id === id ? next.base : next.parts.find((p) => p.id === id);
      const bx = t.x, by = t.y;
      const fcx = t.x + t.size / 2;
      const fcy = t.y + t.size / 2;
      t.size = originalSize;
      t.x = +(fcx - originalSize / 2).toFixed(2);
      t.y = +(fcy - originalSize / 2).toFixed(2);
      return {
        spec: next,
        diff: [
          { part: id, attribute: "size", before: wrongSize, after: originalSize },
          { part: id, attribute: "x", before: bx, after: t.x },
          { part: id, attribute: "y", before: by, after: t.y },
        ],
      };
    },
    params: { kind: "wrong_scale", iconId: id, wrongSize, originalSize },
  };
};

// ---- 8) CLIPPED VIEWBOX --------------------------------------------------
// Shrink the canvas so part of the icon falls outside. Fix = expand.
export const corruptClippedViewBox = (clean, clippedW, clippedH) => {
  const corrupted = cloneSpec(clean);
  const [origW, origH] = corrupted.canvas;
  corrupted.canvas = [clippedW, clippedH];
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      next.canvas = [origW, origH];
      return {
        spec: next,
        diff: [{ part: "__svg", attribute: "viewBox", before: [0, 0, clippedW, clippedH], after: [0, 0, origW, origH] }],
      };
    },
    params: { kind: "clipped_viewbox", clippedW, clippedH, origW, origH },
  };
};

// ---- 9) FLIPPED PART (horizontal mirror within own bounds) ----------------
// For symmetric parts, flip in place. Fix = flip back.
export const corruptFlippedPart = (clean, partId) => {
  const corrupted = cloneSpec(clean);
  const p = corrupted.parts.find((x) => x.id === partId);
  if (!p) throw new Error(`no part ${partId}`);
  const flip = (p) => {
    if (p.type === "polygon" || p.type === "polyline") {
      const cx = p.points.reduce((a, [x]) => a + x, 0) / p.points.length;
      const before = p.points.map((q) => [...q]);
      p.points = p.points.map(([x, y]) => [2 * cx - x, y]);
      return { attr: "points", before, after: p.points };
    }
    if (p.type === "line") {
      const cx = (p.x1 + p.x2) / 2;
      const bx1 = p.x1, bx2 = p.x2;
      p.x1 = 2 * cx - bx1;
      p.x2 = 2 * cx - bx2;
      return { attrs: [["x1", bx1, p.x1], ["x2", bx2, p.x2]] };
    }
    return null;
  };
  flip(p);
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      const t = next.parts.find((x) => x.id === partId);
      const r = flip(t);
      const diff = [];
      if (r?.attr === "points") {
        diff.push({ part: partId, attribute: "points", before: r.before, after: r.after });
      } else if (r?.attrs) {
        for (const [a, b, af] of r.attrs) diff.push({ part: partId, attribute: a, before: b, after: af });
      }
      return { spec: next, diff };
    },
    params: { kind: "flipped", part: partId },
  };
};

// ---- 10) DUPLICATED PART -------------------------------------------------
// Add a duplicate copy of an existing part at a small offset. Fix = remove it.
export const corruptDuplicatePart = (clean, sourceId, { dx = 10, dy = 0 } = {}) => {
  const corrupted = cloneSpec(clean);
  const src = corrupted.parts.find((p) => p.id === sourceId);
  if (!src) throw new Error(`no part ${sourceId}`);
  const dup = cloneSpec(src);
  dup.id = `${sourceId}-dup`;
  for (const k of ["cx", "x", "x1", "x2"]) if (dup[k] !== undefined) dup[k] += dx;
  for (const k of ["cy", "y", "y1", "y2"]) if (dup[k] !== undefined) dup[k] += dy;
  if (dup.points) dup.points = dup.points.map(([x, y]) => [x + dx, y + dy]);
  corrupted.parts.push(dup);
  return {
    corrupted,
    fix: (s) => {
      const next = cloneSpec(s);
      next.parts = next.parts.filter((p) => p.id !== dup.id);
      return {
        spec: next,
        diff: [{ part: dup.id, attribute: "exists", before: true, after: false, removed: dup }],
      };
    },
    params: { kind: "duplicate", sourceId, dupId: dup.id },
  };
};

// ---- 11) MULTI-CORRUPTION (Hard / Very Hard) ----------------------------
// Compose two corruptions. Their fixes are chained; both diffs merge.
export const corruptMulti = (clean, ops) => {
  // ops: [(clean) => corruption]
  let cur = clean;
  const fixes = [];
  const params = [];
  for (const op of ops) {
    const { corrupted, fix, params: p } = op(cur);
    cur = corrupted;
    fixes.unshift(fix); // apply in reverse so the first corruption fixes first
    params.push(p);
  }
  return {
    corrupted: cur,
    fix: (s) => {
      let spec = s;
      const diff = [];
      // The corruptions were applied in given order. Their fix diffs together
      // restore the original. We apply fixes in reverse order so the closest
      // corruption is undone first; the diff orientation is still
      // before→after the FIX.
      for (const f of fixes) {
        const out = f(spec);
        spec = out.spec;
        diff.push(...out.diff);
      }
      return { spec, diff };
    },
    params: { kind: "multi", parts: params },
  };
};
