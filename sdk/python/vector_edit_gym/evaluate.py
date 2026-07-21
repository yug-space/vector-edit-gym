"""Run a solver across tasks and aggregate the results."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol

from .diffing import diff_report
from .tasks import Task


class Solver(Protocol):
    """A solver is any callable that takes a Task and returns an SVG string."""

    def __call__(self, task: Task) -> str: ...


@dataclass
class TaskResult:
    task_id: str
    difficulty: str
    category: str
    reward: int
    near_pass: bool
    repair_pass: bool
    preservation_pass: bool
    source_preservation_pass: bool
    exact: bool
    structural: bool
    valid: bool
    preservation: float
    source_preservation: float
    edit_completion: float
    repair_progress: float
    unintended_change_rate: float
    elapsed_ms: float
    error: str | None = None
    produced: str | None = None  # set when keep_outputs=True


@dataclass
class EvaluationResult:
    results: list[TaskResult] = field(default_factory=list)

    # ---- aggregate stats ------------------------------------------------

    @property
    def n(self) -> int:
        return len(self.results)

    @property
    def exact_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.exact else 0.0)

    @property
    def reward_mean(self) -> float:
        return self._mean(lambda r: float(r.reward))

    @property
    def specification_pass_rate(self) -> float:
        return self.reward_mean

    @property
    def repair_pass_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.repair_pass else 0.0)

    @property
    def near_pass_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.near_pass else 0.0)

    @property
    def preservation_pass_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.preservation_pass else 0.0)

    @property
    def structural_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.structural else 0.0)

    @property
    def validity_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.valid else 0.0)

    @property
    def preservation_mean(self) -> float:
        return self._mean(lambda r: r.preservation)

    @property
    def edit_completion_mean(self) -> float:
        return self._mean(lambda r: r.edit_completion)

    @property
    def repair_progress_mean(self) -> float:
        return self._mean(lambda r: r.repair_progress)

    @property
    def unintended_change_rate(self) -> float | None:
        valid = [result for result in self.results if result.valid]
        if not valid:
            return None
        return sum(result.unintended_change_rate for result in valid) / len(valid)

    @property
    def error_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.error else 0.0)

    @property
    def mean_latency_ms(self) -> float:
        return self._mean(lambda r: r.elapsed_ms)

    def _mean(self, f: Callable[[TaskResult], float]) -> float:
        if not self.results:
            return 0.0
        return sum(f(r) for r in self.results) / len(self.results)

    # ---- breakdowns -----------------------------------------------------

    def by_difficulty(self) -> dict[str, dict[str, float | None]]:
        return self._bucket(lambda r: r.difficulty)

    def by_category(self) -> dict[str, dict[str, float | None]]:
        return self._bucket(lambda r: r.category)

    def _bucket(self, key: Callable[[TaskResult], str]) -> dict[str, dict[str, float | None]]:
        buckets: dict[str, list[TaskResult]] = defaultdict(list)
        for r in self.results:
            buckets[key(r)].append(r)
        out: dict[str, dict[str, float | None]] = {}
        for k, rs in buckets.items():
            n = len(rs)
            out[k] = {
                "n": n,
                "reward": sum(r.reward for r in rs) / n,
                "specification_pass": sum(r.reward for r in rs) / n,
                "near_pass": sum(1 for r in rs if r.near_pass) / n,
                "repair_pass": sum(1 for r in rs if r.repair_pass) / n,
                "preservation_pass": sum(1 for r in rs if r.preservation_pass) / n,
                "exact": sum(1 for r in rs if r.exact) / n,
                "structural": sum(1 for r in rs if r.structural) / n,
                "validity": sum(1 for r in rs if r.valid) / n,
                "preservation": sum(r.preservation for r in rs) / n,
                "edit_completion": sum(r.edit_completion for r in rs) / n,
                "repair_progress": sum(r.repair_progress for r in rs) / n,
                "unintended_change_rate": (
                    sum(r.unintended_change_rate for r in rs if r.valid)
                    / sum(1 for r in rs if r.valid)
                    if any(r.valid for r in rs)
                    else None
                ),
                "errors": sum(1 for r in rs if r.error) / n,
            }
        return out

    # ---- pretty-print ---------------------------------------------------

    def summary(self) -> str:
        lines = [
            f"Vector-Bench - {self.n} tasks",
            f"  specification pass: {self.specification_pass_rate:.1%}",
            f"  near-complete:      {self.near_pass_rate:.1%}",
            f"  requested repairs:  {self.repair_pass_rate:.1%}",
            f"  clean preservation: {self.preservation_pass_rate:.1%}",
            f"  exact-match:        {self.exact_rate:.1%}",
            f"  target-match:       {self.structural_rate:.1%}",
            f"  valid SVG:          {self.validity_rate:.1%}",
            f"  edit completion:    {self.edit_completion_mean:.1%}",
            f"  repair progress:    {self.repair_progress_mean:.1%}",
            f"  preservation (avg): {self.preservation_mean:.1%}",
            f"  unintended changes: {self.unintended_change_rate:.1%}" if self.unintended_change_rate is not None else "  unintended changes: n/a",
            f"  errors:             {self.error_rate:.1%}",
            f"  mean latency:       {self.mean_latency_ms:.0f} ms",
            "",
            "By difficulty:",
        ]
        by_diff = self.by_difficulty()
        for k in ("hard", "very_hard"):
            if k not in by_diff:
                continue
            b = by_diff[k]
            lines.append(
                f"  {k:<11} n={int(b['n']):<4} reward={b['reward']:.1%}  edit={b['edit_completion']:.1%}  ucr={_format_rate(b['unintended_change_rate'])}"
            )
        return "\n".join(lines)


def _format_rate(value: float | None) -> str:
    return f"{value:.1%}" if value is not None else "n/a"


# --------------------------------------------------------------------------

def evaluate(
    solver: Solver,
    tasks: Iterable[Task],
    *,
    keep_outputs: bool = False,
    on_progress: Callable[[int, int, TaskResult], None] | None = None,
) -> EvaluationResult:
    """Run `solver` across `tasks` and return aggregated results.

    Args:
        solver: callable mapping Task -> str (the produced SVG).
        tasks: iterable of Task objects.
        keep_outputs: if True, each TaskResult.produced is populated.
        on_progress: optional (i, total, latest_result) callback.
    """
    task_list = list(tasks)
    total = len(task_list)
    results: list[TaskResult] = []

    for i, task in enumerate(task_list, start=1):
        t0 = time.perf_counter()
        produced: str | None = None
        err: str | None = None
        try:
            produced = solver(task)
        except Exception as e:  # noqa: BLE001 - surface any solver failure
            err = f"{type(e).__name__}: {e}"
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if err or produced is None:
            tr = TaskResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                category=task.category,
                reward=0,
                near_pass=False,
                repair_pass=False,
                preservation_pass=False,
                source_preservation_pass=False,
                exact=False,
                structural=False,
                valid=False,
                preservation=0.0,
                source_preservation=0.0,
                edit_completion=0.0,
                repair_progress=0.0,
                unintended_change_rate=1.0,
                elapsed_ms=elapsed_ms,
                error=err or "solver returned None",
                produced=None,
            )
        else:
            report = diff_report(task, produced)
            tr = TaskResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                category=task.category,
                reward=report.reward,
                near_pass=report.near_pass,
                repair_pass=report.repair_pass,
                preservation_pass=report.preservation_pass,
                source_preservation_pass=report.source_preservation_pass,
                exact=report.exact,
                structural=report.structural,
                valid=report.validity_pass,
                preservation=report.preservation,
                source_preservation=report.source_preservation,
                edit_completion=report.edit_completion,
                repair_progress=report.repair_progress,
                unintended_change_rate=report.unintended_change_rate,
                elapsed_ms=elapsed_ms,
                error=None,
                produced=produced if keep_outputs else None,
            )

        results.append(tr)
        if on_progress:
            on_progress(i, total, tr)

    return EvaluationResult(results=results)
