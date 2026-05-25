# VectorEditGym

A benchmark that tests whether AI agents can edit SVG icons exactly as instructed without accidentally changing other parts.

Each task has:

- `initial_svg` — the icon before editing
- `instruction` — the natural-language edit request
- `target_svg` — the correct result
- `expected_diff` — list of `{part, attribute, before, after}` entries that should change
- `should_preserve` — list of parts that must not change

## What's a task

Each task is **one corrupted SVG icon** plus a **natural-language fix instruction**. The corruption is one of: missing part, extra mark, displaced piece, wrong color, wrong stroke-width, wrong scale, clipped viewBox, flipped part, duplicate part, or a multi-corruption combo. The active 100-task curriculum is curated in `scripts/author-all.mjs` as one named task function per task so every prompt can be reviewed directly.

```jsonc
{
  "task_id": "ea_001",
  "difficulty": "easy",
  "category": "wrong_color",
  "instruction": "The academic cap picked up a red accent. Put it back as a plain black outline.",
  "initial_svg": "<svg ...>…corrupted…</svg>",
  "target_svg":  "<svg ...>…clean…</svg>",
  "expected_diff": [{ "part": "icon", "attribute": "color", "before": "#e63946", "after": "#222" }],
  "should_preserve": []
}
```

## Quick start

```sh
# 1. Scrape the real icon catalog (Heroicons, Feather, Iconify) — one-time
npm run scrape:icons

# 2. Regenerate the curated 100-task curriculum
npm run generate:authored

# 3. Run the viewer + authoring UI
cd viewer && npm install && npm run dev
# open http://localhost:3000           — browse tasks
# open http://localhost:3000/author    — author a new task (live preview, save to disk)
# open http://localhost:3000/icons     — browse the 955-icon catalog

# 4. Install and use the Python SDK
pip install -e sdk/python
vec-edit-gym list
vec-edit-gym evaluate vector_edit_gym.examples.oracle_solver:solve   # ceiling
vec-edit-gym evaluate vector_edit_gym.examples.noop_solver:solve     # floor
```

## Authoring

The curated benchmark is authored in `scripts/author-all.mjs`. Each of the 100 active tasks has its own function, unique instruction text, and explicit corruption setup. The `/author` page is still useful for previewing or experimenting with new tasks before promoting them into the curated script.

## Curriculum (100 tasks)

| Difficulty | Tasks | Notes |
|------------|-------|-------|
| Easy       | 25    | Single real-icon repairs: color, line weight, scale, and clipping |
| Medium     | 35    | Composite-scene repairs: missing, extra, displaced, recolored, duplicated, flipped, and multi-repair |
| Hard       | 20    | Multi-issue real-icon repairs with general visual instructions |
| Very Hard  | 20    | Contextual creation steps that add one missing scene element |

The older generated tasks remain in `data/tasks_legacy/` as a reference.

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

Composite workflow scenes are in `scripts/lib/workflow-scenes.mjs`; each part has a semantically meaningful id so instructions can reference parts by name and diffs are unambiguous.

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
