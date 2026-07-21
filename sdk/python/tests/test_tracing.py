from __future__ import annotations

import asyncio
import json
from pathlib import Path

from vector_edit_gym.tasks import Task
from vector_edit_gym.tracing import (
    AppendOnlyTraceWriter,
    append_evaluation,
    legacy_trace,
    sanitize_trace,
)


def test_sanitize_trace_removes_headers_and_key_shaped_strings() -> None:
    secret = "sk-proj-this-is-a-test-secret-123456"
    value = {
        "authorization": f"Bearer {secret}",
        "nested": {
            "api_key": secret,
            "message": f"request failed with {secret}",
            "prompt_tokens": 12,
        },
    }

    clean = sanitize_trace(value, secrets=(secret,))

    assert clean["authorization"] == "[REDACTED]"
    assert clean["nested"]["api_key"] == "[REDACTED]"
    assert secret not in clean["nested"]["message"]
    assert clean["nested"]["prompt_tokens"] == 12


def test_append_only_writer_keeps_each_event(tmp_path: Path) -> None:
    path = tmp_path / "traces.jsonl"
    writer = AppendOnlyTraceWriter(path, secrets=("private-value",))

    async def write() -> None:
        await writer.emit({"event": "request_started", "value": "private-value"})
        await writer.emit({"event": "response_received", "value": "ok"})

    asyncio.run(write())
    rows = [json.loads(line) for line in path.read_text().splitlines()]

    assert [row["event"] for row in rows] == ["request_started", "response_received"]
    assert rows[0]["value"] == "[REDACTED]"
    assert all(row["recorded_at"] for row in rows)


def test_legacy_trace_marks_reconstructed_raw_response() -> None:
    task = Task(
        task_id="sv_001",
        difficulty="hard",
        category="test",
        instruction="Fix the square.",
        initial_svg='<svg id="broken"/>',
        target_svg='<svg id="fixed"/>',
    )
    record = {
        "requested_model": "provider/model",
        "resolved_model": "provider/model-v1",
        "task_id": task.task_id,
        "produced_svg": '<svg id="answer"/>',
        "raw_response": None,
        "response_id": "response-1",
        "finish_reason": "stop",
        "elapsed_ms": 50,
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "reasoning_tokens": 0,
        "cost_usd": 0.01,
        "error": None,
        "status": "PARTIAL",
        "reward": 0,
        "diff_report": {"reward": 0},
    }
    meta = {
        "base_url": "https://example.test/v1",
        "system_prompt": "Return SVG.",
        "evaluator": "test-evaluator",
        "created_at": "2026-07-21T00:00:00+00:00",
    }

    trace = legacy_trace(record, task, meta)

    assert trace["retention"] == "legacy_final_record"
    assert trace["extraction"]["raw_response"] == record["produced_svg"]
    assert trace["extraction"]["raw_response_source"] == "reconstructed_from_extracted_svg"
    assert trace["request"]["messages"][1]["content"].endswith(task.initial_svg)
    assert trace["evaluations"][0]["evaluator"] == "test-evaluator"


def test_identical_evaluation_snapshot_is_not_duplicated() -> None:
    trace = {"evaluations": []}
    record = {"status": "PASS", "reward": 1, "diff_report": {"reward": 1}}

    append_evaluation(trace, record, "evaluator", "first")
    append_evaluation(trace, record, "evaluator", "second")

    assert len(trace["evaluations"]) == 1
