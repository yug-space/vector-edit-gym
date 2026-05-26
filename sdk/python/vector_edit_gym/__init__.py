"""VectorEditGym — benchmark for SVG icon editing tasks.

Quick start:

    from vector_edit_gym import load_tasks, evaluate

    tasks = load_tasks(difficulty="very_easy")

    def my_solver(task):
        # Return the fixed SVG as a string. The simplest no-op solver:
        return task.initial_svg

    results = evaluate(my_solver, tasks)
    print(results.summary())
"""

from .tasks import Task, load_tasks, load_task
from .evaluate import evaluate, EvaluationResult, Solver
from .diffing import DiffReport, diff_report

__all__ = [
    "Task",
    "load_tasks",
    "load_task",
    "evaluate",
    "EvaluationResult",
    "Solver",
    "DiffReport",
    "diff_report",
]
