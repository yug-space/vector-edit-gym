# VectorEditGym

VectorEditGym evaluates whether a model can repair visible defects in an SVG without changing the rest of the vector program.

- Website: https://svg-rl-env.vercel.app
- Paper: https://svg-rl-env.vercel.app/vectoreditgym-paper.pdf
- Results submission: `yug@thetalab.tech`

The frozen release contains 40 dense repair tasks and 202 annotated edits. Instructions sound like human visual requests: they do not expose SVG IDs, coordinates, color codes, path data, or evaluator metadata.

**Authors:** Yug Aditi Gupta and Prannay Hebbar, equal contribution. The paper and accompanying material are shared work.

## Evaluation Contract

Each task contains:

- `instruction`: the public visual repair request
- `initial_svg`: the corrupted SVG shown to the model
- `target_svg`: the hidden canonical repair
- `expected_diff`: private object-attribute checks for diagnostic scoring
- `should_preserve`: private object IDs that must remain unchanged

The primary reward is binary, but requested values do not have to reproduce the hidden target exactly:

```text
specification_pass = repair_pass AND preservation_pass AND validity_pass
reward = 1 when specification_pass is true; otherwise 0
```

The three gates are:

- `repair_pass`: every requested edit is within a deterministic attribute-aware tolerance. Numeric placement uses viewport- and mutation-bounded distance, colors use CIE Lab Delta E76, and paths/points use coordinate RMS with matching topology.
- `preservation_pass`: after masking only requested fields, the complete canonical output tree equals the complete target tree. Unrequested attributes, definitions, anonymous nodes, IDs, nesting, and order remain strict.
- `validity_pass`: the output is a complete, well-formed SVG with unique nonempty IDs and valid normalized SVG syntax.

`structural` is canonical full-target equality and is diagnostic only. A bounded repair can pass even when `structural` is false. Each expected-edit report includes the comparison method, measured distance, tolerance, unit, and outcome.

Diagnostic metrics explain zero-reward outputs:

- `edit_completion`: fraction of requested repairs completed
- `preservation`: fraction of protected object subtrees unchanged
- `unintended_change_rate`: `1 - preservation`
- `repair_pass`: whether all requested checks pass
- `preservation_pass`: whether the masked full document is unchanged
- `validity_pass`: whether the output passes structural SVG validity
- `structural`: canonical target match, reported only as a diagnostic
- `truncation_rate`: fraction of endpoint responses ending at the output-length limit

## Setup

Use a virtual environment. This avoids the macOS/Homebrew `externally-managed-environment` error from PEP 668.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'sdk/python[test,litellm,analysis]'
npm --prefix viewer install
```

Verify the frozen corpus and evaluator:

```sh
npm run corpus:verify
npm run test:sdk
vec-edit-gym list
vec-edit-gym score sv_001 path/to/output.svg --json
```

The corpus check must print this non-instruction hash:

```text
2a62410b5de7383030c1a8b77d5d4d416e6be8efd11dc7322393a04f54e464d1
```

## Run the Benchmark

Credentials are read only from the process environment. Do not place API keys in source files, commands committed to shell scripts, or result JSON.

```sh
export OPENROUTER_API_KEY='...'

# Validate either manifest and estimate catalog cost.
python scripts/benchmark-openrouter.py --manifest benchmarks/openrouter-30.json --dry-run
python scripts/benchmark-openrouter.py --manifest benchmarks/openrouter-frontier-4.json --dry-run

# Smoke test one model and task.
python scripts/benchmark-openrouter.py \
  --models google/gemini-3.1-flash-lite-preview \
  --task-ids sv_001 \
  --run-name smoke

# Reproducible 30 x 40 study with a hard budget guard.
python scripts/benchmark-openrouter.py \
  --manifest benchmarks/openrouter-30.json \
  --budget-usd 25 \
  --concurrency 20 \
  --run-name openrouter-30-human

# Reproducible frontier 4 x 40 cohort under the same protocol.
python scripts/benchmark-openrouter.py \
  --manifest benchmarks/openrouter-frontier-4.json \
  --budget-usd 25 \
  --concurrency 4 \
  --run-name openrouter-frontier-4
