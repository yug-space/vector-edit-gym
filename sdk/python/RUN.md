# Running solvers

Every solver reads its API key from the environment. Nothing is ever written to disk.

## OpenAI (gpt-5-mini default)

```sh
# from the repo root
export OPENAI_API_KEY="sk-..."     # never commit this
export VEG_OPENAI_MODEL="gpt-5-mini"          # optional; this is the default

# install once
pip install -e 'sdk/python[openai]'

# run against the hand-authored set (data/tasks/)
vec-edit-gym evaluate vector_edit_gym.examples.openai_solver:solve

# run against the 300 legacy auto-generated tasks
VECTOR_EDIT_GYM_DATA="$PWD/data/tasks_legacy" \
  vec-edit-gym evaluate vector_edit_gym.examples.openai_solver:solve \
  --difficulty very_easy --limit 10
```

## LiteLLM proxy

The LiteLLM runner uses the OpenAI SDK against an OpenAI-compatible base URL. Keep secrets in your shell environment; do not commit them.

```sh
export LITELLM_API_KEY="..."
export LITELLM_BASE_URL="https://your-litellm-proxy"
pip install -e 'sdk/python[litellm]'

# See what the proxy exposes.
python scripts/benchmark-litellm.py --list-models

# Smoke-test one model on a few tasks.
VEG_LITELLM_MODEL=gpt-5-mini \
  vec-edit-gym evaluate vector_edit_gym.examples.litellm_solver:solve --limit 5

# Benchmark GPT-5 and GPT-5 mini with per-task diff reports.
python scripts/benchmark-litellm.py \
  --models gpt-5 gpt-5-mini \
  --out runs/litellm \
  --run-name gpt5-vs-mini
```

Artifacts are written under `runs/litellm/<run-name>/`:

- `summary.json` / `summary.md` aggregate scores per model.
- `<model>/results.jsonl` one record per task, including metrics, expected diff checks, preservation failures, and the produced SVG.
- `<model>/svgs/*.svg` when `--save-svgs` is passed.

## Anthropic (claude-sonnet-4-6 default)

```sh
export ANTHROPIC_API_KEY="..."
pip install -e 'sdk/python[anthropic]'
vec-edit-gym evaluate vector_edit_gym.examples.claude_solver:solve --limit 10
```

## Sanity baselines (no API needed)

```sh
vec-edit-gym evaluate vector_edit_gym.examples.oracle_solver:solve  # 100% on all metrics
vec-edit-gym evaluate vector_edit_gym.examples.noop_solver:solve    # floor: 0% exact, 100% preservation
```

## Output

```
VectorEditGym — N tasks
  exact-match:        x%     <- whitespace-normalized byte equality
  structural-match:   x%     <- parsed element tree equality (tag + attrs + nesting)
  preservation (avg): x%     <- fraction of should_preserve elements byte-identical
  errors:             x%     <- solver exceptions
  mean latency:       x ms

By difficulty:
  very_easy   n=N  exact=x%  struct=x%  preserve=x%
  ...
```

Add `--json` to get machine-readable results.

For a single produced SVG:

```sh
vec-edit-gym score ea_001 produced.svg
vec-edit-gym score ea_001 produced.svg --json
```
