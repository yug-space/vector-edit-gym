# vector-edit-gym Python SDK

The SDK loads the frozen 40-task corpus, evaluates solver-produced SVGs, and emits object-level diff reports.

## Install

From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'sdk/python[test]'
```

Optional dependency groups:

```sh
python -m pip install -e 'sdk/python[openai]'
python -m pip install -e 'sdk/python[anthropic]'
python -m pip install -e 'sdk/python[litellm]'
python -m pip install -e 'sdk/python[analysis]'
```

The package discovers `data/tasks/` from the repository. Override it with `VECTOR_EDIT_GYM_DATA=/absolute/path/to/tasks`.

## Python API

```python
from vector_edit_gym import evaluate, load_tasks

def solve(task) -> str:
    # Use only task.instruction and task.initial_svg in a benchmark submission.
    return call_your_model(task.instruction, task.initial_svg)

result = evaluate(solve, load_tasks())
print(result.summary())
print(result.reward_mean)
print(result.edit_completion_mean)
print(result.unintended_change_rate)
print(result.validity_rate)
```

`Task` includes the public input and private evaluator fields:

```python
Task(
    task_id="sv_001",
    difficulty="hard",
    category="scenic_multi",
    instruction="...human visual request...",
    initial_svg="<svg>...</svg>",
    target_svg="<svg>...</svg>",
    target_parts=[...],
    expected_diff=[...],
    should_preserve=[...],
)
```

## Metrics

- `reward`: integer `1` only for canonical target equivalence; otherwise `0`
- `exact`: source equality after whitespace normalization
- `structural`: canonical element-tree equality
- `edit_completion`: fraction of private expected repairs passed
- `preservation`: fraction of protected object subtrees unchanged
- `unintended_change_rate`: fraction of protected object subtrees changed
- `produced_parse_ok`: output XML validity

Canonical comparison normalizes attribute ordering, namespaces, numeric spellings, path/list separators, and common equivalent CSS color spellings. Semantic SVG program changes remain strict.

## CLI

```sh
vec-edit-gym list
vec-edit-gym show sv_001
vec-edit-gym show sv_001 --field initial_svg
vec-edit-gym score sv_001 produced.svg
vec-edit-gym score sv_001 produced.svg --json
vec-edit-gym evaluate ./my_solver.py:solve --limit 5 --json
```

The score report lists every requested-edit check, preservation failure, unexpected element, document-level mismatch, binary reward, edit completion, and UCR.

## Tests

```sh
python -m pytest sdk/python/tests -q
```

Tests cover canonical formatting equivalence, target success, unchanged-output failure, malformed SVG, protected-object deletion, and unknown-element insertion.
