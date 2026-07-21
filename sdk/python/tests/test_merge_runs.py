from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
MERGER = ROOT / "scripts" / "merge-runs.py"


def test_merge_runs_combines_compatible_complete_matrices(tmp_path: Path) -> None:
    first = write_run(tmp_path / "first", "provider/model-a")
    second = write_run(tmp_path / "second", "provider/model-b")
    output = tmp_path / "combined"

    completed = subprocess.run(
        [sys.executable, str(MERGER), str(output), str(first), str(second)],
        capture_output=True,
        check=False,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    meta = json.loads((output / "meta.json").read_text())
    records = [
        json.loads(line)
        for line in (output / "results.jsonl").read_text().splitlines()
    ]
    assert [model["id"] for model in meta["models"]] == [
        "provider/model-a",
        "provider/model-b",
    ]
    assert len(meta["source_runs"]) == 2
    assert [(record["requested_model"], record["task_id"]) for record in records] == [
        ("provider/model-a", "sv_001"),
        ("provider/model-b", "sv_001"),
    ]
    traces = [json.loads(line) for line in (output / "traces.jsonl").read_text().splitlines()]
    assert [trace["requested_model"] for trace in traces] == [
        "provider/model-a",
        "provider/model-b",
    ]
    assert meta["merged_trace_events"] == 2


def test_merge_runs_rejects_protocol_mismatch(tmp_path: Path) -> None:
    first = write_run(tmp_path / "first", "provider/model-a")
    second = write_run(
        tmp_path / "second",
        "provider/model-b",
        protocol="different-protocol",
    )

    completed = subprocess.run(
        [
            sys.executable,
            str(MERGER),
            str(tmp_path / "combined"),
            str(first),
            str(second),
        ],
        capture_output=True,
        check=False,
        text=True,
    )

    assert completed.returncode != 0
    assert "mismatched field(s): protocol" in completed.stderr


def write_run(
    path: Path,
    model_id: str,
    *,
    protocol: str = "test-protocol",
) -> Path:
    path.mkdir()
    model = {
        "id": model_id,
        "name": model_id,
        "family": "Test",
        "group": "frontier",
    }
    meta = {
        "created_at": "2026-07-20T00:00:00+00:00",
        "benchmark": "VectorEditGym",
        "protocol": protocol,
        "manifest": "test.json",
        "models": [model],
        "task_ids": ["sv_001"],
        "task_count": 1,
        "corpus_hash": "a" * 64,
        "system_prompt": "repair",
        "prompt_visibility": ["instruction", "initial_svg"],
        "hidden_from_model": ["target_svg"],
        "budget_usd": 1,
        "estimated_catalog_cost_usd": 0.1,
        "resumed_spend_usd": 0,
        "base_url": "https://example.test/v1",
    }
    record = {
        "requested_model": model_id,
        "task_id": "sv_001",
        "cost_usd": 0.01,
    }
    (path / "meta.json").write_text(json.dumps(meta))
    (path / "results.jsonl").write_text(json.dumps(record) + "\n")
    (path / "traces.jsonl").write_text(
        json.dumps(
            {
                "schema_version": "vectoreditgym.trace.v1",
                "event": "evaluation_completed",
                "requested_model": model_id,
                "task_id": "sv_001",
            }
        )
        + "\n"
    )
    return path
