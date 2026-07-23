# Vector-Bench

[![CI](https://github.com/yug-space/vector-edit-gym/actions/workflows/ci.yml/badge.svg)](https://github.com/yug-space/vector-edit-gym/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code%20license-MIT-2f6f4e.svg)](LICENSE)
[![Corpus: 40 tasks](https://img.shields.io/badge/corpus-40%20tasks-c05a32.svg)](DATASET_CARD.md)
[![Published traces: 1,360](https://img.shields.io/badge/traces-1%2C360-315f85.svg)](https://www.vecbench.xyz/traces)

Vector-Bench is a frozen, preservation-aware benchmark for repairing visible defects
in SVGs. It tests whether a model can make every requested change while leaving the
rest of the vector program intact, then assigns a deterministic binary reward.

[Results](https://www.vecbench.xyz) ·
[Tasks](https://www.vecbench.xyz/tasks) ·
[Traces](https://www.vecbench.xyz/traces) ·
[Paper](https://www.vecbench.xyz/vectoreditgym-paper.pdf) ·
[Dataset card](DATASET_CARD.md) ·
[Changelog](CHANGELOG.md)

The `0.2.0` release contains 40 dense repair tasks, 202 annotated edits, 34 model
endpoints, and 1,360 published model-task traces. Author-written instructions sound
like ordinary visual requests: they do not expose SVG IDs, coordinates, color codes,
path data, or evaluator metadata. Published results use evaluator
`semantic-perceptual-binary-2026-07-21`.

> [!IMPORTANT]
> Project-authored code and metadata are MIT licensed. Twenty scenic illustrations
> have unresolved per-file provenance and are not covered by that grant. Read the
> [licensing notice](NOTICE.md) and [dataset card](DATASET_CARD.md) before redistributing
> the complete corpus.

**Authors:** Yug Gupta and Prannay Hebbar. The paper and accompanying material are shared work. Contact through GitHub or `prannay@warping.co`.

## What Is Included

- a deterministic Python evaluator and `vec-edit-gym` CLI
- the frozen task corpus, hidden evaluator annotations, and corpus hash
- a resumable multi-provider benchmark runner with budget and retry controls
- complete published outputs, verifier evidence, and retained trace records
- an interactive Next.js results and trace browser
- a generated Harbor benchmark package and an ACL-style research paper

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

- `repair_pass`: every requested edit is within a deterministic perceptual tolerance. Numeric placement uses viewport- and mutation-bounded distance, colors use CIE Lab Delta E76, and paths use sampled geometry so equivalent command decompositions are accepted.
- `preservation_pass`: after masking only requested fields, the rendering- and application-relevant document tree remains unchanged. Consistent ID renaming and style-versus-presentation rewrites are accepted; unrequested visible attributes, `data-*` metadata, definitions, anonymous nodes, nesting, and order remain strict.
- `validity_pass`: the output is a complete, well-formed SVG with unique nonempty IDs, valid path, point-list, transform, and viewBox syntax, and resolvable local URL/href references.
- `near_pass`: the output is valid and semantically clean, with at most one missed repair and at least 80% aggregate repair progress. It is diagnostic and does not receive binary reward.

`structural` is canonical full-target equality and is diagnostic only. A bounded repair can pass even when `structural` is false. Each expected-edit report includes the comparison method, measured distance, tolerance, unit, and outcome.

Diagnostic metrics explain zero-reward outputs:

- `edit_completion`: fraction of requested repairs completed
- `repair_progress`: average progress toward each hidden target, using the corrupted value as the baseline; invalid outputs receive zero progress
- `preservation`: fraction of protected object subtrees unchanged
- `unintended_change_rate`: `1 - preservation`
- `repair_pass`: whether all requested checks pass
- `preservation_pass`: whether the masked full document is unchanged
- `source_preservation_pass`: strict source-tree preservation, reported separately from the visual/semantic pass
- `validity_pass`: whether the output passes structural SVG validity
- `structural`: canonical target match, reported only as a diagnostic
- `truncation_rate`: fraction of endpoint responses ending at the output-length limit

Aggregate UCR on the leaderboard is computed over valid SVG outputs and is `n/a` when a model has none. Invalid and truncated responses are reported separately through `validity_rate`, `error_rate`, and `truncation_rate`.

## Setup

Prerequisites are Python 3.9 or newer, Node.js 20.9 or newer, and npm. Use a
Python virtual environment; this also avoids the macOS/Homebrew
`externally-managed-environment` error from PEP 668.

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
npm run traces:verify
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
- `results.jsonl`: one scored outcome plus its complete sanitized trace, SVG or error, diff report, usage, and cost per model/task
- `traces.jsonl`: append-only request-start, retry, provider-response, extraction, and evaluator events
- `history/<timestamp>/`: immutable pre-rescore `results.jsonl` and `meta.json` snapshots
- `summary.json` and `summary.md`: model aggregates
- `cost.json`: recorded spend and cap

Trace capture explicitly removes credentials, authorization/cookie headers, and key-shaped values. New runs retain every harness attempt and provider payload. The published July 2026 study predates complete attempt capture, so its traces are labeled `legacy_final_record`: prompts, final outputs, IDs, usage, timing, and verifier state are available, but discarded response wrappers and retry/transport envelopes cannot be reconstructed.

`runs/` is intentionally ignored by Git. Publish a completed run into the tracked website data with:

```sh
python scripts/rescore-results.py runs/openrouter/openrouter-30-human
node scripts/publish-model-results.mjs runs/openrouter/openrouter-30-human
```

The rescorer archives the prior rows before atomically applying the repository's current evaluator and appends the new score snapshot to each trace. The exporter refuses incomplete or duplicated model-task matrices. Compatible completed cohorts can be combined without altering their recorded outcomes or trace streams:

```sh
python scripts/merge-runs.py runs/openrouter/openrouter-combined \
  runs/openrouter/openrouter-30-human \
  runs/openrouter/openrouter-frontier-4
python scripts/rescore-results.py runs/openrouter/openrouter-combined
node scripts/publish-model-results.mjs runs/openrouter/openrouter-combined
npm run traces:verify
```

## Analysis and Paper

Generate all statistics, Wilson confidence intervals, deterministic evaluator controls, sensitivity tables, and figures from the same JSONL:

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
- requested/resolved endpoint IDs, response IDs, parse failures, and every retained raw response
- a dedicated chronological trace viewer for prompts, attempts, extraction, verifier history, and artifacts
- the paper PDF and aggregate analysis figures

Production deployment uses the Vercel project `yug-guptas-projects/svg-rl-env`:

```sh
vercel deploy --prod
```

## Launch Film

The reproducible Remotion project in `launch-video/` turns real task SVGs, solver
outputs, verifier gates, and leaderboard values into a 36-second 1080p launch film.

```sh
npm --prefix launch-video install
npm run video:lint
npm run video:dev
npm run video:render
```

The final command writes `launch-video/out/vector-bench-launch.mp4`. Generated
renders are ignored; the composition, local fonts, synthesized audio, and source
assets are tracked.

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
data/model-results/         task-sharded outputs and sanitized traces
data/model-results-summary.json  compact task catalog diagnostics
data/scenic_svgs/           scenic source assets
harbor/vector-edit-gym/     generated Harbor dataset
launch-video/               Remotion launch film and source assets
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

Open a GitHub issue with the run directory metadata, commit hash, model endpoint, and reproduction command. Submitted rows are verified against the frozen corpus hash and evaluator before publication.
