#!/usr/bin/env python3
"""Run VectorEditGym against one or more models behind a LiteLLM proxy."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sdk" / "python"))

from vector_edit_gym.diffing import diff_report  # noqa: E402
from vector_edit_gym.tasks import Task, load_tasks  # noqa: E402


SYSTEM = (
    "You are a precise SVG editor. The user will give you a CORRUPTED SVG and a "
    "natural-language instruction describing what to fix. Return ONLY the corrected "
    "SVG as a complete, valid <svg>...</svg> document. No markdown fences, no "
    "commentary, no explanation."
)

SYSTEM_V2 = (
    "Return only the corrected complete <svg>...</svg>. Apply the requested patch."
)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    client = _client(args)

    if args.list_models:
        for model in sorted(m.id for m in client.models.list().data):
            print(model)
        return 0

    models = _parse_models(args.models)
    if not models:
        raise SystemExit("provide --models or use --list-models")

    tasks = load_tasks(difficulty=args.difficulty, category=args.category, data_dir=args.data_dir)
    task_ids = _parse_items(args.task_ids)
    if task_ids:
        by_id = {task.task_id: task for task in tasks}
        missing = [task_id for task_id in task_ids if task_id not in by_id]
        if missing:
            raise SystemExit(f"task id(s) not selected or not found: {', '.join(missing)}")
        tasks = [by_id[task_id] for task_id in task_ids]
    if args.limit:
        tasks = tasks[: args.limit]
    if not tasks:
        raise SystemExit("no tasks selected")

    run_name = args.run_name or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = Path(args.out) / run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    (run_dir / "meta.json").write_text(
        json.dumps(
            {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "models": models,
                "task_count": len(tasks),
                "difficulty": args.difficulty,
                "category": args.category,
                "limit": args.limit,
                "task_ids": task_ids,
                "data_dir": str(args.data_dir) if args.data_dir else None,
                "prompt_version": args.prompt_version,
                "expose_expected_diff": args.expose_expected_diff,
                "base_url": _normalise_base_url(args.base_url or os.environ.get("LITELLM_BASE_URL", "")),
                "token_param": args.token_param,
            },
            indent=2,
        )
    )

    summaries: list[dict[str, Any]] = []
    for model in models:
        summaries.append(_run_model(client, model, tasks, args, run_dir))

    (run_dir / "summary.json").write_text(json.dumps(summaries, indent=2))
    (run_dir / "summary.md").write_text(_summary_markdown(summaries))
    print(f"\nWrote benchmark artifacts to {run_dir}", file=sys.stderr)
    return 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=[], help="model names, space or comma separated")
    parser.add_argument("--list-models", action="store_true", help="list models exposed by LiteLLM and exit")
    parser.add_argument("--difficulty", help="filter task difficulty")
    parser.add_argument("--category", help="filter task category")
    parser.add_argument("--limit", type=int, help="run only the first N selected tasks")
    parser.add_argument("--task-ids", nargs="+", default=[], help="specific task ids, space or comma separated")
    parser.add_argument("--data-dir", type=Path, help="task directory, e.g. data/tasks_v2")
    parser.add_argument("--prompt-version", choices=("v1", "v2"), default="v1")
    parser.add_argument(
        "--expose-expected-diff",
        action="store_true",
        help="include structured expected_diff in v2 prompts; useful for prompt-smoke checks, not hard evaluation",
    )
    parser.add_argument("--out", default="runs/litellm", help="artifact directory")
    parser.add_argument("--run-name", help="subdirectory name under --out")
    parser.add_argument("--base-url", help="override LITELLM_BASE_URL")
    parser.add_argument("--api-key-env", default="LITELLM_API_KEY", help="environment variable containing API key")
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument(
        "--token-param",
        choices=("max_tokens", "max_completion_tokens"),
        default="max_tokens",
        help="chat completion token limit field used by the provider",
    )
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--temperature", type=float, help="optional chat temperature; omitted by default")
    parser.add_argument("--save-svgs", action="store_true", help="write produced SVGs as files")
    parser.add_argument(
        "--no-produced-in-jsonl",
        action="store_true",
        help="omit produced_svg from JSONL records",
    )
    return parser.parse_args(argv)


def _parse_models(items: list[str]) -> list[str]:
    return _parse_items(items)


def _parse_items(items: list[str]) -> list[str]:
    out: list[str] = []
    for item in items:
        out.extend(x.strip() for x in item.split(",") if x.strip())
    return out


def _normalise_base_url(url: str) -> str:
    if not url:
        return url
    url = url.rstrip("/")
    return url if url.endswith("/v1") else f"{url}/v1"


def _client(args: argparse.Namespace):
    try:
        from openai import OpenAI
    except ImportError as e:  # pragma: no cover
        raise SystemExit(
            "openai SDK not installed. Run: pip install -e 'sdk/python[litellm]'"
        ) from e

    api_key = os.environ.get(args.api_key_env)
    base_url = args.base_url or os.environ.get("LITELLM_BASE_URL")
    if not api_key:
        raise SystemExit(f"missing API key env var: {args.api_key_env}")
    if not base_url:
        raise SystemExit("missing LITELLM_BASE_URL or --base-url")
    return OpenAI(api_key=api_key, base_url=_normalise_base_url(base_url), timeout=args.timeout)


def _run_model(
    client,
    model: str,
    tasks: list[Task],
    args: argparse.Namespace,
    run_dir: Path,
) -> dict[str, Any]:
    model_dir = run_dir / _slug(model)
    svg_dir = model_dir / "svgs"
    model_dir.mkdir(parents=True, exist_ok=True)
    if args.save_svgs:
        svg_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, Any]] = []
    jsonl_path = model_dir / "results.jsonl"
    with jsonl_path.open("w") as f:
        for index, task in enumerate(tasks, start=1):
            t0 = time.perf_counter()
            produced: str | None = None
            error: str | None = None
            try:
                produced = _solve(client, model, task, args)
            except Exception as e:  # noqa: BLE001 - benchmark should record provider failures
                error = f"{type(e).__name__}: {e}"
            elapsed_ms = (time.perf_counter() - t0) * 1000

            if produced is None:
                report = None
                metrics = {"exact": False, "structural": False, "preservation": 0.0}
            else:
                report = diff_report(task, produced).to_dict()
                metrics = {
                    "exact": bool(report["exact"]),
                    "structural": bool(report["structural"]),
                    "preservation": float(report["preservation"]),
                }
                if args.save_svgs:
                    (svg_dir / f"{task.task_id}.svg").write_text(produced)

            record = {
                "model": model,
                "task_id": task.task_id,
                "difficulty": task.difficulty,
                "category": task.category,
                "instruction": task.instruction,
                "expected_diff": task.expected_diff,
                "target_parts": task.target_parts,
                "should_preserve": task.should_preserve,
                "elapsed_ms": elapsed_ms,
                "error": error,
                "metrics": metrics,
                "diff_report": report,
            }
            if produced is not None and not args.no_produced_in_jsonl:
                record["produced_svg"] = produced
            f.write(json.dumps(record) + "\n")
            f.flush()
            records.append(record)

            marker = _marker(metrics, error)
            print(
                f"[{model}] [{index:>4}/{len(tasks)}] {task.task_id:<8} {marker} "
                f"({elapsed_ms:.0f} ms)",
                file=sys.stderr,
            )

    summary = _summarise(model, records)
    (model_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


def _solve(client, model: str, task: Task, args: argparse.Namespace) -> str:
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": _messages(task, args.prompt_version, expose_expected_diff=args.expose_expected_diff),
    }
    kwargs[args.token_param] = args.max_tokens
    if args.temperature is not None:
        kwargs["temperature"] = args.temperature
    resp = client.chat.completions.create(**kwargs)
    text = resp.choices[0].message.content or ""
    return _extract_svg(text)


def _messages(task: Task, prompt_version: str, *, expose_expected_diff: bool = False) -> list[dict[str, str]]:
    if prompt_version == "v2":
        content = f"Instruction:\n{task.instruction}\n\nCorrupted SVG:\n{task.initial_svg}"
        if expose_expected_diff:
            content += (
                "\n\nExpected diff metadata:\n"
                f"{json.dumps(_task_prompt_payload(task, expose_expected_diff=True), indent=2)}"
            )
        return [
            {"role": "system", "content": SYSTEM_V2},
            {"role": "user", "content": content},
        ]
    return [
        {"role": "system", "content": SYSTEM},
        {
            "role": "user",
            "content": (
                f"Instruction:\n{task.instruction}\n\n"
                f"Corrupted SVG:\n{task.initial_svg}\n\n"
                "Return the corrected SVG."
            ),
        },
    ]


def _task_prompt_payload(task: Task, *, expose_expected_diff: bool = False) -> dict[str, Any]:
    payload = {
        "task_id": task.task_id,
        "difficulty": task.difficulty,
        "category": task.category,
        "instruction": task.instruction,
    }
    if expose_expected_diff:
        payload["target_parts"] = task.target_parts
        payload["should_preserve"] = task.should_preserve
        payload["expected_diff"] = task.expected_diff
    return payload


def _extract_svg(text: str) -> str:
    match = re.search(r"```(?:svg|xml)?\s*(<svg[\s\S]*?</svg>)\s*```", text)
    if match:
        return match.group(1)
    match = re.search(r"(<svg[\s\S]*?</svg>)", text)
    return match.group(1) if match else text.strip()


def _marker(metrics: dict[str, Any], error: str | None) -> str:
    if error:
        return "ERR"
    if metrics["exact"]:
        return "EXACT"
    if metrics["structural"]:
        return "STRUCT"
    if metrics["preservation"]:
        return "PRES"
    return "FAIL"


def _summarise(model: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(records)
    if n == 0:
        return {"model": model, "n": 0}
    summary = {
        "model": model,
        "n": n,
        "exact_rate": _mean(records, lambda r: 1.0 if r["metrics"]["exact"] else 0.0),
        "structural_rate": _mean(records, lambda r: 1.0 if r["metrics"]["structural"] else 0.0),
        "preservation_mean": _mean(records, lambda r: float(r["metrics"]["preservation"])),
        "expected_change_pass_rate": _expected_change_pass_rate(records),
        "by_expected_attribute": _expected_change_by_attribute(records),
        "unexpected_changed_parts_mean": _mean(
            records,
            lambda r: float(len((r.get("diff_report") or {}).get("unexpected_changed_parts", []))),
        ),
        "error_rate": _mean(records, lambda r: 1.0 if r["error"] else 0.0),
        "mean_latency_ms": _mean(records, lambda r: float(r["elapsed_ms"])),
        "by_difficulty": _bucket(records, "difficulty"),
        "by_category": _bucket(records, "category"),
    }
    return summary


def _mean(records: list[dict[str, Any]], fn) -> float:
    return sum(fn(record) for record in records) / len(records)


def _bucket(records: list[dict[str, Any]], key: str) -> dict[str, dict[str, float]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        buckets[str(record[key])].append(record)
    return {
        name: {
            "n": len(items),
            "exact": _mean(items, lambda r: 1.0 if r["metrics"]["exact"] else 0.0),
            "structural": _mean(items, lambda r: 1.0 if r["metrics"]["structural"] else 0.0),
            "preservation": _mean(items, lambda r: float(r["metrics"]["preservation"])),
            "errors": _mean(items, lambda r: 1.0 if r["error"] else 0.0),
        }
        for name, items in buckets.items()
    }


def _expected_change_pass_rate(records: list[dict[str, Any]]) -> float:
    total = 0
    passed = 0
    for record in records:
        report = record.get("diff_report") or {}
        for check in report.get("expected_changes", []):
            total += 1
            if check.get("passed"):
                passed += 1
    return passed / total if total else 0.0


def _expected_change_by_attribute(records: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    totals: dict[str, int] = defaultdict(int)
    passed: dict[str, int] = defaultdict(int)
    for record in records:
        report = record.get("diff_report") or {}
        for check in report.get("expected_changes", []):
            attr = str(check.get("attribute"))
            totals[attr] += 1
            if check.get("passed"):
                passed[attr] += 1
    return {
        attr: {
            "n": totals[attr],
            "passed": passed[attr],
            "rate": passed[attr] / totals[attr] if totals[attr] else 0.0,
        }
        for attr in sorted(totals)
    }


def _summary_markdown(summaries: list[dict[str, Any]]) -> str:
    lines = [
        "| model | n | exact | structural | preservation | expected changes | unexpected parts | errors | mean latency |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for summary in summaries:
        lines.append(
            "| {model} | {n} | {exact:.1%} | {struct:.1%} | {pres:.1%} | {diff:.1%} | {unexpected:.2f} | {err:.1%} | {lat:.0f} ms |".format(
                model=summary["model"],
                n=summary["n"],
                exact=summary["exact_rate"],
                struct=summary["structural_rate"],
                pres=summary["preservation_mean"],
                diff=summary["expected_change_pass_rate"],
                unexpected=summary["unexpected_changed_parts_mean"],
                err=summary["error_rate"],
                lat=summary["mean_latency_ms"],
            )
        )
    return "\n".join(lines) + "\n"


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "model"


if __name__ == "__main__":
    raise SystemExit(main())
