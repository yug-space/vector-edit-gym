"""vec-edit-gym CLI: list / show / evaluate / score."""

from __future__ import annotations

import argparse
import importlib
import importlib.util
import json
import sys
from pathlib import Path

from .diffing import diff_report, outcome_status
from .evaluate import evaluate
from .tasks import load_task, load_tasks


def _cmd_list(args: argparse.Namespace) -> int:
    tasks = load_tasks(difficulty=args.difficulty, category=args.category)
    if args.json:
        print(json.dumps([
            {"task_id": t.task_id, "difficulty": t.difficulty, "category": t.category,
             "instruction": t.instruction}
            for t in tasks
        ], indent=2))
    else:
        for t in tasks:
            print(f"{t.task_id:<10} [{t.difficulty:<9}] [{t.category:<22}] {t.instruction}")
        print(f"\n{len(tasks)} tasks")
    return 0


def _cmd_show(args: argparse.Namespace) -> int:
    t = load_task(args.task_id)
    if args.field:
        val = getattr(t, args.field, None)
        if val is None:
            print(f"no such field: {args.field}", file=sys.stderr)
            return 2
        if isinstance(val, str):
            print(val)
        else:
            print(json.dumps(val, indent=2))
    else:
        print(json.dumps({
            "task_id": t.task_id, "difficulty": t.difficulty, "category": t.category,
            "instruction": t.instruction, "expected_diff": t.expected_diff,
            "parts": t.parts, "should_preserve": t.should_preserve,
        }, indent=2))
    return 0


def _load_solver(spec: str):
    """Load a solver by:
       - 'module:function'  (e.g. mypkg.solvers:my_solver)
       - 'path/to/file.py:function'
    """
    if ":" not in spec:
        raise ValueError("solver spec must be 'module:function' or 'path.py:function'")
    target, fn_name = spec.rsplit(":", 1)
    if target.endswith(".py") or "/" in target:
        path = Path(target).resolve()
        if not path.is_file():
            raise FileNotFoundError(f"{path}")
        mod_name = path.stem
        spec_obj = importlib.util.spec_from_file_location(mod_name, str(path))
        if spec_obj is None or spec_obj.loader is None:
            raise ImportError(f"cannot import {path}")
        mod = importlib.util.module_from_spec(spec_obj)
        spec_obj.loader.exec_module(mod)
    else:
        mod = importlib.import_module(target)
    fn = getattr(mod, fn_name, None)
    if fn is None:
        raise AttributeError(f"no callable named {fn_name!r} in {target}")
    return fn


def _cmd_evaluate(args: argparse.Namespace) -> int:
    solver = _load_solver(args.solver)
    tasks = load_tasks(difficulty=args.difficulty, category=args.category)
    if args.limit:
        tasks = tasks[: args.limit]
    print(f"Running {len(tasks)} task(s) through {args.solver}...", file=sys.stderr)
    def progress(i: int, total: int, r):
        marker = outcome_status({
            "reward": r.reward,
            "near_pass": r.near_pass,
            "repair_pass": r.repair_pass,
            "preservation_pass": r.preservation_pass,
            "validity_pass": r.valid,
            "edit_completion": r.edit_completion,
            "repair_progress": r.repair_progress,
        })
        if r.error:
            marker = "ERR"
        print(f"  [{i:>4}/{total}] {r.task_id:<10} {marker:<4} ({r.elapsed_ms:.0f} ms)",
              file=sys.stderr)
    out = evaluate(solver, tasks, on_progress=progress)
    print()
    print(out.summary())
    if args.json:
        print()
        print(json.dumps({
            "specification_pass_rate": out.specification_pass_rate,
            "near_pass_rate": out.near_pass_rate,
            "repair_pass_rate": out.repair_pass_rate,
            "preservation_pass_rate": out.preservation_pass_rate,
            "exact_rate": out.exact_rate,
            "structural_rate": out.structural_rate,
            "validity_rate": out.validity_rate,
            "edit_completion": out.edit_completion_mean,
            "repair_progress": out.repair_progress_mean,
            "preservation_mean": out.preservation_mean,
            "unintended_change_rate": out.unintended_change_rate,
            "by_difficulty": out.by_difficulty(),
            "by_category": out.by_category(),
        }, indent=2))
    return 0


def _cmd_score(args: argparse.Namespace) -> int:
    task = load_task(args.task_id)
    produced = sys.stdin.read() if args.svg == "-" else Path(args.svg).read_text()
    report = diff_report(task, produced)
    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
        return 0

    print(f"Task: {task.task_id}")
    print(f"status:       {outcome_status(report)}")
    print(f"spec pass:    {report.specification_pass}")
    print(f"near-complete:{str(report.near_pass):>7}")
    print(f"repair pass:  {report.repair_pass}")
    print(f"preservation: {report.preservation_pass}")
    print(f"source clean: {report.source_preservation_pass}")
    print(f"valid SVG:    {report.validity_pass}")
    print(f"exact:        {report.exact}")
    print(f"target match: {report.structural}")
    print(f"edit complete:{report.edit_completion:>7.1%}")
    print(f"repair progress:{report.repair_progress:>5.1%}")
    print(f"named preserve:{report.preservation:>6.1%}")
    print(f"UCR:          {report.unintended_change_rate:.1%}")
    print()
    print("Expected changes:")
    for check in report.expected_changes:
        marker = "OK" if check.passed else "FAIL"
        print(
            f"  {marker:<4} {check.part}.{check.attribute}: "
            f"expected {check.expected_after!r}, produced {check.produced!r}"
        )
        if check.distance is not None and check.tolerance is not None:
            print(
                f"       {check.comparison}: {check.distance:g} <= "
                f"{check.tolerance:g} {check.unit or ''}".rstrip()
            )
        if check.progress is not None:
            print(f"       repair progress: {check.progress:.1%}")
    if report.unexpected_changed_parts:
        print()
        print("Unexpected changed/preserved-part failures:")
        for part in report.unexpected_changed_parts:
            print(f"  {part}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="vec-edit-gym", description="VectorEditGym CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("list", help="list tasks")
    pl.add_argument("--difficulty", help="filter by difficulty")
    pl.add_argument("--category", help="filter by category")
    pl.add_argument("--json", action="store_true")
    pl.set_defaults(fn=_cmd_list)

    ps = sub.add_parser("show", help="show a single task")
    ps.add_argument("task_id")
    ps.add_argument("--field", help="print only one field (e.g. initial_svg)")
    ps.set_defaults(fn=_cmd_show)

    pe = sub.add_parser("evaluate", help="run a solver across tasks")
    pe.add_argument("solver", help="solver spec: module:function OR path/to/file.py:function")
    pe.add_argument("--difficulty")
    pe.add_argument("--category")
    pe.add_argument("--limit", type=int)
    pe.add_argument("--json", action="store_true")
    pe.set_defaults(fn=_cmd_evaluate)

    pc = sub.add_parser("score", help="score one produced SVG against a task")
    pc.add_argument("task_id")
    pc.add_argument("svg", help="path to produced SVG, or '-' for stdin")
    pc.add_argument("--json", action="store_true")
    pc.set_defaults(fn=_cmd_score)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
