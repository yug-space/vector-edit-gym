# VectorEditGym

A benchmark that tests whether AI agents can edit SVG icons exactly as instructed without accidentally changing other parts.

Each task has:

- `initial_svg` — the icon before editing
- `instruction` — the natural-language edit request
- `target_svg` — the correct result
- `expected_diff` — list of `{part, attribute, before, after}` entries that should change
- `should_preserve` — list of parts that must not change

## What's a task

Each task is **one corrupted SVG icon** plus a **natural-language fix instruction**. The corruption is one of: missing part, extra mark, displaced piece, wrong color, wrong stroke-width, wrong scale, clipped viewBox, flipped part, duplicate part, or a multi-corruption combo. Tasks are hand-authored through the web tool; nothing is generated from templates.

```jsonc
{
  "task_id": "ve_001",
  "difficulty": "very_easy",
  "category": "missing_part",
  "instruction": "This house is missing its door. Draw it back in.",
  "initial_svg": "<svg ...>…corrupted…</svg>",
  "target_svg":  "<svg ...>…clean…</svg>",
  "expected_diff": [{ "part": "door", "attribute": "exists", "before": false, "after": true, "added": {...} }],
  "should_preserve": ["home", "window", "chimney", "doorknob"],
  "draft": { "source": { "kind": "scene", "name": "house" }, "corruption": { "kind": "missing_part", "part": "door" } }
}
```

## Quick start

```sh
# 1. Scrape the real icon catalog (Heroicons, Feather, Iconify) — one-time
npm run scrape:icons

# 2. Run the viewer + authoring UI
cd viewer && npm install && npm run dev
# open http://localhost:3000           — browse tasks
# open http://localhost:3000/author    — author a new task (live preview, save to disk)
# open http://localhost:3000/icons     — browse the 955-icon catalog

# 3. Install and use the Python SDK
pip install -e sdk/python
vec-edit-gym list
vec-edit-gym evaluate vector_edit_gym.examples.oracle_solver:solve   # ceiling
vec-edit-gym evaluate vector_edit_gym.examples.noop_solver:solve     # floor
```

## Authoring

The `/author` page is the canonical way to add tasks. Pick a real icon or a composite scene, choose the corruption type, set its parameters, write the natural-language instruction, and save. Each task lands in `data/tasks/<task_id>.json` with both a structured `draft` (for round-tripping in the UI) and the rendered initial/target SVGs (for the SDK).

## Curriculum (300 tasks, hand-authored)

| Difficulty | Target count | Authored |
|------------|--------------|----------|
| Very Easy  | 60           | …        |
| Easy       | 70           | …        |
| Medium     | 80           | …        |
| Hard       | 60           | …        |
| Very Hard  | 30           | …        |

The 300 auto-generated tasks from the earlier pipeline have been moved to `data/tasks_legacy/` as a reference (they're noisier and template-based; the new ones replace them).

## Layout

```
data/
  tasks/             hand-authored task JSON files (one per task)
  tasks_legacy/      retired auto-generated batch (kept for reference)
  icons/             scraped real-world SVG icons (Heroicons, Feather, Iconify)
scripts/
  scrape-icons.mjs   icon catalog scraper
  lib/               rendering + corruption + edit operations
                     used by both the viewer's API routes and any future bulk tooling
sdk/python/          Python SDK + CLI (`pip install -e .` → `vec-edit-gym`)
viewer/              Next.js 15 app
  app/               /, /tasks/[id], /icons, /author, /api/author/*
  engine-lib         symlink to scripts/lib (so Next routes can import the engine)
```

## Curriculum (300 tasks)

| Difficulty | Tasks | Status | Notes                                                              |
|------------|-------|--------|--------------------------------------------------------------------|
| Very Easy  | 60    | ✓      | 1-2 primitives, single edit (color / move / resize / delete / stroke) |
| Easy       | 70    | ✓      | 2-4 primitives, distractor by shape                                |
| Medium     | 80    | ✓      | 4-6 objects, ordinal/spatial reference, multi-object, constraints, repair |
| Hard       | 60    | ✓      | Composite icons (house, robot, cart…): local preservation, alignment, constraint, simplification, repair |
| Very Hard  | 30    | ✓      | Multi-step + complex constraints + real Heroicons/Feather edits + adversarial preservation |

Composite icon scenes are in `scripts/lib/scenes.mjs`; each part has a semantically meaningful id (`house.door`, `traffic-light.red`) so instructions can reference parts by name and diffs are unambiguous.

## Task schema

```jsonc
{
  "task_id": "ve_001",
  "difficulty": "very_easy",
  "category": "color_edit",
  "instruction": "Make only the circle blue.",
  "initial_svg": "<svg ...>...</svg>",
  "target_svg":  "<svg ...>...</svg>",
  "initial_spec": { "canvas": [128, 128], "objects": [ ... ] },
  "target_spec":  { "canvas": [128, 128], "objects": [ ... ] },
  "parts": ["circle"],
  "expected_diff": [
    { "part": "circle", "attribute": "fill", "before": "red", "after": "blue" }
  ],
  "should_preserve": []
}
```