```

Runs are resumable. Records are stored under `runs/openrouter/<run-name>/`:

- `meta.json`: prompt protocol, selected tasks/models, budget, and hidden fields
- `results.jsonl`: one scored outcome, SVG or error, diff report, usage, and cost per model/task
- `summary.json` and `summary.md`: model aggregates
- `cost.json`: recorded spend and cap

`runs/` is intentionally ignored by Git. Publish a completed run into the tracked website data with:

```sh
python scripts/rescore-results.py runs/openrouter/openrouter-30-human
node scripts/publish-model-results.mjs runs/openrouter/openrouter-30-human
```

The rescorer atomically applies the repository's current evaluator to the recorded responses. The exporter refuses incomplete or duplicated model-task matrices. Compatible completed cohorts can be combined without altering their recorded outcomes:

```sh
python scripts/merge-runs.py runs/openrouter/openrouter-combined \
  runs/openrouter/openrouter-30-human \
  runs/openrouter/openrouter-frontier-4
python scripts/rescore-results.py runs/openrouter/openrouter-combined
node scripts/publish-model-results.mjs runs/openrouter/openrouter-combined
```

## Analysis and Paper

Generate all statistics, bootstrap confidence intervals, tables, and figures from the same JSONL:

```sh
python scripts/analyze-results.py runs/openrouter/openrouter-combined
```

Compile and inspect the arXiv preprint:

```sh
mkdir -p output/pdf tmp/pdfs
tectonic --keep-logs --keep-intermediates --outdir tmp/pdfs paper/main.tex
cp tmp/pdfs/main.pdf output/pdf/vectoreditgym-paper.pdf
pdftoppm -png -r 150 output/pdf/vectoreditgym-paper.pdf tmp/pdfs/page
```

Generated paper numbers live in `paper/generated/`; figures live in `paper/figures/`. The manuscript contains no hand-entered benchmark result values.

## Website

```sh
npm run viewer:build
npm run viewer:dev
```

The viewer publishes:

- a top-ten chart and full published model table
- the 40-task catalog
- corrupted and target SVGs
- every model-produced SVG
- expected-edit checks, preservation failures, UCR, truncation, scheduled elapsed time, tokens, and cost
- requested/resolved endpoint IDs, response IDs, parse failures, and raw non-SVG responses
- the paper PDF and aggregate analysis figures

Production deployment uses the Vercel project `yug-guptas-projects/svg-rl-env`:

```sh
vercel deploy --prod
```

## Harbor

Generate standalone Harbor tasks:

```sh
npm run generate:harbor
```

The generated dataset contains 40 tasks and the same tolerance-aware binary verifier. It does not ship a solution directory or synthetic baseline agents.

## Repository Layout

```text
benchmarks/                 fixed model manifests
data/tasks/                 frozen 40-task corpus
data/leaderboard.json       published aggregate results
data/model-results.json     complete published model outputs
data/model-results/         task-sharded website output data
data/model-results-summary.json  compact task catalog diagnostics
data/scenic_svgs/           scenic source assets
harbor/vector-edit-gym/     generated Harbor dataset
paper/                      ACL-style arXiv paper and generated figures
scripts/                    runner, analysis, publishing, and build tooling
sdk/python/                 evaluator package and CLI
viewer/                     Next.js results browser
```

## Provenance Limitation

Twenty scenic source files do not have recoverable per-file provenance metadata. The project does not claim original authorship of those illustrations. They are retained to preserve the frozen evaluated corpus and should be treated as research-only while provenance remains unresolved. This limitation is disclosed in the paper and website artifact.

## License and Citation

Project-authored code and metadata are available under the [MIT License](LICENSE). The unresolved scenic illustrations and third-party icon collections are excluded from that blanket grant; review [NOTICE.md](NOTICE.md) and [DATASET_CARD.md](DATASET_CARD.md) before redistribution.

Citation metadata is provided in [CITATION.cff](CITATION.cff). Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md), the [Code of Conduct](CODE_OF_CONDUCT.md), and the [Security Policy](SECURITY.md).

## Submission

Send the run directory metadata, commit hash, model endpoint, and reproduction command to `yug@thetalab.tech`. Submitted rows are verified against the frozen corpus hash and evaluator before publication.
