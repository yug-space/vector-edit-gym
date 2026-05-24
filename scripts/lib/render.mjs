// Render a structured spec into an SVG string.
//
// A spec looks like:
//   {
//     canvas: [128, 128],
//     bg: "white",                // optional background fill
//     objects: [
//       { id: "circle",   type: "circle",   cx: 64, cy: 64, r: 32, fill: "red" },
//       { id: "square",   type: "rect",     x: 20, y: 20, width: 40, height: 40, fill: "blue" },
//       { id: "triangle", type: "polygon",  points: [[64,20],[100,100],[28,100]], fill: "green" },
//       { id: "line",     type: "line",     x1: 10, y1: 10, x2: 100, y2: 100, stroke: "black", strokeWidth: 4 }
//     ]
//   }
//
// Each object's `id` becomes the element's `id=` attribute so downstream
// diffing can target it without ambiguity.

const xmlAttrs = (attrs) =>
  Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(" ");

const escapeAttr = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const baseAttrs = (o) => {
  const out = { id: o.id };
  if (o.fill !== undefined) out.fill = o.fill;
  if (o.stroke !== undefined) out.stroke = o.stroke;
  if (o.strokeWidth !== undefined) out["stroke-width"] = o.strokeWidth;
  if (o.opacity !== undefined) out.opacity = o.opacity;
  return out;
};

const renderObject = (o) => {
  switch (o.type) {
    case "circle":
      return `<circle ${xmlAttrs({ ...baseAttrs(o), cx: o.cx, cy: o.cy, r: o.r })} />`;
    case "ellipse":
      return `<ellipse ${xmlAttrs({ ...baseAttrs(o), cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry })} />`;
    case "rect":
      return `<rect ${xmlAttrs({
        ...baseAttrs(o),
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rx: o.rx,
        ry: o.ry,
      })} />`;
    case "polygon":
      return `<polygon ${xmlAttrs({
        ...baseAttrs(o),
        points: o.points.map((p) => p.join(",")).join(" "),
      })} />`;
    case "line":
      return `<line ${xmlAttrs({
        ...baseAttrs(o),
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
      })} />`;
    default:
      throw new Error(`Unknown object type: ${o.type}`);
  }
};

export const renderSpec = (spec) => {
  const [w, h] = spec.canvas;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
  ];
  if (spec.bg) {
    parts.push(`<rect id="__bg" x="0" y="0" width="${w}" height="${h}" fill="${spec.bg}" />`);
  }
  for (const o of spec.objects) parts.push("  " + renderObject(o));
  parts.push("</svg>");
  return parts.join("\n");
};

// Deep clone helper used by edit operations.
export const cloneSpec = (spec) => JSON.parse(JSON.stringify(spec));
