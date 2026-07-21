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
print(result.specification_pass_rate)
print(result.repair_pass_rate)
print(result.near_pass_rate)
print(result.preservation_pass_rate)
print(result.edit_completion_mean)
print(result.repair_progress_mean)
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

- `reward`: integer `1` only when requested repairs, semantic preservation, and SVG validity all pass
- `near_pass`: valid, semantically clean output with at most one missed repair and at least 80% aggregate repair progress; diagnostic only
- `repair_pass`: every requested value is within its deterministic attribute-aware tolerance
- `preservation_pass`: the rendering-relevant document is unchanged after masking requested fields; consistent ID aliases and style storage rewrites are accepted
- `source_preservation_pass`: strict source-tree preservation after masking requested fields, reported as a diagnostic
- `validity_pass`: complete SVG root, valid XML/SVG syntax, and unique nonempty IDs
- `exact`: source equality after whitespace normalization
- `structural`: canonical full-target equality, retained as a diagnostic only
- `edit_completion`: fraction of private expected repairs passed
- `repair_progress`: mean clipped progress from each corrupted value toward its hidden target
- `preservation`: fraction of protected object subtrees unchanged
- `unintended_change_rate`: fraction of protected object subtrees changed
- `produced_parse_ok`: whether the output parses as XML
- `produced_valid_svg`: whether the parsed output passes structural SVG validity

Requested numeric, color, path, and point values use deterministic perceptual tolerances. Paths are compared by sampled geometry, not command-string topology. The semantic preservation comparator aligns elements by ID and stable tree position, canonicalizes style storage, and aliases consistent ID rewrites. Everything outside requested fields remains rendering-relevant and order-sensitive.

## CLI

```sh
vec-edit-gym list
vec-edit-gym show sv_001
vec-edit-gym show sv_001 --field initial_svg
vec-edit-gym score sv_001 produced.svg
vec-edit-gym score sv_001 produced.svg --json
vec-edit-gym evaluate ./my_solver.py:solve --limit 5 --json
```

The score report lists every requested-edit check and tolerance, all three binary gates, preservation failures, unexpected document changes, edit completion, target match, and UCR.

## Tests

```sh
python -m pytest sdk/python/tests -q
```

Tests cover canonical formatting equivalence, approximate repair success, tolerance rejection, strict whole-document preservation, malformed SVG, duplicate IDs, protected-object deletion, and unknown-element insertion.
