# Running Model Solvers

Keep credentials in environment variables and install dependencies inside a virtual environment.

## OpenRouter Study

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'sdk/python[litellm]'
export OPENROUTER_API_KEY='...'

python scripts/benchmark-openrouter.py --dry-run
python scripts/benchmark-openrouter.py \
  --manifest benchmarks/openrouter-30.json \
  --budget-usd 25 \
  --concurrency 20 \
  --run-name openrouter-30-human

python scripts/benchmark-openrouter.py \
  --manifest benchmarks/openrouter-frontier-4.json \
  --budget-usd 25 \
  --concurrency 4 \
  --run-name openrouter-frontier-4
```

The runner gives the model only the human instruction and corrupted SVG. It records target and preservation checks after the response returns. Retries use the same requested model; fallback routing to a different model is not allowed by the harness.

The specification reward remains all-or-nothing, while requested values use deterministic perceptual tolerances. Use `repair_pass`, `near_pass`, `preservation_pass`, `source_preservation_pass`, `validity_pass`, `edit_completion`, `repair_progress`, UCR, and aggregate `truncation_rate` to distinguish incomplete repairs, side effects, source rewrites, invalid SVGs, and length-limited responses. Canonical full-target match is diagnostic only.

## SDK Provider Examples

```sh
# OpenAI-compatible endpoint
export OPENAI_API_KEY='...'
export VEG_OPENAI_MODEL='gpt-5-mini'
vec-edit-gym evaluate vector_edit_gym.examples.openai_solver:solve --limit 5

# Anthropic
export ANTHROPIC_API_KEY='...'
vec-edit-gym evaluate vector_edit_gym.examples.claude_solver:solve --limit 5

# LiteLLM-compatible proxy
export LITELLM_API_KEY='...'
export LITELLM_BASE_URL='https://your-proxy.example/v1'
export VEG_LITELLM_MODEL='your-model'
vec-edit-gym evaluate vector_edit_gym.examples.litellm_solver:solve --limit 5
```

These examples are convenience adapters. The published study uses `scripts/benchmark-openrouter.py` because it adds resumability, a model manifest, budget reservations, retries, provenance fields, token accounting, and per-task JSONL.

## Artifacts

```text
runs/openrouter/<run>/meta.json
runs/openrouter/<run>/results.jsonl
runs/openrouter/<run>/traces.jsonl
runs/openrouter/<run>/history/<timestamp>/
runs/openrouter/<run>/summary.json
runs/openrouter/<run>/summary.md
runs/openrouter/<run>/cost.json
```

`runs/` is ignored by Git. After the complete model-task matrix has finished, rescore the recorded responses and then publish them:

```sh
python scripts/rescore-results.py runs/openrouter/openrouter-30-human
node scripts/publish-model-results.mjs runs/openrouter/openrouter-30-human
```

The runner appends a credential-safe event before and after every provider attempt, then records extraction and evaluation events. `results.jsonl` also embeds the complete final trace for each model--task pair. The rescorer does not call a model or alter its response: it first archives the prior rows, atomically regenerates scores and summaries, and appends the new evaluator snapshot to the trace history.

To publish compatible cohorts as one leaderboard, merge their complete matrices first:

```sh
python scripts/merge-runs.py runs/openrouter/openrouter-combined \
  runs/openrouter/openrouter-30-human \
  runs/openrouter/openrouter-frontier-4
python scripts/rescore-results.py runs/openrouter/openrouter-combined
node scripts/publish-model-results.mjs runs/openrouter/openrouter-combined
```

The merger rejects corpus, protocol, prompt, task-order, duplicate-model, and incomplete-matrix mismatches. Existing `traces.jsonl` streams are validated and concatenated without rewriting their events.
