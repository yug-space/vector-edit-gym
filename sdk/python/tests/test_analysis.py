from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("analyze_results", ROOT / "scripts" / "analyze-results.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
wilson_intervals = MODULE.wilson_intervals


def test_wilson_interval_is_informative_at_zero_passes() -> None:
    records = [{"requested_model": "model", "reward": 0} for _ in range(40)]
    low, high = wilson_intervals(records)["model"]
    assert low == 0.0
    assert 0.08 < high < 0.10


def test_wilson_interval_contains_observed_rate() -> None:
    records = [
        {"requested_model": "model", "reward": int(index < 6)}
        for index in range(40)
    ]
    low, high = wilson_intervals(records)["model"]
    assert low < 0.15 < high
