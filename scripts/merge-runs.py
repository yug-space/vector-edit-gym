#!/usr/bin/env python3
"""Merge compatible completed benchmark runs into one auditable result matrix."""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


COMPATIBILITY_FIELDS = (
    "benchmark",
    "protocol",
    "corpus_hash",
    "system_prompt",
    "prompt_visibility",
    "hidden_from_model",
    "task_ids",
    "task_count",
    "base_url",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_run", type=Path)
    parser.add_argument("source_runs", type=Path, nargs="+")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sources = [load_run(path) for path in args.source_runs]
    if len(sources) < 2:
        raise SystemExit("provide at least two source runs")
    if args.output_run.resolve() in {path.resolve() for path in args.source_runs}:
        raise SystemExit("the output run must not be one of the source runs")
    if args.output_run.exists() and any(args.output_run.iterdir()):
        raise SystemExit(f"output run is not empty: {args.output_run}")

    baseline = sources[0]["meta"]
    for source in sources[1:]:
        assert_compatible(baseline, source["meta"], source["path"])

    models: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    model_ids: set[str] = set()
    source_details = []
    for source in sources:
        meta = source["meta"]
        duplicate_models = model_ids.intersection(model["id"] for model in meta["models"])
        if duplicate_models:
            raise SystemExit(
                f"duplicate model ID across runs: {sorted(duplicate_models)[0]}"
            )
        models.extend(meta["models"])
        model_ids.update(model["id"] for model in meta["models"])
        records.extend(source["records"])
        source_details.append(
            {
                "run": source["path"].name,
                "created_at": meta.get("created_at"),
                "models": len(meta["models"]),
                "records": len(source["records"]),
                "budget_usd": float(meta.get("budget_usd") or 0),
                "estimated_catalog_cost_usd": float(
                    meta.get("estimated_catalog_cost_usd") or 0
                ),
                "recorded_cost_usd": sum(
                    float(record.get("cost_usd") or 0)
                    for record in source["records"]
                ),
            }
        )

    task_order = {task_id: index for index, task_id in enumerate(baseline["task_ids"])}
    model_order = {model["id"]: index for index, model in enumerate(models)}
    records.sort(
        key=lambda record: (
            model_order[record["requested_model"]],
            task_order[record["task_id"]],
        )
    )
    validate_matrix(records, models, baseline["task_ids"], "combined run")

    created_at = max(
        str(source["meta"].get("created_at") or "") for source in sources
    )
    combined_meta = {
        **baseline,
        "created_at": created_at,
        "manifest": [str(source["meta"].get("manifest")) for source in sources],
        "models": models,
        "budget_usd": sum(detail["budget_usd"] for detail in source_details),
        "estimated_catalog_cost_usd": sum(
            detail["estimated_catalog_cost_usd"] for detail in source_details
        ),
        "resumed_spend_usd": sum(
            float(source["meta"].get("resumed_spend_usd") or 0)
            for source in sources
        ),
        "source_runs": source_details,
        "merged_at": datetime.now(timezone.utc).isoformat(),
    }

    args.output_run.mkdir(parents=True, exist_ok=True)
    atomic_write(
        args.output_run / "meta.json",
        json.dumps(combined_meta, indent=2) + "\n",
    )
    atomic_write(
        args.output_run / "results.jsonl",
        "".join(json.dumps(record, ensure_ascii=True) + "\n" for record in records),
    )
    print(
        f"Merged {len(sources)} runs into {args.output_run}: "
        f"{len(models)} models x {len(baseline['task_ids'])} tasks = {len(records)} records"
    )
    print("Run scripts/rescore-results.py on the merged directory before publishing.")
    return 0


def load_run(path: Path) -> dict[str, Any]:
    meta_path = path / "meta.json"
    results_path = path / "results.jsonl"
    if not meta_path.exists() or not results_path.exists():
        raise SystemExit(f"missing meta.json or results.jsonl in {path}")
    meta = json.loads(meta_path.read_text())
    records = [
        json.loads(line)
        for line in results_path.read_text().splitlines()
        if line.strip()
    ]
    validate_matrix(records, meta["models"], meta["task_ids"], str(path))
    return {"path": path, "meta": meta, "records": records}


def assert_compatible(
    baseline: dict[str, Any], candidate: dict[str, Any], candidate_path: Path
) -> None:
    mismatches = [
        field
        for field in COMPATIBILITY_FIELDS
        if baseline.get(field) != candidate.get(field)
    ]
    if mismatches:
        raise SystemExit(
            f"incompatible run {candidate_path}; mismatched field(s): "
            + ", ".join(mismatches)
        )


def validate_matrix(
    records: list[dict[str, Any]],
    models: list[dict[str, Any]],
    task_ids: list[str],
    label: str,
) -> None:
    expected = {
        (model["id"], task_id)
        for model in models
        for task_id in task_ids
    }
    actual = [
        (record.get("requested_model"), record.get("task_id"))
        for record in records
    ]
    duplicates = [pair for pair, count in Counter(actual).items() if count > 1]
    missing = expected - set(actual)
    unexpected = set(actual) - expected
    if duplicates or missing or unexpected:
        raise SystemExit(
            f"invalid result matrix in {label}: {len(duplicates)} duplicate, "
            f"{len(missing)} missing, {len(unexpected)} unexpected pair(s)"
        )


def atomic_write(path: Path, content: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(content)
    os.replace(temporary, path)


if __name__ == "__main__":
    raise SystemExit(main())
