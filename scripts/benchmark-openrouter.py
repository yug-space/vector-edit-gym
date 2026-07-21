#!/usr/bin/env python3
"""Run the frozen VectorEditGym corpus through OpenRouter-compatible models."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import urllib.request
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sdk" / "python"))

from vector_edit_gym.diffing import EVALUATOR_VERSION, diff_report, outcome_status  # noqa: E402
from vector_edit_gym.tasks import Task, load_tasks  # noqa: E402
from vector_edit_gym.tracing import (  # noqa: E402
    TRACE_SCHEMA_VERSION,
    AppendOnlyTraceWriter,
    append_evaluation,
    prompt_messages,
    sanitize_trace,
    utc_now,
)


BASE_URL = "https://openrouter.ai/api/v1"
CATALOG_URL = f"{BASE_URL}/models"
SDK_MAX_RETRIES = 2
SYSTEM_PROMPT = (
    "You are editing an SVG from a visual repair request. Return only one complete, "
    "valid <svg>...</svg> document. Make the requested visible repairs and preserve "
    "every unmentioned part. Do not include Markdown or an explanation."
)


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    family: str
    group: str


@dataclass
class Pricing:
    prompt: float = 0.0
    completion: float = 0.0


class Budget:
    def __init__(self, limit: float) -> None:
        self.limit = limit
        self.spent = 0.0
        self.reserved = 0.0
        self.lock = asyncio.Lock()

    async def reserve(self, estimate: float) -> bool:
        async with self.lock:
            if self.spent + self.reserved + estimate > self.limit:
                return False
            self.reserved += estimate
            return True

    async def settle(self, estimate: float, actual: float | None) -> float:
        async with self.lock:
            self.reserved = max(0.0, self.reserved - estimate)
            charged = estimate if actual is None else max(0.0, actual)
            self.spent += charged
            return charged


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "benchmarks" / "openrouter-30.json")
    parser.add_argument("--models", nargs="*", help="model IDs or manifest names to run")
    parser.add_argument("--task-ids", nargs="*", help="specific task IDs")
    parser.add_argument("--limit", type=int, help="limit tasks after filtering")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data" / "tasks")
    parser.add_argument("--out", type=Path, default=ROOT / "runs" / "openrouter")
    parser.add_argument("--run-name")
    parser.add_argument("--api-key-env", default="OPENROUTER_API_KEY")
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--budget-usd", type=float, default=25.0)
    parser.add_argument("--concurrency", type=int, default=6)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--max-output-tokens", type=int, default=16000)
    parser.add_argument("--dry-run", action="store_true", help="estimate requests and cost without an API key")
    parser.add_argument("--no-resume", action="store_true")
    return parser.parse_args()


async def async_main(args: argparse.Namespace) -> int:
    manifest = json.loads(args.manifest.read_text())
    models = [ModelSpec(**raw) for raw in manifest["models"]]
    models = select_models(models, args.models)
    tasks = select_tasks(load_tasks(data_dir=args.data_dir), args.task_ids, args.limit)
    if not models or not tasks:
        raise SystemExit("no models or tasks selected")

    catalog = fetch_catalog()
    missing_pricing = [model.id for model in models if model.id not in catalog]
    if missing_pricing:
        print(
            "Warning: conservative fallback pricing will be used for: " + ", ".join(missing_pricing),
            file=sys.stderr,
        )
    pricing = {model.id: catalog.get(model.id, Pricing(15e-6, 75e-6)) for model in models}
    estimated = sum(estimate_request_cost(task, pricing[model.id], args.max_output_tokens) for model in models for task in tasks)
    print(
        f"Selected {len(models)} models x {len(tasks)} tasks = {len(models) * len(tasks)} requests; "
        f"catalog estimate ${estimated:.2f}; cap ${args.budget_usd:.2f}",
        file=sys.stderr,
    )
    if args.dry_run:
        for model in models:
            model_estimate = sum(estimate_request_cost(task, pricing[model.id], args.max_output_tokens) for task in tasks)
            print(f"{model.id:<48} ${model_estimate:.4f}")
        return 0

    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Install the runner in a venv: python -m pip install -e 'sdk/python[litellm]'") from exc
    api_key = os.environ.get(args.api_key_env)
    if not api_key:
        raise SystemExit(f"missing {args.api_key_env}; export it in the shell before running")

    run_name = args.run_name or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = args.out / run_name
    run_dir.mkdir(parents=True, exist_ok=True)
    results_path = run_dir / "results.jsonl"
    trace_writer = AppendOnlyTraceWriter(run_dir / "traces.jsonl", secrets=(api_key,))
    completed = read_completed(results_path) if not args.no_resume else {}
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=args.base_url.rstrip("/"),
        timeout=args.timeout,
        max_retries=SDK_MAX_RETRIES,
    )
    budget = Budget(args.budget_usd)
    budget.spent = sum(float(record.get("cost_usd") or 0.0) for record in completed.values())
    write_meta(run_dir, manifest, models, tasks, args, estimated, budget.spent)

    semaphore = asyncio.Semaphore(max(1, args.concurrency))
    write_lock = asyncio.Lock()
    jobs = [
        run_one(client, model, task, pricing[model.id], args, budget, semaphore, trace_writer)
        for model in models
        for task in tasks
        if (model.id, task.task_id) not in completed
    ]
    total = len(models) * len(tasks)
    finished = len(completed)
    if completed:
        print(f"Resuming with {finished}/{total} records already complete", file=sys.stderr)

    with results_path.open("a", encoding="utf8") as handle:
        for future in asyncio.as_completed(jobs):
            record = await future
            finished += 1
            async with write_lock:
                handle.write(json.dumps(record, ensure_ascii=True) + "\n")
                handle.flush()
            status = record["status"]
            print(
                f"[{finished:>4}/{total}] {record['model_name']:<24} {record['task_id']} "
                f"{status:<7} ${record['cost_usd']:.4f}",
                file=sys.stderr,
            )

    records = list(read_completed(results_path).values())
    summaries = summarize(records, models)
    (run_dir / "summary.json").write_text(json.dumps(summaries, indent=2) + "\n")
    (run_dir / "summary.md").write_text(summary_markdown(summaries))
    (run_dir / "cost.json").write_text(json.dumps({"cap_usd": args.budget_usd, "spent_usd": budget.spent}, indent=2) + "\n")
    print(f"Artifacts: {run_dir}\nRecorded cost: ${budget.spent:.4f}", file=sys.stderr)
    return 0


async def run_one(
    client,
    model: ModelSpec,
    task: Task,
    pricing: Pricing,
    args: argparse.Namespace,
    budget: Budget,
    semaphore: asyncio.Semaphore,
    trace_writer: AppendOnlyTraceWriter,
) -> dict[str, Any]:
    max_tokens = adaptive_max_tokens(task, args.max_output_tokens)
    estimate = estimate_request_cost(task, pricing, args.max_output_tokens)
    trace_id = uuid.uuid4().hex
    request_payload = {
        "base_url": args.base_url.rstrip("/"),
        "model": model.id,
        "messages": messages(task),
        "max_output_tokens": max_tokens,
        "temperature": "provider_default",
    }
    # Reserve a 20% pricing/routing margin without claiming it as final spend.
    reservation = estimate * 1.2
    if not await budget.reserve(reservation):
        trace = {
            "schema_version": TRACE_SCHEMA_VERSION,
            "trace_id": trace_id,
            "retention": "complete",
            "limitations": [],
            "request": request_payload,
            "attempts": [],
            "extraction": {"raw_response": None, "produced_svg": None},
            "evaluations": [],
        }
        record = error_record(
            model,
            task,
            "budget_exhausted",
            "Budget cap reached before request",
            trace=trace,
        )
        append_evaluation(trace, record, EVALUATOR_VERSION, utc_now())
        await trace_writer.emit(
            {
                "event": "request_skipped",
                "trace_id": trace_id,
                "requested_model": model.id,
                "task_id": task.task_id,
                "request": request_payload,
                "error": record["error"],
            }
        )
        return record

    started = time.perf_counter()
    started_at = utc_now()
    response_payload: dict[str, Any] | None = None
    error: str | None = None
    attempts: list[dict[str, Any]] = []
    async with semaphore:
        for attempt in range(args.retries + 1):
            attempt_number = attempt + 1
            attempt_started = time.perf_counter()
            attempt_started_at = utc_now()
            await trace_writer.emit(
                {
                    "event": "request_started",
                    "trace_id": trace_id,
                    "requested_model": model.id,
                    "task_id": task.task_id,
                    "attempt": attempt_number,
                    "request": request_payload,
                }
            )
            try:
                response = await client.chat.completions.create(
                    model=model.id,
                    messages=messages(task),
                    max_tokens=max_tokens,
                    extra_headers={
                        "HTTP-Referer": "https://www.vecbench.xyz",
                        "X-Title": "VectorEditGym",
                    },
                )
                response_payload = response.model_dump()
                attempt_record = {
                    "attempt": attempt_number,
                    "started_at": attempt_started_at,
                    "finished_at": utc_now(),
                    "elapsed_ms": (time.perf_counter() - attempt_started) * 1000,
                    "response": response_payload,
                    "error": None,
                }
                attempts.append(attempt_record)
                await trace_writer.emit(
                    {
                        "event": "response_received",
                        "trace_id": trace_id,
                        "requested_model": model.id,
                        "task_id": task.task_id,
                        **attempt_record,
                    }
                )
                break
            except Exception as exc:  # noqa: BLE001 - provider failures belong in the result set
                error = f"{type(exc).__name__}: {exc}"
                status_code = getattr(exc, "status_code", None)
                retryable = status_code == 429 or (isinstance(status_code, int) and status_code >= 500)
                attempt_error = {
                    "type": type(exc).__name__,
                    "message": str(exc),
                    "status_code": status_code,
                    "retryable": retryable,
                }
                attempt_record = {
                    "attempt": attempt_number,
                    "started_at": attempt_started_at,
                    "finished_at": utc_now(),
                    "elapsed_ms": (time.perf_counter() - attempt_started) * 1000,
                    "response": None,
                    "error": attempt_error,
                }
                attempts.append(attempt_record)
                await trace_writer.emit(
                    {
                        "event": "request_failed",
                        "trace_id": trace_id,
                        "requested_model": model.id,
                        "task_id": task.task_id,
                        **attempt_record,
                    }
                )
                if attempt >= args.retries or not retryable:
                    break
                await asyncio.sleep(min(20.0, 1.5 * (2**attempt)))

    elapsed_ms = (time.perf_counter() - started) * 1000
    usage = extract_usage(response_payload)
    charged = await budget.settle(
        reservation,
        usage.get("cost_usd") if response_payload is not None else 0.0,
    )
    if response_payload is None:
        trace = {
            "schema_version": TRACE_SCHEMA_VERSION,
            "trace_id": trace_id,
            "retention": "complete",
            "limitations": [],
            "started_at": started_at,
            "finished_at": utc_now(),
            "request": request_payload,
            "attempts": attempts,
            "extraction": {"raw_response": None, "produced_svg": None},
            "evaluations": [],
        }
        record = error_record(
            model,
            task,
            "request_error",
            str(sanitize_trace(error or "unknown provider error", trace_writer.secrets)),
            trace=trace,
        )
        record.update({"elapsed_ms": elapsed_ms, "cost_usd": charged})
        append_evaluation(trace, record, EVALUATOR_VERSION, utc_now())
        record["trace"] = sanitize_trace(trace, trace_writer.secrets)
        await trace_writer.emit(
            {
                "event": "evaluation_completed",
                "trace_id": trace_id,
                "requested_model": model.id,
                "task_id": task.task_id,
                "evaluation": trace["evaluations"][-1],
            }
        )
        return record

    choice = (response_payload.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    raw_text = content_text(message.get("content"))
    produced = extract_svg(raw_text)
    report = diff_report(task, produced).to_dict()
    status = outcome_status(report)
    trace = {
        "schema_version": TRACE_SCHEMA_VERSION,
        "trace_id": trace_id,
        "retention": "complete",
        "limitations": [],
        "started_at": started_at,
        "finished_at": utc_now(),
        "request": request_payload,
        "attempts": attempts,
        "extraction": {
            "raw_response": raw_text,
            "raw_response_source": "recorded",
            "produced_svg": produced,
            "method": extraction_method(raw_text, produced),
        },
        "evaluations": [],
    }
    record = {
        "requested_model": model.id,
        "resolved_model": response_payload.get("model"),
        "model_name": model.name,
        "family": model.family,
        "group": model.group,
        "task_id": task.task_id,
        "difficulty": task.difficulty,
        "category": task.category,
        "status": status,
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
        "produced_svg": produced,
        "raw_response": raw_text,
        "response_id": response_payload.get("id"),
        "finish_reason": choice.get("finish_reason"),
        "elapsed_ms": elapsed_ms,
        "max_output_tokens": max_tokens,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "reasoning_tokens": usage.get("reasoning_tokens", 0),
        "cost_usd": charged,
        "error": None,
        "trace": trace,
    }
    append_evaluation(trace, record, EVALUATOR_VERSION, utc_now())
    record["trace"] = sanitize_trace(trace, trace_writer.secrets)
    await trace_writer.emit(
        {
            "event": "extraction_completed",
            "trace_id": trace_id,
            "requested_model": model.id,
            "task_id": task.task_id,
            "extraction": trace["extraction"],
        }
    )
    await trace_writer.emit(
        {
            "event": "evaluation_completed",
            "trace_id": trace_id,
            "requested_model": model.id,
            "task_id": task.task_id,
            "evaluation": trace["evaluations"][-1],
        }
    )
    return record


def messages(task: Task) -> list[dict[str, str]]:
    return prompt_messages(task, SYSTEM_PROMPT)


def extraction_method(raw_text: str, produced: str) -> str:
    if produced == raw_text.strip():
        return "complete_response"
    if re.search(r"```(?:svg|xml)?\s*<svg", raw_text, re.IGNORECASE):
        return "markdown_fence"
    return "inline_svg"


def adaptive_max_tokens(task: Task, ceiling: int) -> int:
    # Reasoning-capable endpoints often count hidden reasoning against this
    # allowance, so a 4k floor truncates otherwise short, valid SVG documents.
    return min(ceiling, max(8192, int(len(task.initial_svg) / 2.0) + 2048))


def estimate_request_cost(task: Task, pricing: Pricing, ceiling: int) -> float:
    prompt_tokens = (len(task.initial_svg) + len(task.instruction) + len(SYSTEM_PROMPT)) / 3.5 + 100
    output_tokens = adaptive_max_tokens(task, ceiling)
    return prompt_tokens * pricing.prompt + output_tokens * pricing.completion


def fetch_catalog() -> dict[str, Pricing]:
    try:
        with urllib.request.urlopen(CATALOG_URL, timeout=30) as response:  # noqa: S310 - fixed HTTPS endpoint
            payload = json.load(response)
    except Exception as exc:  # noqa: BLE001
        print(f"Warning: could not load OpenRouter pricing catalog: {exc}", file=sys.stderr)
        return {}
    out = {}
    for model in payload.get("data", []):
        raw = model.get("pricing") or {}
        try:
            out[model["id"]] = Pricing(float(raw.get("prompt") or 0), float(raw.get("completion") or 0))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def extract_usage(payload: dict[str, Any] | None) -> dict[str, float | int | None]:
    usage = (payload or {}).get("usage") or {}
    details = usage.get("completion_tokens_details") or {}
    cost = usage.get("cost")
    if cost is None:
        cost = (usage.get("cost_details") or {}).get("upstream_inference_cost")
    return {
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
        "reasoning_tokens": int(details.get("reasoning_tokens") or 0),
        "cost_usd": float(cost) if cost is not None else None,
    }


def content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(part.get("text") or "") for part in content if isinstance(part, dict))
    return "" if content is None else str(content)


def extract_svg(text: str) -> str:
    fenced = re.search(r"```(?:svg|xml)?\s*(<svg[\s\S]*?</svg>)\s*```", text, re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    inline = re.search(r"(<svg[\s\S]*?</svg>)", text, re.IGNORECASE)
    return inline.group(1).strip() if inline else text.strip()


def error_record(
    model: ModelSpec,
    task: Task,
    code: str,
    message: str,
    trace: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "requested_model": model.id,
        "resolved_model": None,
        "model_name": model.name,
        "family": model.family,
        "group": model.group,
        "task_id": task.task_id,
        "difficulty": task.difficulty,
        "category": task.category,
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
        "diff_report": None,
        "produced_svg": None,
        "raw_response": None,
        "response_id": None,
        "finish_reason": None,
        "elapsed_ms": 0.0,
        "max_output_tokens": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "reasoning_tokens": 0,
        "cost_usd": 0.0,
        "error": {"code": code, "message": message},
        "trace": trace,
    }


def select_models(models: list[ModelSpec], requested: list[str] | None) -> list[ModelSpec]:
    if not requested:
        return models
    wanted = {item for value in requested for item in value.split(",")}
    selected = [model for model in models if model.id in wanted or model.name in wanted]
    missing = wanted - {value for model in selected for value in (model.id, model.name)}
    if missing:
        raise SystemExit(f"models not in manifest: {', '.join(sorted(missing))}")
    return selected


def select_tasks(tasks: list[Task], requested: list[str] | None, limit: int | None) -> list[Task]:
    if requested:
        wanted = {item for value in requested for item in value.split(",")}
        tasks = [task for task in tasks if task.task_id in wanted]
        found = {task.task_id for task in tasks}
        if wanted - found:
            raise SystemExit(f"tasks not found: {', '.join(sorted(wanted - found))}")
    return tasks[:limit] if limit else tasks


def read_completed(path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        try:
            record = json.loads(line)
            out[(record["requested_model"], record["task_id"])] = record
        except (json.JSONDecodeError, KeyError):
            continue
    return out


def write_meta(run_dir: Path, manifest: dict[str, Any], models: list[ModelSpec], tasks: list[Task], args: argparse.Namespace, estimate: float, resumed_spend: float) -> None:
    task_index = json.loads((args.data_dir / "_index.json").read_text())
    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "benchmark": "VectorEditGym",
        "protocol": manifest.get("protocol"),
        "manifest": str(args.manifest),
        "models": [asdict(model) for model in models],
        "task_ids": [task.task_id for task in tasks],
        "task_count": len(tasks),
        "corpus_hash": task_index["frozen_content_sha256"],
        "evaluator": EVALUATOR_VERSION,
        "system_prompt": SYSTEM_PROMPT,
        "prompt_visibility": ["instruction", "initial_svg"],
        "hidden_from_model": ["target_svg", "expected_diff", "should_preserve", "target_parts"],
        "budget_usd": args.budget_usd,
        "estimated_catalog_cost_usd": estimate,
        "resumed_spend_usd": resumed_spend,
        "concurrency": args.concurrency,
        "retries": args.retries,
        "sdk_max_retries": SDK_MAX_RETRIES,
        "base_url": args.base_url,
        "trace_schema": TRACE_SCHEMA_VERSION,
        "trace_file": "traces.jsonl",
        "trace_retention": "append_only_complete",
        "credentials_recorded": False,
    }
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")


def summarize(records: list[dict[str, Any]], models: list[ModelSpec]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record["requested_model"]].append(record)
    summaries = []
    for model in models:
        items = grouped.get(model.id, [])
        if not items:
            continue
        n = len(items)
        summaries.append({
            **asdict(model),
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
                bool((item.get("diff_report") or {}).get("validity_pass"))
                for item in items
            ) / n,
            "edit_completion": mean(items, "edit_completion"),
            "repair_progress": mean(items, "repair_progress"),
            "preservation": mean(items, "preservation"),
            "source_preservation": mean(items, "source_preservation"),
            "unintended_change_rate": mean_valid(items, "unintended_change_rate"),
            "error_rate": sum(1 for item in items if item["error"]) / n,
            "truncation_rate": sum(item.get("finish_reason") == "length" for item in items) / n,
            "mean_elapsed_ms": mean(items, "elapsed_ms"),
            "cost_usd": sum(float(item.get("cost_usd") or 0) for item in items),
            "prompt_tokens": sum(int(item.get("prompt_tokens") or 0) for item in items),
            "completion_tokens": sum(int(item.get("completion_tokens") or 0) for item in items),
        })
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


def main() -> int:
    return asyncio.run(async_main(parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
