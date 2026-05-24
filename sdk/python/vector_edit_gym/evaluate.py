"""Run a solver across tasks and aggregate the results."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol

from .metrics import exact_match, preservation_score, structural_match
from .tasks import Task


class Solver(Protocol):
    """A solver is any callable that takes a Task and returns an SVG string."""

    def __call__(self, task: Task) -> str: ...


@dataclass
class TaskResult:
    task_id: str
    difficulty: str
    category: str
    exact: bool
    structural: bool
    preservation: float
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
    def structural_rate(self) -> float:
        return self._mean(lambda r: 1.0 if r.structural else 0.0)

    @property
    def preservation_mean(self) -> float:
        return self._mean(lambda r: r.preservation)

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

    def by_difficulty(self) -> dict[str, dict[str, float]]:
        return self._bucket(lambda r: r.difficulty)

    def by_category(self) -> dict[str, dict[str, float]]:
        return self._bucket(lambda r: r.category)

    def _bucket(self, key: Callable[[TaskResult], str]) -> dict[str, dict[str, float]]:
        buckets: dict[str, list[TaskResult]] = defaultdict(list)
        for r in self.results:
            buckets[key(r)].append(r)
        out: dict[str, dict[str, float]] = {}
        for k, rs in buckets.items():
            n = len(rs)
            out[k] = {
                "n": n,
                "exact": sum(1 for r in rs if r.exact) / n,
                "structural": sum(1 for r in rs if r.structural) / n,
                "preservation": sum(r.preservation for r in rs) / n,
                "errors": sum(1 for r in rs if r.error) / n,
            }
        return out

    # ---- pretty-print ---------------------------------------------------

    def summary(self) -> str:
        lines = [
            f"VectorEditGym — {self.n} tasks",
            f"  exact-match:        {self.exact_rate:.1%}",
            f"  structural-match:   {self.structural_rate:.1%}",
            f"  preservation (avg): {self.preservation_mean:.1%}",
            f"  errors:             {self.error_rate:.1%}",
            f"  mean latency:       {self.mean_latency_ms:.0f} ms",
            "",
            "By difficulty:",
        ]
        by_diff = self.by_difficulty()
        for k in ("very_easy", "easy", "medium", "hard", "very_hard"):
            if k not in by_diff:
                continue
            b = by_diff[k]
            lines.append(
                f"  {k:<11} n={int(b['n']):<4} exact={b['exact']:.1%}  struct={b['structural']:.1%}  preserve={b['preservation']:.1%}"
            )
        return "\n".join(lines)


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
        except Exception as e:  # noqa: BLE001 — surface any solver failure
            err = f"{type(e).__name__}: {e}"
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if err or produced is None:
            tr = TaskResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                category=task.category,
                exact=False,
                structural=False,
                preservation=0.0,
                elapsed_ms=elapsed_ms,
                error=err or "solver returned None",
                produced=None,
            )
        else:
            tr = TaskResult(
                task_id=task.task_id,
                difficulty=task.difficulty,
                category=task.category,
                exact=exact_match(produced, task.target_svg),
                structural=structural_match(produced, task.target_svg),
                preservation=preservation_score(produced, task.target_svg, task.should_preserve),
                elapsed_ms=elapsed_ms,
                error=None,
                produced=produced if keep_outputs else None,
            )

        results.append(tr)
        if on_progress:
            on_progress(i, total, tr)

    return EvaluationResult(results=results)
