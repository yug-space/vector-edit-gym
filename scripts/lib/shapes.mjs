// Factory helpers for the primitive shapes used in Very Easy tasks.

export const circle = (id, { cx = 64, cy = 64, r = 28, fill = "red" } = {}) => ({
  id,
  type: "circle",
  cx,
  cy,
  r,
  fill,
});

export const rect = (id, { x = 44, y = 44, width = 40, height = 40, fill = "blue" } = {}) => ({
  id,
  type: "rect",
  x,
  y,
  width,
  height,
  fill,
});

export const triangle = (id, { cx = 64, cy = 64, size = 32, fill = "green" } = {}) => ({
  id,
  type: "polygon",
  points: [
    [cx, cy - size],
    [cx + size, cy + size],
    [cx - size, cy + size],
  ],
  fill,
});

export const ellipse = (id, { cx = 64, cy = 64, rx = 36, ry = 24, fill = "purple" } = {}) => ({
  id,
  type: "ellipse",
  cx,
  cy,
  rx,
  ry,
  fill,
});
