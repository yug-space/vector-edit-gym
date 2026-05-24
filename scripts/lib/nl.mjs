// Natural-language phrasing for each corruption kind.
//
// Each entry is a list of templates. Templates use {placeholders} that the
// helper fills in from corruption params + scene metadata. Generators rotate
// through templates deterministically so a single corruption + part doesn't
// always produce the same sentence.

const TEMPLATES = {
  missing_part: [
    "This {scene} is missing its {part}. Draw it back in.",
    "Someone deleted the {part} from this {scene}. Add it back.",
    "Finish the {scene} — its {part} is gone.",
    "The {scene} is incomplete: the {part} is missing.",
    "Restore the missing {part} on this {scene}.",
    "Half-built {scene} icon — add the {part} so it's whole again.",
    "The {part} fell off this {scene}. Put it back.",
  ],
  extra_part: [
    "There's a stray {part} on this {scene}. Remove it.",
    "Someone scribbled an extra {part} onto this {scene}. Clean it up.",
    "This {scene} has an unwanted {part} that shouldn't be here. Delete it.",
    "Remove the stray {part} from this {scene}.",
    "An extra {part} was added by mistake. Get rid of it.",
    "Tidy up: this {scene} has a {part} it shouldn't have.",
  ],
  displaced: [
    "The {part} has slipped out of place on this {scene}. Move it back to its proper position.",
    "Something bumped the {part} — it's not where it should be. Restore it.",
    "The {part} of this {scene} is misaligned. Slide it back.",
    "Reset the {part} of this {scene} to its original position.",
    "The {part} drifted from its spot. Put it where it belongs.",
    "Fix the placement of the {part} — it's off-center.",
  ],
  miscolor: [
    "Someone painted the {part} the wrong color. Restore its original look.",
    "The {part} should not be {wrongName}. Repaint it correctly.",
    "Color mix-up: the {part} is the wrong color. Fix it.",
    "The {part} is {wrongName} — that's not right. Restore the proper color.",
    "Restore the original color of the {part}.",
    "This {part} was mis-painted {wrongName}. Set it back to how it should look.",
  ],
  wrong_color: [
    "This {icon} icon has been tinted {wrongName} by mistake. Restore its default black outline.",
    "Someone changed the color of this icon to {wrongName}. Set it back to black.",
    "The icon is wrongly colored {wrongName}. Restore the default look.",
    "Color was applied by accident — this icon should be the standard black, not {wrongName}.",
    "Reset this {icon} icon's color back to the default black outline.",
  ],
  wrong_stroke_width: [
    "This icon's stroke looks {thickness}. Restore the default stroke-width.",
    "The icon is drawn with the wrong stroke thickness. Reset it to the default.",
    "Someone changed the line weight of this icon. Restore it to default.",
    "The lines of this icon look {thickness}. Fix the stroke-width.",
  ],
  wrong_scale: [
    "This icon was rendered at the wrong size. Restore it to its proper dimensions.",
    "The icon looks {scaleDir} than it should. Resize it back.",
    "Someone resized this icon by accident. Restore the original size.",
    "Reset the {icon} icon's size back to normal.",
  ],
  clipped_viewbox: [
    "The icon is being clipped by the canvas. Expand the viewBox so the whole thing fits.",
    "Part of this icon is cut off. Fix the canvas size.",
    "The viewBox is too small — the icon doesn't fit. Make it big enough.",
    "Resize the canvas so this icon stops being cropped.",
  ],
  flipped: [
    "The {part} has been mirrored. Flip it back to its proper orientation.",
    "Someone reversed the {part}. Restore the original direction.",
    "The {part} faces the wrong way. Mirror it back.",
  ],
  duplicate: [
    "There are two copies of the {part} on this {scene}. Remove the duplicate.",
    "Someone accidentally duplicated the {part}. Get rid of the extra one.",
    "This {scene} should only have one {part}, but there are two. Delete the spare.",
    "Remove the duplicated {part} from this {scene}.",
  ],
  multi: [
    "Two things are wrong with this {scene}. Fix both.",
    "This {scene} has more than one defect. Repair everything that's off.",
    "Several issues on this {scene} — restore it to a clean state.",
    "Multiple problems with this icon. Fix all of them.",
  ],
};

const COLOR_NAMES = {
  "#e63946": "red", "#3b82f6": "blue", "#22c55e": "green", "#fde047": "yellow",
  "#a855f7": "purple", "#f97316": "orange", "#ec4899": "pink", "#06b6d4": "cyan",
  "#92400e": "brown", "#0f172a": "near-black", "#9ca3af": "gray",
};

export const colorName = (hex) => COLOR_NAMES[hex] ?? hex;

// Pick a template deterministically: `seed` is typically the task counter.
const pick = (kind, seed) => {
  const arr = TEMPLATES[kind];
  if (!arr) throw new Error(`no NL templates for ${kind}`);
  return arr[seed % arr.length];
};

const partLabel = (id) => id.replace(/-/g, " ");

// Build an NL instruction given the corruption params + scene context.
export const instructionFor = ({ kind, params, sceneName, iconName, seed = 0 }) => {
  const scene = sceneName ?? "icon";
  let t;
  switch (kind) {
    case "missing_part":
      t = pick("missing_part", seed);
      return t.replace("{scene}", scene).replace("{part}", partLabel(params.part));

    case "extra_part":
      t = pick("extra_part", seed);
      return t.replace("{scene}", scene).replace("{part}", partLabel(params.part));

    case "displaced":
      t = pick("displaced", seed);
      return t.replace("{scene}", scene).replace("{part}", partLabel(params.part));

    case "miscolor":
      t = pick("miscolor", seed);
      return t
        .replace("{part}", partLabel(params.part))
        .replace("{wrongName}", colorName(params.wrongColor));

    case "wrong_color":
      t = pick("wrong_color", seed);
      return t.replace("{icon}", iconName ?? "icon").replace("{wrongName}", colorName(params.wrongColor));

    case "wrong_stroke_width": {
      const thicker = params.wrongWidth > params.originalWidth;
      t = pick("wrong_stroke_width", seed);
      return t.replace("{thickness}", thicker ? "too thick" : "too thin");
    }

    case "wrong_scale": {
      const bigger = params.wrongSize > params.originalSize;
      t = pick("wrong_scale", seed);
      return t.replace("{icon}", iconName ?? "icon").replace("{scaleDir}", bigger ? "larger" : "smaller");
    }

    case "clipped_viewbox":
      t = pick("clipped_viewbox", seed);
      return t;

    case "flipped":
      t = pick("flipped", seed);
      return t.replace("{part}", partLabel(params.part));

    case "duplicate":
      t = pick("duplicate", seed);
      return t.replace("{scene}", scene).replace("{part}", partLabel(params.sourceId));

    case "multi":
      t = pick("multi", seed);
      return t.replace("{scene}", scene);

    default:
      throw new Error(`unknown nl kind ${kind}`);
  }
};
