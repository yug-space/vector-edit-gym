#!/usr/bin/env python3
"""Assign a mixed display/benchmark order for v2 tasks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    args = parse_args()
    tasks = []
    for path in sorted(args.tasks_dir.glob("sv_*.json")):
        tasks.append((path, json.loads(path.read_text())))
    if not tasks:
        raise SystemExit(f"no v2 tasks found in {args.tasks_dir}")

    curated = [(p, t) for p, t in tasks if t.get("category") != "downloaded_scenic_surgical"]
    downloaded = [(p, t) for p, t in tasks if t.get("category") == "downloaded_scenic_surgical"]
    mixed = interleave(curated, downloaded)

    if len(mixed) != len(tasks):
        raise SystemExit("mixed task count changed")

    for index, (path, task) in enumerate(mixed, start=1):
        task["display_order"] = index
        task["input_svg_role"] = "disturbed"
        task["target_svg_role"] = "clean_original"
        if task.get("initial_svg") == task.get("target_svg"):
            raise SystemExit(f"{task.get('task_id', path.name)} has identical input and target SVGs")
        path.write_text(json.dumps(task, indent=2))

    print(f"mixed display order for {len(mixed)} v2 tasks")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks-dir", type=Path, default=ROOT / "data" / "tasks_v2")
    return parser.parse_args()


def interleave(*groups: list[tuple[Path, dict[str, Any]]]) -> list[tuple[Path, dict[str, Any]]]:
    mixed: list[tuple[Path, dict[str, Any]]] = []
    longest = max(len(group) for group in groups)
    for i in range(longest):
        for group in groups:
            if i < len(group):
                mixed.append(group[i])
    return mixed


if __name__ == "__main__":
    raise SystemExit(main())
