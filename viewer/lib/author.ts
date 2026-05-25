// Server-side glue for the authoring UI.
//
// Wraps the existing scripts/lib/ modules so Next.js API routes can:
//   - enumerate icons + composite scenes + corruption kinds (catalog)
//   - given a draft, render initial + target SVGs and the expected diff (preview)
//   - persist a finished task to data/tasks/<task_id>.json (save)
//
// We import the .mjs modules dynamically so Next can resolve them from
// outside the viewer/ directory without TypeScript path gymnastics.

import path from "node:path";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";

// @ts-ignore — vendored copies of ../../scripts/lib (kept in sync manually for now)
import * as render from "./engine/icon-render.mjs";
// @ts-ignore
import * as catalog from "./engine/icon-catalog.mjs";
// @ts-ignore
import * as scenes from "./engine/icon-scenes.mjs";
// @ts-ignore
import * as corr from "./engine/corruptions.mjs";

const ROOT =
  [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ].find((candidate) => existsSync(path.join(candidate, "data"))) ??
  path.resolve(process.cwd(), "..");
const TASKS_DIR = path.join(ROOT, "data", "tasks");

export type DraftSource =
  | { kind: "icon"; name: string }
  | { kind: "scene"; name: string };

export type Corruption =
  | { kind: "wrong_color"; wrong: string }
  | { kind: "wrong_stroke_width"; wrong: number }
  | { kind: "wrong_scale"; wrong: number }
  | { kind: "clipped_viewbox"; w: number; h: number }
  | { kind: "missing_part"; part: string }
  | { kind: "extra_part"; part: any }
  | { kind: "displaced_part"; part: string; dx: number; dy: number }
  | { kind: "miscolor_part"; part: string; wrong: string }
  | { kind: "flipped_part"; part: string }
  | { kind: "duplicate_part"; part: string; dx: number; dy: number }
  | { kind: "multi"; steps: Corruption[] };

export type Draft = {
  source: DraftSource;
  corruption: Corruption;
};

export type Options = {
  icons: { name: string; source: string; style: string; category: string }[];
  scenes: { name: string; parts: { id: string; type: string }[] }[];
  corruptions: string[];
};

const CORRUPTION_KINDS = [
  "wrong_color",
  "wrong_stroke_width",
  "wrong_scale",
  "clipped_viewbox",
  "missing_part",
  "extra_part",
  "displaced_part",
  "miscolor_part",
  "flipped_part",
  "duplicate_part",
  "multi",
];

export const getOptions = async (): Promise<Options> => {
  const icons = Object.entries((catalog as any).ICONS).map(([name, v]: [string, any]) => ({
    name,
    source: v.source,
    style: v.style,
    category: v.category,
  }));
  const sceneList = (scenes as any).sceneNames().map((name: string) => {
    const spec = (scenes as any).SCENES[name]();
    return {
      name,
      parts: (spec.parts ?? []).map((p: any) => ({ id: p.id, type: p.type })),
    };
  });
  return { icons, scenes: sceneList, corruptions: CORRUPTION_KINDS };
};

// Build a clean scene spec from a draft source.
const buildClean = (source: DraftSource) => {
  if (source.kind === "scene") {
    const builder = (scenes as any).SCENES[source.name];
    if (!builder) throw new Error(`unknown scene: ${source.name}`);
    return builder();
  }
  return {
    canvas: [128, 128],
    bg: "white",
    parts: [(catalog as any).place(source.name, { id: source.name, x: 8, y: 8, size: 112, color: "#222", strokeWidth: 1.5 })],
  };
};

