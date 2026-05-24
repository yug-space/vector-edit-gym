// Curated catalog: semantic name → scraped SVG path + default style hints.
//
// Generators reference icons by semantic name so instructions read naturally
// ("recolor the heart", not "recolor heroicons/outline/heart.svg").
//
// `style` lets us hint how the icon paints: outline icons take a stroke
// color, solid icons take a fill color. The wrapper sets `currentColor` for
// both via `style="color: ..."`, so we don't actually have to branch when
// recoloring — but knowing the style is useful for instruction phrasing.

export const ICONS = {
  // household / scenes
  home:          { source: "heroicons/outline/home.svg",         style: "outline", category: "household" },
  fire:          { source: "heroicons/outline/fire.svg",         style: "outline", category: "household" },
  "light-bulb":  { source: "heroicons/outline/light-bulb.svg",   style: "outline", category: "household" },
  key:           { source: "heroicons/outline/key.svg",          style: "outline", category: "household" },
  "lock-closed": { source: "heroicons/outline/lock-closed.svg",  style: "outline", category: "household" },

  // weather / nature
  sun:           { source: "heroicons/outline/sun.svg",          style: "outline", category: "weather" },
  moon:          { source: "heroicons/outline/moon.svg",         style: "outline", category: "weather" },
  cloud:         { source: "heroicons/outline/cloud.svg",        style: "outline", category: "weather" },
  star:          { source: "heroicons/outline/star.svg",         style: "outline", category: "weather" },
  beaker:        { source: "heroicons/outline/beaker.svg",       style: "outline", category: "weather" },

  // communication
  bell:          { source: "heroicons/outline/bell.svg",         style: "outline", category: "comm" },
  envelope:      { source: "heroicons/outline/envelope.svg",     style: "outline", category: "comm" },
  phone:         { source: "heroicons/outline/phone.svg",        style: "outline", category: "comm" },
  microphone:    { source: "heroicons/outline/microphone.svg",   style: "outline", category: "comm" },

  // shopping / commerce
  "shopping-cart": { source: "heroicons/outline/shopping-cart.svg", style: "outline", category: "shop" },
  gift:          { source: "heroicons/outline/gift.svg",         style: "outline", category: "shop" },
  tag:           { source: "heroicons/outline/tag.svg",          style: "outline", category: "shop" },
  truck:         { source: "heroicons/outline/truck.svg",        style: "outline", category: "shop" },

  // ui / system
  cog:           { source: "heroicons/outline/cog-6-tooth.svg",  style: "outline", category: "ui" },
  trash:         { source: "heroicons/outline/trash.svg",        style: "outline", category: "ui" },
  "magnifying-glass": { source: "heroicons/outline/magnifying-glass.svg", style: "outline", category: "ui" },
  "globe-alt":   { source: "heroicons/outline/globe-alt.svg",    style: "outline", category: "ui" },
  camera:        { source: "heroicons/outline/camera.svg",       style: "outline", category: "ui" },
  photo:         { source: "heroicons/outline/photo.svg",        style: "outline", category: "ui" },

  // people / icons of icons
  user:          { source: "heroicons/outline/user.svg",         style: "outline", category: "person" },
  users:         { source: "heroicons/outline/users.svg",        style: "outline", category: "person" },
  "face-smile":  { source: "heroicons/outline/face-smile.svg",   style: "outline", category: "person" },

  // documents
  document:      { source: "heroicons/outline/document.svg",     style: "outline", category: "doc" },
  folder:        { source: "heroicons/outline/folder.svg",       style: "outline", category: "doc" },
  bookmark:      { source: "heroicons/outline/bookmark.svg",     style: "outline", category: "doc" },

  // symbols / status
  heart:         { source: "heroicons/outline/heart.svg",        style: "outline", category: "symbol" },
  flag:          { source: "heroicons/outline/flag.svg",         style: "outline", category: "symbol" },
  check:         { source: "heroicons/outline/check.svg",        style: "outline", category: "symbol" },
  "x-mark":      { source: "heroicons/outline/x-mark.svg",       style: "outline", category: "symbol" },
  plus:          { source: "heroicons/outline/plus.svg",         style: "outline", category: "symbol" },
  minus:         { source: "heroicons/outline/minus.svg",        style: "outline", category: "symbol" },

  // visualization
  "chart-bar":   { source: "heroicons/outline/chart-bar.svg",    style: "outline", category: "viz" },
  "chart-pie":   { source: "heroicons/outline/chart-pie.svg",    style: "outline", category: "viz" },

  // time
  clock:         { source: "heroicons/outline/clock.svg",        style: "outline", category: "time" },
  calendar:      { source: "heroicons/outline/calendar.svg",     style: "outline", category: "time" },

  // navigation
  "map-pin":     { source: "heroicons/outline/map-pin.svg",      style: "outline", category: "nav" },
  eye:           { source: "heroicons/outline/eye.svg",          style: "outline", category: "nav" },

  // solid variants — useful for "fill" tasks
  "heart-solid": { source: "heroicons/solid/heart.svg",          style: "solid", category: "symbol" },
  "star-solid":  { source: "heroicons/solid/star.svg",           style: "solid", category: "weather" },
};

export const iconNames = () => Object.keys(ICONS);

export const lookupIcon = (name) => {
  const e = ICONS[name];
  if (!e) throw new Error(`unknown icon: ${name}`);
  return e;
};

// Convenience: build an icon part (type:"icon") that the renderer/edits accept.
export const place = (name, { id, x = 0, y = 0, size = 96, color = "#222", strokeWidth } = {}) => {
  const entry = lookupIcon(name);
  return {
    id: id ?? name,
    type: "icon",
    source: entry.source,
    name,
    style: entry.style,
    x,
    y,
    size,
    color,
    ...(strokeWidth !== undefined ? { strokeWidth } : {}),
  };
};
