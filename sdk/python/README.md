# vector-edit-gym (Python SDK)

Run the VectorEditGym benchmark from Python.

Each task is one corrupted SVG (missing part / extra mark / displaced piece / wrong color / clipped viewBox) plus a natural-language fix instruction. A solver maps `Task -> str` (the fixed SVG). The SDK scores produced SVGs against the ground-truth target using three metrics: exact-match, structural-match (tag/attr equivalence), and preservation-score (fraction of `should_preserve` parts left untouched).

## Install

From the repo root:

```sh
pip install -e sdk/python              # core
pip install -e 'sdk/python[openai]'    # OpenAI SDK examples
pip install -e 'sdk/python[litellm]'   # LiteLLM OpenAI-compatible proxy runner
pip install -e 'sdk/python[anthropic]' # Anthropic SDK example
```

The SDK auto-discovers `data/tasks/` by walking up from the install location. To point at a different dataset:

```sh
export VECTOR_EDIT_GYM_DATA=/abs/path/to/data/tasks
```

## Quick start (Python)

```python
from vector_edit_gym import load_tasks, evaluate

def my_solver(task) -> str:
    # Trivial: do nothing.
    return task.initial_svg

tasks = load_tasks(difficulty="very_easy")
result = evaluate(my_solver, tasks)
print(result.summary())
```

## CLI

```sh
vec-edit-gym list                                       # all tasks
vec-edit-gym list --difficulty easy --category missing_part
vec-edit-gym show ve_001                                # task as JSON
vec-edit-gym show ve_001 --field initial_svg            # just the SVG

# Run a solver (spec = module:function OR path/to/file.py:function)
vec-edit-gym evaluate vector_edit_gym.examples.noop_solver:solve
vec-edit-gym evaluate vector_edit_gym.examples.oracle_solver:solve  # 100% exact
vec-edit-gym evaluate ./my_solver.py:fix --limit 20
vec-edit-gym score ea_001 produced.svg --json

# With the Claude reference solver:
export ANTHROPIC_API_KEY=...
vec-edit-gym evaluate vector_edit_gym.examples.claude_solver:solve --difficulty very_easy --limit 5

# With a LiteLLM OpenAI-compatible proxy:
export LITELLM_API_KEY="..."
export LITELLM_BASE_URL="https://your-litellm-proxy"
VEG_LITELLM_MODEL=gpt-5-mini \
  vec-edit-gym evaluate vector_edit_gym.examples.litellm_solver:solve --limit 5

# Full multi-model benchmark with per-task diff reports:
python scripts/benchmark-litellm.py --models gpt-5 gpt-5-mini
```

## The Task object

```python
@dataclass
class Task:
    task_id: str            # e.g. "ve_001"
    difficulty: str         # very_easy | easy | medium | hard | very_hard
    category: str           # e.g. "missing_part", "wrong_color"
    instruction: str        # natural-language fix request
    initial_svg: str        # corrupted SVG
    target_svg: str         # the correct fix
    parts: list[str]        # every element id in the scene
    target_parts: list[str] # ids that must change (the things to fix)
    expected_diff: list[dict]   # structured diff: [{part, attribute, before, after}, ...]
    should_preserve: list[str]  # ids that must be byte-identical between produced and target
    draft: dict | None      # the structured authoring data (when present)
```

## Metrics

- **exact_match** — string-equal to the target (whitespace-normalized).
- **structural_match** — element tree matches after parsing (tag / attrs / nesting), ignores formatting differences.
- **preservation_score** — fraction of `should_preserve` element ids whose subtrees are byte-identical between the produced and target SVGs.

## Aggregates

```python
result.exact_rate              # float
result.structural_rate         # float
result.preservation_mean       # float
result.error_rate              # solver-raised exceptions
result.mean_latency_ms         # solver wall time
result.by_difficulty()         # {tier: {n, exact, structural, preservation, errors}}
result.by_category()
```

## Diff reports

Use `vec-edit-gym score` for one produced SVG, or `scripts/benchmark-litellm.py` for full runs. The report includes exact/structural/preservation metrics, every expected change from `expected_diff`, and preserve-part failures.

```sh
vec-edit-gym show ea_001 --field target_svg > /tmp/ea_001.svg
vec-edit-gym score ea_001 /tmp/ea_001.svg
```

## Writing your own solver

A solver is any callable `(Task) -> str`. Inspect `task.instruction` and `task.initial_svg`; return the fixed SVG. See `vector_edit_gym/examples/claude_solver.py` for a Claude-API reference and `noop_solver.py` / `oracle_solver.py` for the floor/ceiling baselines.
