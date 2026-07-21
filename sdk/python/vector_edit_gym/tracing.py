"""Durable, credential-safe trace records for benchmark runs."""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .tasks import Task


TRACE_SCHEMA_VERSION = "vectoreditgym.trace.v1"

_SENSITIVE_KEYS = {
    "api-key",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "proxy-authorization",
    "set-cookie",
    "x-api-key",
}
_BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{12,}")
_API_KEY_RE = re.compile(r"\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{16,}\b")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_trace(value: Any, secrets: Iterable[str] = ()) -> Any:
    """Recursively remove credentials while preserving trace structure."""

    secret_values = tuple(secret for secret in secrets if secret)

    def clean(item: Any) -> Any:
        if isinstance(item, dict):
            return {
                str(key): "[REDACTED]" if str(key).lower() in _SENSITIVE_KEYS else clean(child)
                for key, child in item.items()
            }
        if isinstance(item, (list, tuple)):
            return [clean(child) for child in item]
        if isinstance(item, str):
            text = item
            for secret in secret_values:
                text = text.replace(secret, "[REDACTED]")
            text = _BEARER_RE.sub("Bearer [REDACTED]", text)
            return _API_KEY_RE.sub("[REDACTED]", text)
        return item

    return clean(value)


def prompt_messages(task: Task, system_prompt: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"Repair request:\n{task.instruction}\n\nCorrupted SVG:\n{task.initial_svg}",
        },
    ]


def legacy_trace(
    record: dict[str, Any],
    task: Task,
    meta: dict[str, Any],
) -> dict[str, Any]:
    """Reconstruct the maximum honest trace available from an older final row."""

    raw_response = record.get("raw_response")
    raw_response_source = "recorded"
    if raw_response is None and record.get("produced_svg") is not None:
        raw_response = record["produced_svg"]
        raw_response_source = "reconstructed_from_extracted_svg"
    elif raw_response is None:
        raw_response_source = "unavailable"

    response = None
    if record.get("error") is None:
        response = {
            "id": record.get("response_id"),
            "model": record.get("resolved_model"),
            "choices": [
                {
                    "message": {"role": "assistant", "content": raw_response},
                    "finish_reason": record.get("finish_reason"),
                }
            ],
            "usage": {
                "prompt_tokens": int(record.get("prompt_tokens") or 0),
                "completion_tokens": int(record.get("completion_tokens") or 0),
                "completion_tokens_details": {
                    "reasoning_tokens": int(record.get("reasoning_tokens") or 0)
                },
                "cost": float(record.get("cost_usd") or 0),
            },
        }

    limitations = ["retry and transport envelopes were not retained by the legacy runner"]
    if raw_response_source == "reconstructed_from_extracted_svg":
        limitations.append(
            "the original response wrapper was not retained; raw response is reconstructed from the extracted SVG"
        )
    elif raw_response_source == "unavailable":
        limitations.append("the original response body is unavailable")

    trace = {
        "schema_version": TRACE_SCHEMA_VERSION,
        "trace_id": f"legacy:{record.get('requested_model')}:{record.get('task_id')}",
        "retention": "legacy_final_record",
        "limitations": limitations,
        "request": {
            "base_url": meta.get("base_url"),
            "model": record.get("requested_model"),
            "messages": prompt_messages(task, str(meta.get("system_prompt") or "")),
            "max_output_tokens": int(record.get("max_output_tokens") or 0),
            "temperature": "provider_default",
        },
        "attempts": [
            {
                "attempt": 1,
                "started_at": None,
                "finished_at": meta.get("created_at"),
                "elapsed_ms": float(record.get("elapsed_ms") or 0),
                "response": response,
                "error": record.get("error"),
                "legacy_reconstruction": True,
            }
        ],
        "extraction": {
            "raw_response": raw_response,
            "raw_response_source": raw_response_source,
            "produced_svg": record.get("produced_svg"),
        },
        "evaluations": [],
    }
    append_evaluation(trace, record, str(meta.get("evaluator") or "unknown"), meta.get("rescored_at") or meta.get("created_at"))
    return sanitize_trace(trace)


def append_evaluation(
    trace: dict[str, Any],
    record: dict[str, Any],
    evaluator: str,
    scored_at: str | None,
) -> None:
    """Append a score snapshot unless an identical final snapshot already exists."""

    snapshot = {
        "evaluator": evaluator,
        "scored_at": scored_at,
        "status": record.get("status"),
        "reward": record.get("reward"),
        "specification_pass": record.get("specification_pass"),
        "near_pass": record.get("near_pass"),
        "repair_pass": record.get("repair_pass"),
        "preservation_pass": record.get("preservation_pass"),
        "source_preservation_pass": record.get("source_preservation_pass"),
        "validity_pass": record.get("validity_pass"),
        "edit_completion": record.get("edit_completion"),
        "repair_progress": record.get("repair_progress"),
        "preservation": record.get("preservation"),
        "source_preservation": record.get("source_preservation"),
        "unintended_change_rate": record.get("unintended_change_rate"),
        "diff_report": record.get("diff_report"),
    }
    evaluations = trace.setdefault("evaluations", [])
    comparable = {key: value for key, value in snapshot.items() if key != "scored_at"}
    if evaluations:
        previous = {key: value for key, value in evaluations[-1].items() if key != "scored_at"}
        if previous == comparable:
            return
    evaluations.append(snapshot)


class AppendOnlyTraceWriter:
    """Serialize trace events immediately so retries survive interrupted runs."""

    def __init__(self, path: Path, secrets: Iterable[str] = ()) -> None:
        self.path = path
        self.secrets = tuple(secrets)
        self.lock = asyncio.Lock()

    async def emit(self, event: dict[str, Any]) -> None:
        payload = sanitize_trace(
            {
                "schema_version": TRACE_SCHEMA_VERSION,
                "recorded_at": utc_now(),
                **event,
            },
            self.secrets,
        )
        line = json.dumps(payload, ensure_ascii=True) + "\n"
        async with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf8") as handle:
                handle.write(line)
