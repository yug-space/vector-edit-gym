#!/usr/bin/env python3
"""Atomically rescore a completed run with the repository's current evaluator."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sdk" / "python"))

from vector_edit_gym.diffing import EVALUATOR_VERSION, diff_report, outcome_status  # noqa: E402
from vector_edit_gym.tasks import load_tasks  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--tasks", type=Path, default=ROOT / "data" / "tasks")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    results_path = args.run_dir / "results.jsonl"
    meta_path = args.run_dir / "meta.json"
    records = [json.loads(line) for line in results_path.read_text().splitlines() if line.strip()]
    meta = json.loads(meta_path.read_text())
    validate_matrix(records, meta)
    tasks = {task.task_id: task for task in load_tasks(data_dir=args.tasks)}

    changed = 0
    for record in records:
        if record.get("error") is not None:
            updates = {
                "status": "ERR",
                "reward": 0,
                "specification_pass": False,
                "near_pass": False,
                "repair_pass": False,
                "preservation_pass": False,
                "source_preservation_pass": False,
                "validity_pass": False,
                "exact": False,
                "structural": False,
                "edit_completion": 0.0,
                "repair_progress": 0.0,
                "preservation": 0.0,
                "source_preservation": 0.0,
                "unintended_change_rate": 1.0,
            }
            if any(record.get(key) != value for key, value in updates.items()):
                changed += 1
            record.update(updates)
            continue
        task = tasks[record["task_id"]]
        report = diff_report(task, str(record.get("produced_svg") or "")).to_dict()
        updates = {
            "status": outcome_status(report),
            "reward": report["reward"],
            "specification_pass": report["specification_pass"],
            "near_pass": report["near_pass"],
            "repair_pass": report["repair_pass"],
            "preservation_pass": report["preservation_pass"],
            "source_preservation_pass": report["source_preservation_pass"],
            "validity_pass": report["validity_pass"],
            "exact": report["exact"],
            "structural": report["structural"],
            "edit_completion": report["edit_completion"],
            "repair_progress": report["repair_progress"],
            "preservation": report["preservation"],
            "source_preservation": report["source_preservation"],
            "unintended_change_rate": report["unintended_change_rate"],
            "diff_report": report,
        }
        if any(record.get(key) != value for key, value in updates.items()):
            changed += 1
        record.update(updates)

    summaries = summarize(records, meta["models"])
    task_index = json.loads((args.tasks / "_index.json").read_text())
    meta["rescored_at"] = datetime.now(timezone.utc).isoformat()
    meta["evaluator"] = EVALUATOR_VERSION
    meta["corpus_hash"] = task_index["frozen_content_sha256"]
    meta.setdefault("sdk_max_retries", 2)
    atomic_write(results_path, "".join(json.dumps(record, ensure_ascii=True) + "\n" for record in records))
    atomic_write(args.run_dir / "summary.json", json.dumps(summaries, indent=2) + "\n")
    atomic_write(args.run_dir / "summary.md", summary_markdown(summaries))
    atomic_write(
        args.run_dir / "cost.json",
        json.dumps(
            {
                "cap_usd": float(meta["budget_usd"]),
                "spent_usd": sum(float(record.get("cost_usd") or 0) for record in records),
            },
            indent=2,
        )
        + "\n",
    )
    atomic_write(meta_path, json.dumps(meta, indent=2) + "\n")
    print(f"Rescored {len(records)} records; {changed} row(s) changed")
    return 0


def validate_matrix(records: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    expected = {
        (model["id"], task_id)
        for model in meta["models"]
        for task_id in meta["task_ids"]
    }
    actual = [(record.get("requested_model"), record.get("task_id")) for record in records]
    duplicates = [pair for pair, count in Counter(actual).items() if count > 1]
    missing = expected - set(actual)
    unexpected = set(actual) - expected
    if duplicates or missing or unexpected:
        raise SystemExit(
            "invalid result matrix: "
            f"{len(duplicates)} duplicate, {len(missing)} missing, {len(unexpected)} unexpected pair(s)"
        )


def summarize(records: list[dict[str, Any]], models: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record["requested_model"]].append(record)
    summaries = []
    for model in models:
        items = grouped[model["id"]]
        n = len(items)
        summaries.append(
            {
                **model,
                "n": n,
                "spec_pass_rate": mean(items, "reward"),
                "binary_reward": mean(items, "reward"),
                "near_pass_rate": mean(items, "near_pass"),
                "repair_pass_rate": mean(items, "repair_pass"),
                "preservation_pass_rate": mean(items, "preservation_pass"),
                "source_preservation_pass_rate": mean(items, "source_preservation_pass"),
                "exact_rate": mean(items, "exact"),
                "structural_rate": mean(items, "structural"),
                "validity_rate": sum(
                    bool((record.get("diff_report") or {}).get("validity_pass"))
                    for record in items
                ) / n,
                "edit_completion": mean(items, "edit_completion"),
                "repair_progress": mean(items, "repair_progress"),
                "preservation": mean(items, "preservation"),
                "source_preservation": mean(items, "source_preservation"),
                "unintended_change_rate": mean_valid(items, "unintended_change_rate"),
                "error_rate": sum(record.get("error") is not None for record in items) / n,
                "truncation_rate": sum(record.get("finish_reason") == "length" for record in items) / n,
                "mean_elapsed_ms": mean(items, "elapsed_ms"),
                "cost_usd": sum(float(record.get("cost_usd") or 0) for record in items),
                "prompt_tokens": sum(int(record.get("prompt_tokens") or 0) for record in items),
                "completion_tokens": sum(int(record.get("completion_tokens") or 0) for record in items),
            }
        )
    return sorted(
        summaries,
        key=lambda row: (
            -row["spec_pass_rate"],
            -row["repair_progress"],
            row["unintended_change_rate"] if row["unintended_change_rate"] is not None else float("inf"),
            -row["validity_rate"],
            row["name"],
        ),
    )


def mean(items: list[dict[str, Any]], key: str) -> float:
    return sum(float(item.get(key) or 0) for item in items) / len(items)


def mean_valid(items: list[dict[str, Any]], key: str) -> float | None:
    valid = [item for item in items if item.get("validity_pass")]
    return mean(valid, key) if valid else None


def summary_markdown(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| model | group | n | full pass | near | repair progress | clean | UCR | valid | truncated | errors | cost |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in rows:
        ucr = f"{row['unintended_change_rate']:.1%}" if row["unintended_change_rate"] is not None else "n/a"
        lines.append(
            f"| {row['name']} | {row['group']} | {row['n']} | {row['spec_pass_rate']:.1%} | "
            f"{row['near_pass_rate']:.1%} | {row['repair_progress']:.1%} | {row['preservation_pass_rate']:.1%} | "
            f"{ucr} | {row['validity_rate']:.1%} | "
            f"{row['truncation_rate']:.1%} | {row['error_rate']:.1%} | ${row['cost_usd']:.4f} |"
        )
    return "\n".join(lines) + "\n"


def atomic_write(path: Path, content: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(content)
    os.replace(temporary, path)


if __name__ == "__main__":
    raise SystemExit(main())