// Apply a corruption descriptor and return { corrupted, fix } from the lib.
const applyCorruption = (clean: any, c: Corruption): any => {
  switch (c.kind) {
    case "wrong_color":
      return callCorr("corruptIconColor", clean, c.wrong, "#222");
    case "wrong_stroke_width":
      return callCorr("corruptStrokeWidth", clean, c.wrong, 1.5);
    case "wrong_scale": {
      const t = clean.base ?? clean.parts.find((p: any) => p.type === "icon");
      return callCorr("corruptScale", clean, c.wrong, t.size);
    }
    case "clipped_viewbox":
      return callCorr("corruptClippedViewBox", clean, c.w, c.h);
    case "missing_part":
      return callCorr("corruptMissingPart", clean, c.part);
    case "extra_part":
      return callCorr("corruptExtraPart", clean, c.part);
    case "displaced_part":
      return callCorr("corruptDisplacedPart", clean, c.part, { dx: c.dx, dy: c.dy });
    case "miscolor_part":
      return callCorr("corruptMiscolorPart", clean, c.part, c.wrong);
    case "flipped_part":
      return callCorr("corruptFlippedPart", clean, c.part);
    case "duplicate_part":
      return callCorr("corruptDuplicatePart", clean, c.part, { dx: c.dx, dy: c.dy });
    case "multi": {
      let cur = clean;
      const fixes: any[] = [];
      const allParams: any[] = [];
      for (const step of c.steps) {
        const out = applyCorruption(cur, step);
        cur = out.corrupted;
        fixes.unshift(out.fix);
        allParams.push(out.params);
      }
      return {
        corrupted: cur,
        fix: (s: any) => {
          let spec = s;
          const diff: any[] = [];
          for (const f of fixes) {
            const o = f(spec);
            spec = o.spec;
            diff.push(...o.diff);
          }
          return { spec, diff };
        },
        params: { kind: "multi", parts: allParams },
      };
    }
  }
};

const callCorr = (name: string, ...args: any[]) => (corr as any)[name](...args);

export type Preview = {
  initial_svg: string;
  target_svg: string;
  expected_diff: any[];
  parts: string[];
  target_parts: string[];
  should_preserve: string[];
};

export const buildPreview = async (draft: Draft): Promise<Preview> => {
  const clean = buildClean(draft.source);
  const { corrupted, fix } = applyCorruption(clean, draft.corruption);
  const { spec: target, diff } = fix(corrupted);
  const initialIds: string[] = (render as any).sceneIds(corrupted);
  const targetIds: string[] = (render as any).sceneIds(target);
  const allIds = Array.from(new Set([...initialIds, ...targetIds]));
  const changed = new Set<string>(
    diff
      .map((d: any) => d.part)
      .filter((p: unknown): p is string => typeof p === "string" && p !== "__svg"),
  );
  return {
    initial_svg: (render as any).renderScene(corrupted),
    target_svg: (render as any).renderScene(target),
    expected_diff: diff,
    parts: allIds,
    target_parts: [...changed],
    should_preserve: allIds.filter((id) => !changed.has(id)),
  };
};

// Auto-suggest the next task_id for a tier by scanning data/tasks/.
export const nextTaskId = async (difficulty: string): Promise<string> => {
  const prefix = {
    very_easy: "ve",
    easy: "ea",
    medium: "me",
    hard: "ha",
    very_hard: "vh",
  }[difficulty];
  if (!prefix) throw new Error(`unknown difficulty: ${difficulty}`);
  let existing: string[] = [];
  try {
    existing = await fs.readdir(TASKS_DIR);
  } catch {
    /* dir may not exist yet */
  }
  const re = new RegExp(`^${prefix}_(\\d+)\\.json$`);
  const nums = existing
    .map((f) => f.match(re))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => parseInt(m[1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}_${String(next).padStart(3, "0")}`;
};

export type SaveInput = {
  draft: Draft;
  difficulty: string;
  category: string;
  instruction: string;
  task_id?: string;
};

export const saveTask = async (input: SaveInput): Promise<{ task_id: string; path: string }> => {
  const id = input.task_id ?? (await nextTaskId(input.difficulty));
  const preview = await buildPreview(input.draft);
  const record = {
    task_id: id,
    difficulty: input.difficulty,
    category: input.category,
    instruction: input.instruction,
    initial_svg: preview.initial_svg,
    target_svg: preview.target_svg,
    draft: input.draft, // keep the structured authoring data for round-tripping
    parts: preview.parts,
    target_parts: preview.target_parts,
    expected_diff: preview.expected_diff,
    should_preserve: preview.should_preserve,
    authored_at: new Date().toISOString(),
  };
  await fs.mkdir(TASKS_DIR, { recursive: true });
  const filePath = path.join(TASKS_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2));
  return { task_id: id, path: filePath };
};
