from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from vector_edit_gym.tasks import load_task


ROOT = Path(__file__).resolve().parents[3]
RESCORER = ROOT / "scripts" / "rescore-results.py"


def test_rescore_archives_prior_rows_and_backfills_trace(tmp_path: Path) -> None:
    task = load_task("sv_001")
    run = tmp_path / "run"
    run.mkdir()
    model = {
        "id": "provider/model",
        "name": "Model",
        "family": "Provider",
        "group": "frontier",
    }
    meta = {
        "created_at": "2026-07-20T00:00:00+00:00",
        "benchmark": "VectorEditGym",
        "protocol": "test",
        "models": [model],
        "task_ids": [task.task_id],
        "task_count": 1,
        "system_prompt": "Return SVG.",
        "base_url": "https://example.test/v1",
        "budget_usd": 1,
        "evaluator": "old-evaluator",
    }
    record = {
        "requested_model": model["id"],
        "resolved_model": model["id"],
        "model_name": model["name"],
        "family": model["family"],
        "group": model["group"],
        "task_id": task.task_id,
        "status": "FAIL",
        "reward": 0,
        "produced_svg": task.initial_svg,
        "raw_response": None,
        "diff_report": {"evaluator": "old"},
        "elapsed_ms": 10,
        "max_output_tokens": 100,
        "prompt_tokens": 10,
        "completion_tokens": 10,
        "reasoning_tokens": 0,
        "cost_usd": 0.01,
        "finish_reason": "stop",
        "error": None,
    }
    original = json.dumps(record) + "\n"
    (run / "meta.json").write_text(json.dumps(meta))
    (run / "results.jsonl").write_text(original)

    completed = subprocess.run(
        [sys.executable, str(RESCORER), str(run)],
        capture_output=True,
        check=False,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    rescored = json.loads((run / "results.jsonl").read_text())
    assert rescored["raw_response"] == task.initial_svg
    assert rescored["trace"]["retention"] == "legacy_final_record"
    assert [item["evaluator"] for item in rescored["trace"]["evaluations"]] == [
        "old-evaluator",
        "semantic-perceptual-binary-2026-07-21",
    ]
    archives = list((run / "history").glob("*/results.jsonl"))
    assert len(archives) == 1
    assert archives[0].read_text() == original
    events = [json.loads(line) for line in (run / "traces.jsonl").read_text().splitlines()]
    assert events[-1]["event"] == "evaluation_completed"
