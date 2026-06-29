// Render real-icon-grounded scenes.
//
// Scene format:
//   {
//     canvas: [w, h],
//     bg: "white"            // optional
//     base: { id, source, x, y, size, color, strokeWidth }  // optional real icon background
//     parts: [
//       { id, type: "rect"|"circle"|"polygon"|"line"|"polyline"|"ellipse"|"path"|"icon", ... }
//     ]
//   }
//
// Real icons are loaded from data/icons/ (the scraped catalog) and wrapped
// in a <g id transform style="color:..."> so their `currentColor` paths
// inherit the chosen tint. Their root <svg> attrs (fill / stroke /
// stroke-width / stroke-linecap / stroke-linejoin) propagate to the wrapper.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, "..", "..", "data", "icons");

const cache = new Map();
const loadIcon = (rel) => {
  if (cache.has(rel)) return cache.get(rel);
  const txt = readFileSync(join(ICONS_DIR, rel), "utf-8");
  cache.set(rel, txt);
  return txt;
};

const ATTR_RE = /([a-zA-Z_:-]+)\s*=\s*"([^"]*)"/g;
const parseRootAttrs = (svgText) => {
  const m = svgText.match(/<svg\b([^>]*)>/);
  if (!m) return {};
  const out = {};
  let am;
  ATTR_RE.lastIndex = 0;
  while ((am = ATTR_RE.exec(m[1])) !== null) out[am[1]] = am[2];
  return out;
};

const getInner = (svgText) => {
  const m = svgText.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/);
  return m ? m[1].trim() : "";
};

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Wrap a real icon: returns the <g> fragment.
export const wrapIcon = ({ id, source, x = 0, y = 0, size = 96, color = "#222", strokeWidth }) => {
  const svgText = loadIcon(source);
  const root = parseRootAttrs(svgText);
  const inner = getInner(svgText);
  const vb = (root.viewBox || "0 0 24 24").split(/\s+/).map(Number);
  const vw = vb[2] || 24;
  const vh = vb[3] || 24;
  const scale = +(size / Math.max(vw, vh)).toFixed(4);
  const carry = [];
  for (const k of ["fill", "stroke", "stroke-linecap", "stroke-linejoin"]) {
    if (root[k] !== undefined) carry.push(`${k}="${escAttr(root[k])}"`);
  }
  const sw = strokeWidth !== undefined ? strokeWidth : root["stroke-width"];
  if (sw !== undefined) carry.push(`stroke-width="${escAttr(sw)}"`);
  return `<g id="${escAttr(id)}" data-source="${escAttr(source)}" transform="translate(${x}, ${y}) scale(${scale})" style="color: ${escAttr(color)}" ${carry.join(" ")}>${inner}</g>`;
};

// Render a primitive part. Mirrors render.mjs but kept local so the new
// pipeline doesn't share spec shapes with the legacy one.
const renderPart = (p) => {
  if (p.type === "icon") return wrapIcon(p);
  const base = `id="${escAttr(p.id)}"`;
  const paint = [];
  if (p.fill !== undefined) paint.push(`fill="${escAttr(p.fill)}"`);
  if (p.stroke !== undefined) paint.push(`stroke="${escAttr(p.stroke)}"`);
  if (p.strokeWidth !== undefined) paint.push(`stroke-width="${escAttr(p.strokeWidth)}"`);
  if (p.opacity !== undefined) paint.push(`opacity="${escAttr(p.opacity)}"`);
  switch (p.type) {
    case "rect":
      return `<rect ${base} ${paint.join(" ")} x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"${p.rx !== undefined ? ` rx="${p.rx}"` : ""}${p.ry !== undefined ? ` ry="${p.ry}"` : ""} />`;
    case "circle":
      return `<circle ${base} ${paint.join(" ")} cx="${p.cx}" cy="${p.cy}" r="${p.r}" />`;
    case "ellipse":
      return `<ellipse ${base} ${paint.join(" ")} cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" />`;
    case "polygon":
      return `<polygon ${base} ${paint.join(" ")} points="${p.points.map((q) => q.join(",")).join(" ")}" />`;
    case "line":
      return `<line ${base} ${paint.join(" ")} x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" />`;
    case "polyline": {
      const attrs = p.fill === undefined ? [...paint, `fill="none"`] : paint;
      return `<polyline ${base} ${attrs.join(" ")} points="${p.points.map((q) => q.join(",")).join(" ")}" />`;
    }
    case "path":
      return `<path ${base} ${paint.join(" ")} d="${escAttr(p.d)}" />`;
    default:
      throw new Error(`unknown part type ${p.type}`);
  }
};

export const renderScene = (spec) => {
  const [w, h] = spec.canvas;
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
  ];
  if (spec.bg) {
    out.push(`<rect id="__bg" x="0" y="0" width="${w}" height="${h}" fill="${spec.bg}" />`);
  }
  if (spec.base) out.push("  " + wrapIcon(spec.base));
  for (const p of spec.parts ?? []) out.push("  " + renderPart(p));
  out.push("</svg>");
  return out.join("\n");
};

export const cloneSpec = (s) => JSON.parse(JSON.stringify(s));

// Helper: gather every id in a scene (base + parts).
export const sceneIds = (spec) => {
  const ids = [];
  if (spec.base) ids.push(spec.base.id);
  for (const p of spec.parts ?? []) ids.push(p.id);
  return ids;
};
