"""Task loader and dataclass."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional


# Resolve the data/ directory by walking up from this file.
# The benchmark repo layout:  <repo>/sdk/python/vector_edit_gym/tasks.py
#                            and  <repo>/data/tasks/*.json
def _default_data_dir() -> Path:
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        candidate = parent / "data" / "tasks"
        if candidate.is_dir():
            return candidate
    # Fall back to env var if the SDK is installed outside the repo.
    env = os.environ.get("VECTOR_EDIT_GYM_DATA")
    if env:
        return Path(env)
    raise FileNotFoundError(
        "Could not find data/tasks. Set VECTOR_EDIT_GYM_DATA to the absolute path."
    )


@dataclass
class Task:
    """One benchmark task: a corrupted SVG plus the fix to produce."""

    task_id: str
    difficulty: str
    category: str
    instruction: str
    initial_svg: str
    target_svg: str
    parts: list[str] = field(default_factory=list)
    target_parts: list[str] = field(default_factory=list)
    expected_diff: list[dict] = field(default_factory=list)
    should_preserve: list[str] = field(default_factory=list)
    # Optional structured authoring data (present on tasks created via the
    # authoring UI; absent on legacy auto-generated ones).
    draft: Optional[dict] = None

    @classmethod
    def from_json(cls, raw: dict) -> "Task":
        return cls(
            task_id=raw["task_id"],
            difficulty=raw["difficulty"],
            category=raw.get("category", "unknown"),
            instruction=raw["instruction"],
            initial_svg=raw["initial_svg"],
            target_svg=raw["target_svg"],
            parts=raw.get("parts", []),
            target_parts=raw.get("target_parts", raw.get("expected_diff", [])
                                  and [d.get("part") for d in raw.get("expected_diff", [])]),
            expected_diff=raw.get("expected_diff", []),
            should_preserve=raw.get("should_preserve", []),
            draft=raw.get("draft"),
        )


# --------------------------------------------------------------------------

_DIFFICULTY_ORDER = {
    "very_easy": 0, "easy": 1, "medium": 2, "hard": 3, "very_hard": 4,
}

_TASK_FILE_RE = re.compile(r"^[a-z]+_\d+\.json$")


def load_task(task_id: str, *, data_dir: Optional[Path] = None) -> Task:
    """Load one task by id (e.g. 've_001')."""
    d = Path(data_dir) if data_dir else _default_data_dir()
    path = d / f"{task_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"task not found: {path}")
    return Task.from_json(json.loads(path.read_text()))


def load_tasks(
    *,
    difficulty: Optional[str | Iterable[str]] = None,
    category: Optional[str | Iterable[str]] = None,
    data_dir: Optional[Path] = None,
) -> list[Task]:
    """Load every task on disk, optionally filtered by difficulty/category.

    Args:
        difficulty: one difficulty name or a collection of names.
        category: one category name or a collection of names.
        data_dir: override the data/tasks directory.

    Returns:
        Tasks sorted by (difficulty tier, task_id).
    """
    d = Path(data_dir) if data_dir else _default_data_dir()
    diff_set = _to_set(difficulty)
    cat_set = _to_set(category)

    out: list[Task] = []
    for f in sorted(os.listdir(d)):
        if not _TASK_FILE_RE.match(f):
            continue
        try:
            t = Task.from_json(json.loads((d / f).read_text()))
        except Exception:
            continue
        if diff_set and t.difficulty not in diff_set:
            continue
        if cat_set and t.category not in cat_set:
            continue
        out.append(t)

    out.sort(key=lambda t: (_DIFFICULTY_ORDER.get(t.difficulty, 99), t.task_id))
    return out


def _to_set(x: Any) -> Optional[set[str]]:
    if x is None:
        return None
    if isinstance(x, str):
        return {x}
    return set(x)
