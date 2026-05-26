# VectorEditGym

A benchmark that tests whether AI agents can edit SVG icons exactly as instructed without accidentally changing other parts.

Live viewer: https://svg-rl-env.vercel.app

Each task has:

- `initial_svg` — the icon before editing
- `instruction` — the natural-language edit request
- `target_svg` — the correct result
- `expected_diff` — list of `{part, attribute, before, after}` entries that should change
- `should_preserve` — list of parts that must not change

## What's a task

Each task is **one corrupted SVG icon** plus a **natural-language fix instruction**. The corruption is one of: missing part, extra mark, displaced piece, wrong color, wrong stroke-width, wrong scale, clipped viewBox, flipped part, duplicate part, company-logo repair, or a multi-corruption combo. The active 106-task curriculum is curated in `scripts/author-all.mjs` as one named task function per task so every prompt can be reviewed directly.

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

# 2. Regenerate the curated 106-task curriculum
npm run generate:authored

# 3. Run the viewer + authoring UI
cd viewer && npm install && npm run dev
# open http://localhost:3000           — browse tasks
# open http://localhost:3000/author    — author a new task (live preview, save to disk)
# open http://localhost:3000/icons     — browse the 955-icon catalog

# 4. Install and use the Python SDK
pip install -e sdk/python
vec-edit-gym list
vec-edit-gym score ea_001 produced.svg --json                        # one-task diff report
python scripts/benchmark-litellm.py --models gpt-5 gpt-5-mini        # LiteLLM multi-model run
```

## Deployment

The hosted viewer is deployed on Vercel as project `yug-guptas-projects/svg-rl-env`. Deploy from the repository root so the Next app and `data/` directory are uploaded together:

```sh
vercel deploy --prod
```

The Vercel build runs `scripts/prepare-viewer-data.mjs` first, copying `data/` into `viewer/data/` so the serverless viewer can read the task and icon files at runtime.

Current production alias: https://svg-rl-env.vercel.app

## Published Results

Latest runs on the active 106-task curriculum, published in `data/leaderboard.json` for the viewer:

| Model | Exact | Structural | Preservation | Expected changes | Errors | Mean latency |
|-------|------:|-----------:|-------------:|-----------------:|-------:|-------------:|
| `gemini/gemini-3-pro-preview` | 29.2% | 29.2% | 98.1% | 40.8% | 0.0% | 9952 ms |
| `gpt-5.5` | 25.5% | 26.4% | 97.9% | 37.4% | 0.0% | 9079 ms |
| `gemini/gemini-3-flash-preview` | 23.6% | 23.6% | 95.4% | 39.1% | 0.0% | 2900 ms |

Submit leaderboard results to `yug@thetalab.tech`.

## Authoring

The curated benchmark is authored in `scripts/author-all.mjs`. Each of the 106 active tasks has its own function, unique instruction text, and explicit corruption setup. The `/author` page is still useful for previewing or experimenting with new tasks before promoting them into the curated script.

## Curriculum (106 tasks)

| Difficulty | Tasks | Notes |
|------------|-------|-------|
| Easy       | 25    | Single real-icon repairs: color, line weight, scale, and clipping |
| Medium     | 35    | Composite-scene repairs: missing, extra, displaced, recolored, duplicated, flipped, and multi-repair |
| Hard       | 26    | Multi-issue real-icon repairs plus six company-logo repair tasks from bundled Feather brand SVGs |
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
viewer/              Next.js 16 app
  app/               /, /tasks/[id], /icons, /author, /api/author/*
  engine-lib         symlink to scripts/lib (so Next routes can import the engine)
```

Composite workflow scenes are in `scripts/lib/workflow-scenes.mjs`; each part has a semantically meaningful id so instructions can reference parts by name and diffs are unambiguous.

## Task schema

```jsonc
{
  "task_id": "me_011",
  "difficulty": "medium",
  "category": "displaced_part",
  "instruction": "The front door slid away from the center of the house. Move it back into place.",
  "initial_svg": "<svg ...>...</svg>",
  "target_svg":  "<svg ...>...</svg>",
  "parts": ["walls", "roof", "door", "window", "chimney", "doorknob", "smoke"],
  "target_parts": ["door"],
  "expected_diff": [
    { "part": "door", "attribute": "x", "before": 74, "after": 56 }
  ],
  "should_preserve": ["walls", "roof", "window", "chimney", "doorknob", "smoke"]
}
```
