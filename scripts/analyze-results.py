#!/usr/bin/env python3
"""Generate paper-ready tables, figures, and statistics from one canonical run."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
import textwrap
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "sdk" / "python"))

from vector_edit_gym.diffing import diff_report  # noqa: E402
from vector_edit_gym.tasks import Task  # noqa: E402
ORANGE = "#ff5a1f"
INK = "#171717"
GRAY = "#6b7280"
TEAL = "#0f766e"
BLUE = "#2563eb"
RED = "#c2413b"
PURPLE = "#7c3aed"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--tasks", type=Path, default=ROOT / "data" / "tasks")
    parser.add_argument("--out", type=Path, default=ROOT / "paper" / "generated")
    parser.add_argument("--figures", type=Path, default=ROOT / "paper" / "figures")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    args.figures.mkdir(parents=True, exist_ok=True)
    records = read_jsonl(args.run_dir / "results.jsonl")
    summaries = json.loads((args.run_dir / "summary.json").read_text())
    meta = json.loads((args.run_dir / "meta.json").read_text())
    tasks = [json.loads(path.read_text()) for path in sorted(args.tasks.glob("sv_*.json"))]
    validate_record_matrix(records, meta)

    confidence = wilson_intervals(records)
    for summary in summaries:
        summary["reward_ci_low"], summary["reward_ci_high"] = confidence[summary["id"]]

    corpus = corpus_stats(tasks)
    results = result_stats(records, summaries, meta, corpus)
    results["evaluator_controls"] = evaluator_controls(tasks)
    (args.out / "analysis.json").write_text(json.dumps(results, indent=2) + "\n")
    write_macros(args.out / "results.tex", results)
    write_main_table(args.out / "main-table.tex", summaries[:10])
    write_full_table(args.out / "full-table.tex", summaries)
    write_corpus_table(args.out / "corpus-table.tex", corpus)
    write_gate_table(args.out / "gate-table.tex", results["gate_decomposition"])
    write_sensitivity_table(args.out / "sensitivity-table.tex", results["tolerance_sensitivity"])
    write_controls_table(args.out / "controls-table.tex", results["evaluator_controls"])

    set_style()
    figure_examples(tasks, args.figures)
    figure_task_operations(tasks, args.figures)
    figure_complexity(tasks, args.figures)
    figure_model_rewards(summaries, args.figures)
    figure_edit_vs_ucr(summaries, args.figures)
    figure_operation_heatmap(records, summaries, tasks, args.figures)
    figure_cost_pareto(summaries, args.figures)
    figure_gate_decomposition(results["gate_decomposition"], args.figures)
    print(f"Generated analysis in {args.out} and {args.figures}")
    return 0


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def validate_record_matrix(records: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    expected_pairs = {
        (model["id"], task_id)
        for model in meta["models"]
        for task_id in meta["task_ids"]
    }
    actual_pairs = [
        (record.get("requested_model"), record.get("task_id"))
        for record in records
    ]
    duplicates = [pair for pair, count in Counter(actual_pairs).items() if count > 1]
    unexpected = set(actual_pairs) - expected_pairs
    missing = expected_pairs - set(actual_pairs)
    if duplicates or unexpected or missing:
        details = []
        if duplicates:
            details.append(f"{len(duplicates)} duplicate pair(s), first {duplicates[0]}")
        if unexpected:
            details.append(f"{len(unexpected)} unexpected pair(s), first {sorted(unexpected)[0]}")
        if missing:
            details.append(f"{len(missing)} missing pair(s), first {sorted(missing)[0]}")
        raise SystemExit("invalid result matrix: " + "; ".join(details))


def corpus_stats(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    edits = [len(task["expected_diff"]) for task in tasks]
    protected = [len(task["should_preserve"]) for task in tasks]
    nodes = [sum(1 for _ in ET.fromstring(task["initial_svg"]).iter()) for task in tasks]
    chars = [len(task["initial_svg"]) for task in tasks]
    operations = Counter(operation_family(diff) for task in tasks for diff in task["expected_diff"])
    return {
        "tasks": len(tasks),
        "hard": sum(task["difficulty"] == "hard" for task in tasks),
        "very_hard": sum(task["difficulty"] == "very_hard" for task in tasks),
        "expected_edits_total": sum(edits),
        "expected_edits_mean": float(np.mean(edits)),
        "expected_edits_min": min(edits),
        "expected_edits_max": max(edits),
        "protected_objects_total": sum(protected),
        "protected_objects_mean": float(np.mean(protected)),
        "protected_objects_min": min(protected),
        "protected_objects_max": max(protected),
        "svg_nodes_mean": float(np.mean(nodes)),
        "svg_nodes_min": min(nodes),
        "svg_nodes_max": max(nodes),
        "input_characters_mean": float(np.mean(chars)),
        "input_characters_total": sum(chars),
        "operations": dict(sorted(operations.items())),
        "categories": dict(sorted(Counter(task["category"] for task in tasks).items())),
    }


def result_stats(records, summaries, meta, corpus) -> dict[str, Any]:
    best = summaries[0]
    frontier = [summary for summary in summaries if summary["group"] == "frontier"]
    frontier_best = frontier[0] if frontier else None
    total_cost = sum(float(record.get("cost_usd") or 0) for record in records)
    errors = sum(record.get("error") is not None for record in records)
    truncations = sum(record.get("finish_reason") == "length" for record in records)
    valid = sum(bool(record.get("validity_pass")) for record in records)
    passes = sum(int(record.get("reward") or 0) for record in records)
    near_passes = sum(bool(record.get("near_pass")) for record in records)
    repairs = sum(bool(record.get("repair_pass")) for record in records)
    preserved = sum(bool(record.get("preservation_pass")) for record in records)
    source_preserved = sum(bool(record.get("source_preservation_pass")) for record in records)
    target_matches = sum(bool(record.get("structural")) for record in records)
    partials = sum(
        not record.get("reward") and float(record.get("edit_completion") or 0) > 0
        for record in records
    )
    side_effects = sum(record.get("status") == "SIDE_EFFECTS" for record in records)
    valid_records = [record for record in records if record.get("validity_pass")]
    gate_decomposition = outcome_decomposition(records)
    sensitivity = tolerance_sensitivity(records)
    return {
        "protocol": meta.get("protocol"),
        "evaluator": meta.get("evaluator"),
        "models": len(summaries),
        "open_weight_models": sum(summary["group"] == "open-weight" for summary in summaries),
        "cheap_control_models": sum(summary["group"] == "cheap-control" for summary in summaries),
        "frontier_models": sum(summary["group"] == "frontier" for summary in summaries),
        "requests": len(records),
        "total_cost_usd": total_cost,
        "error_count": errors,
        "error_rate": errors / len(records),
        "truncation_count": truncations,
        "truncation_rate": truncations / len(records),
        "validity_rate": valid / len(records),
        "specification_passes": passes,
        "specification_pass_rate": passes / len(records),
        "near_passes": near_passes,
        "near_pass_rate": near_passes / len(records),
        "repair_passes": repairs,
        "repair_pass_rate": repairs / len(records),
        "preservation_passes": preserved,
        "preservation_pass_rate": preserved / len(records),
        "source_preservation_passes": source_preserved,
        "source_preservation_pass_rate": source_preserved / len(records),
        "repair_progress": float(np.mean([float(record.get("repair_progress") or 0) for record in records])),
        "valid_repair_progress": (
            float(np.mean([float(record.get("repair_progress") or 0) for record in valid_records]))
            if valid_records else 0.0
        ),
        "valid_output_ucr": (
            float(np.mean([float(record.get("unintended_change_rate") or 0) for record in valid_records]))
            if valid_records else 1.0
        ),
        "target_matches": target_matches,
        "target_match_rate": target_matches / len(records),
        "partial_outcomes": partials,
        "partial_outcome_rate": partials / len(records),
        "side_effect_outcomes": side_effects,
        "side_effect_outcome_rate": side_effects / len(records),
        "gate_decomposition": gate_decomposition,
        "tolerance_sensitivity": sensitivity,
        "top_model": best["name"],
        "top_model_id": best["id"],
        "top_reward": best["spec_pass_rate"],
        "top_near_pass": best["near_pass_rate"],
        "top_repair_pass": best["repair_pass_rate"],
        "top_preservation_pass": best["preservation_pass_rate"],
        "top_reward_ci_low": best["reward_ci_low"],
        "top_reward_ci_high": best["reward_ci_high"],
        "top_edit_completion": best["edit_completion"],
        "top_repair_progress": best["repair_progress"],
        "top_ucr": best["unintended_change_rate"],
        "top_validity": best["validity_rate"],
        "frontier_top_model": frontier_best["name"] if frontier_best else "n/a",
        "frontier_top_reward": frontier_best["spec_pass_rate"] if frontier_best else 0.0,
        "frontier_top_near_pass": frontier_best["near_pass_rate"] if frontier_best else 0.0,
        "frontier_top_repair_pass": frontier_best["repair_pass_rate"] if frontier_best else 0.0,
        "frontier_top_preservation_pass": frontier_best["preservation_pass_rate"] if frontier_best else 0.0,
        "frontier_top_edit_completion": frontier_best["edit_completion"] if frontier_best else 0.0,
        "frontier_top_repair_progress": frontier_best["repair_progress"] if frontier_best else 0.0,
        "frontier_top_validity": frontier_best["validity_rate"] if frontier_best else 0.0,
        "frontier_top_truncation": frontier_best["truncation_rate"] if frontier_best else 0.0,
        "corpus": corpus,
    }


def wilson_intervals(records, z: float = 1.959963984540054) -> dict[str, tuple[float, float]]:
    """Wilson score intervals remain informative for zero observed passes."""
    grouped = defaultdict(list)
    for record in records:
        grouped[record["requested_model"]].append(int(bool(record.get("reward"))))
    intervals = {}
    for model, values in grouped.items():
        n = len(values)
        rate = sum(values) / n
        denominator = 1 + z * z / n
        center = (rate + z * z / (2 * n)) / denominator
        margin = z * math.sqrt(rate * (1 - rate) / n + z * z / (4 * n * n)) / denominator
        intervals[model] = (max(0.0, center - margin), min(1.0, center + margin))
    return intervals


def outcome_decomposition(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter()
    for record in records:
        if not record.get("validity_pass"):
            counts["Invalid or missing SVG"] += 1
        elif not record.get("repair_pass"):
            counts["Valid, incomplete repair"] += 1
        elif not record.get("preservation_pass"):
            counts["All repairs, side effects"] += 1
        else:
            counts["Full specification pass"] += 1
    order = [
        "Full specification pass",
        "All repairs, side effects",
        "Valid, incomplete repair",
        "Invalid or missing SVG",
    ]
    total = len(records)
    rows = [{"label": label, "count": counts[label], "rate": counts[label] / total} for label in order]
    assert sum(row["count"] for row in rows) == total
    return rows


def tolerance_sensitivity(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for scale in (0.5, 1.0, 1.5):
        passes = repairs = 0
        for record in records:
            valid = bool(record.get("validity_pass"))
            checks = (record.get("diff_report") or {}).get("expected_changes", [])
            check_results = []
            for check in checks:
                distance = check.get("distance")
                tolerance = check.get("tolerance")
                if distance is None or tolerance is None:
                    check_results.append(bool(check.get("passed")))
                    continue
                threshold = float(tolerance) * scale
                baseline = check.get("baseline_distance")
                if baseline is not None and float(baseline) > 0:
                    threshold = min(threshold, 0.9 * float(baseline))
                check_results.append(valid and float(distance) <= threshold + 1e-9)
            repair = valid and all(check_results)
            repairs += int(repair)
            passes += int(repair and bool(record.get("preservation_pass")))
        rows.append({
            "scale": scale,
            "specification_passes": passes,
            "specification_pass_rate": passes / len(records),
            "repair_passes": repairs,
            "repair_pass_rate": repairs / len(records),
        })
    current = next(row for row in rows if row["scale"] == 1.0)
    assert current["specification_passes"] == sum(int(bool(record.get("reward"))) for record in records)
    return rows


def evaluator_controls(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    controls = defaultdict(list)
    for raw in tasks:
        task = Task.from_json(raw)
        controls["Return corrupted input"].append(diff_report(task, task.initial_svg))
        controls["Hidden target copy"].append(diff_report(task, task.target_svg))

        mutated = ET.fromstring(task.target_svg)
        protected = set(task.should_preserve)
        element = next((node for node in mutated.iter() if node.attrib.get("id") in protected), None)
        if element is None:
            raise ValueError(f"{task.task_id} has no protected element for the mutation control")
        element.attrib["data-vector-edit-gym-audit"] = "changed"
        controls["Target + protected mutation"].append(
            diff_report(task, ET.tostring(mutated, encoding="unicode"))
        )
        controls["Malformed target"].append(diff_report(task, task.target_svg[:-1]))

    rows = []
    for name, reports in controls.items():
        valid = [report for report in reports if report.validity_pass]
        rows.append({
            "name": name,
            "full": float(np.mean([report.reward for report in reports])),
            "repair": float(np.mean([report.repair_pass for report in reports])),
            "progress": float(np.mean([report.repair_progress for report in reports])),
            "clean": float(np.mean([report.preservation_pass for report in reports])),
            "valid": float(np.mean([report.validity_pass for report in reports])),
            "ucr": (
                float(np.mean([report.unintended_change_rate for report in valid]))
                if valid else None
            ),
        })
    expected = {row["name"]: row for row in rows}
    assert expected["Return corrupted input"]["full"] == 0
    assert expected["Return corrupted input"]["progress"] == 0
    assert expected["Hidden target copy"]["full"] == 1
    assert expected["Target + protected mutation"]["repair"] == 1
    assert expected["Target + protected mutation"]["full"] == 0
    assert expected["Malformed target"]["valid"] == 0
    return rows


def operation_family(diff: dict[str, Any]) -> str:
    attr = diff.get("attribute")
    if attr == "exists":
        return "Add/remove"
    if attr in {"fill", "stroke", "color"}:
        return "Color"
    if attr == "opacity":
        return "Opacity"
    if attr == "stroke-width":
        return "Line weight"
    if attr == "d":
        return "Path shape"
    if attr in {"x", "y", "cx", "cy", "points"}:
        return "Position/shape"
    return "Other"


def set_style() -> None:
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "axes.titlesize": 11,
        "axes.labelsize": 9,
        "axes.edgecolor": "#d1d5db",
        "axes.linewidth": 0.8,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "xtick.color": GRAY,
        "ytick.color": GRAY,
        "text.color": INK,
        "axes.labelcolor": INK,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "pdf.fonttype": 42,
        "ps.fonttype": 42,
    })


def save(fig, output_dir: Path, name: str) -> None:
    fig.savefig(output_dir / f"{name}.pdf", bbox_inches="tight")
    fig.savefig(output_dir / f"{name}.png", dpi=180, bbox_inches="tight")
    plt.close(fig)


def figure_examples(tasks, output_dir: Path) -> None:
    selected_ids = {"sv_001", "sv_022", "sv_038"}
    selected = [task for task in tasks if task["task_id"] in selected_ids]
    converter = shutil.which("rsvg-convert")
    if not converter:
        return
    fig = plt.figure(figsize=(7.1, 8.25))
    grid = fig.add_gridspec(
        len(selected) * 3,
        2,
        height_ratios=[0.34, 2.5, 1.48] * len(selected),
        hspace=0.10,
        wspace=0.04,
    )
    with tempfile.TemporaryDirectory() as directory:
        directory = Path(directory)
        for row, task in enumerate(selected):
            for column, field in enumerate(("initial_svg", "target_svg")):
                label_axis = fig.add_subplot(grid[row * 3, column])
                label_axis.axis("off")
                label_axis.text(
                    0,
                    0,
                    "Corrupted input" if column == 0 else "Hidden target",
                    transform=label_axis.transAxes,
                    fontsize=11,
                    ha="left",
                    va="bottom",
                )

                axis = fig.add_subplot(grid[row * 3 + 1, column])
                svg_path = directory / f"{task['task_id']}-{field}.svg"
                png_path = svg_path.with_suffix(".png")
                svg_path.write_text(task[field])
                subprocess.run([converter, "-w", "900", "-o", str(png_path), str(svg_path)], check=True)
                axis.imshow(Image.open(png_path))
                axis.axis("off")

            prompt_axis = fig.add_subplot(grid[row * 3 + 2, :])
            prompt_axis.axis("off")
            prompt_axis.text(
                0,
                0.96,
                textwrap.fill(task["instruction"], width=96),
                transform=prompt_axis.transAxes,
                fontsize=7,
                linespacing=1.18,
                ha="left",
                va="top",
                clip_on=True,
            )
    save(fig, output_dir, "corpus-examples")


def figure_task_operations(tasks, output_dir: Path) -> None:
    operations = Counter(operation_family(diff) for task in tasks for diff in task["expected_diff"])
    edit_counts = [len(task["expected_diff"]) for task in tasks]
    fig, axes = plt.subplots(1, 2, figsize=(7.1, 2.55), gridspec_kw={"width_ratios": [1.45, 1]})
    labels, values = zip(*sorted(operations.items(), key=lambda item: item[1]))
    colors = [GRAY, TEAL, BLUE, PURPLE, RED, ORANGE][: len(labels)]
    axes[0].barh(labels, values, color=colors)
    axes[0].set_xlabel("Annotated repairs")
    axes[0].set_title("Operation coverage", loc="left")
    bins = np.arange(min(edit_counts) - 0.5, max(edit_counts) + 1.5, 1)
    axes[1].hist(edit_counts, bins=bins, color=ORANGE, edgecolor="white")
    axes[1].set_xticks(sorted(set(edit_counts)))
    axes[1].set_xlabel("Repairs per task")
    axes[1].set_ylabel("Tasks")
    axes[1].set_title("Task density", loc="left")
    fig.tight_layout()
    save(fig, output_dir, "task-operations")


def figure_complexity(tasks, output_dir: Path) -> None:
    nodes = [sum(1 for _ in ET.fromstring(task["initial_svg"]).iter()) for task in tasks]
    protected = [len(task["should_preserve"]) for task in tasks]
    edits = [len(task["expected_diff"]) for task in tasks]
    colors = [ORANGE if task["category"] == "downloaded_scenic_surgical" else TEAL for task in tasks]
    sizes = [24 + edit * 8 for edit in edits]
    fig, ax = plt.subplots(figsize=(5.2, 3.05))
    ax.scatter(nodes, protected, s=sizes, c=colors, alpha=0.8, edgecolor="white", linewidth=0.5)
    ax.set_xlabel("SVG element count")
    ax.set_ylabel("Protected objects")
    ax.set_title("Dense scenes create large preservation surfaces", loc="left")
    ax.grid(alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "task-complexity")


def figure_model_rewards(summaries, output_dir: Path) -> None:
    rows = list(reversed(summaries))
    y = np.arange(len(rows))
    values = np.array([row["spec_pass_rate"] for row in rows])
    lower = values - np.array([row["reward_ci_low"] for row in rows])
    upper = np.array([row["reward_ci_high"] for row in rows]) - values
    colors = [group_color(row["group"]) for row in rows]
    fig, ax = plt.subplots(figsize=(7.1, 7.8))
    ax.barh(y, values * 100, color=colors, alpha=0.88)
    ax.errorbar(values * 100, y, xerr=np.vstack([lower, upper]) * 100, fmt="none", ecolor=INK, capsize=2, linewidth=0.8)
    ax.set_yticks(y, [row["name"] for row in rows], fontsize=7.5)
    ax.set_xlabel("Specification pass (%)")
    ax.set_title("Full semantic-perceptual pass (95% Wilson CIs)", loc="left")
    ax.set_xlim(0, max(5.0, float(np.max(values + upper)) * 115))
    ax.grid(axis="x", alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "model-binary-reward")


def figure_edit_vs_ucr(summaries, output_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(5.6, 3.7))
    for row in summaries:
        if row["unintended_change_rate"] is None:
            continue
        color = group_color(row["group"])
        ax.scatter(row["repair_progress"] * 100, row["unintended_change_rate"] * 100, s=26 + row["spec_pass_rate"] * 120, color=color, alpha=0.8)
    for row in highlighted_summaries(summaries):
        if row["unintended_change_rate"] is None:
            continue
        annotate_point(
            ax,
            row["name"],
            row["repair_progress"] * 100,
            row["unintended_change_rate"] * 100,
        )
    ax.set_xlabel("Mean repair progress (%)")
    ax.set_ylabel("Unintended change rate (%)")
    ax.set_title("Repair progress and collateral change are distinct", loc="left")
    ax.grid(alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "edit-completion-vs-ucr")


def figure_operation_heatmap(records, summaries, tasks, output_dir: Path) -> None:
    families = ["Add/remove", "Color", "Position/shape", "Path shape", "Line weight", "Opacity"]
    task_families = {
        task["task_id"]: [operation_family(diff) for diff in task["expected_diff"]]
        for task in tasks
    }
    by_model = defaultdict(lambda: defaultdict(list))
    for record in records:
        report = record.get("diff_report") or {}
        checks = report.get("expected_changes", [])
        if checks:
            for check in checks:
                family = operation_family(check)
                by_model[record["requested_model"]][family].append(
                    float(check.get("progress", check.get("passed", False)) or 0)
                )
        else:
            for family in task_families[record["task_id"]]:
                by_model[record["requested_model"]][family].append(0.0)
    matrix = np.array([
        [np.mean(by_model[row["id"]][family]) if by_model[row["id"]][family] else np.nan for family in families]
        for row in summaries
    ])
    fig, ax = plt.subplots(figsize=(7.1, 7.1))
    image = ax.imshow(matrix * 100, aspect="auto", cmap="viridis", vmin=0, vmax=100)
    ax.set_xticks(range(len(families)), families, rotation=35, ha="right")
    ax.set_yticks(range(len(summaries)), [row["name"] for row in summaries], fontsize=7.2)
    ax.set_title("Repair progress by operation family", loc="left")
    colorbar = fig.colorbar(image, ax=ax, fraction=0.025, pad=0.02)
    colorbar.set_label("Mean repair progress (%)")
    fig.tight_layout()
    save(fig, output_dir, "operation-heatmap")


def figure_cost_pareto(summaries, output_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(5.6, 3.7))
    for row in summaries:
        color = group_color(row["group"])
        ax.scatter(max(row["cost_usd"], 1e-5), row["repair_progress"] * 100, color=color, s=32, alpha=0.82)
    for row in highlighted_summaries(summaries):
        annotate_point(
            ax,
            row["name"],
            max(row["cost_usd"], 1e-5),
            row["repair_progress"] * 100,
            log_x=True,
        )
    ax.set_xscale("log")
    ax.set_xlabel("Run cost for 40 tasks (USD, log scale)")
    ax.set_ylabel("Mean repair progress (%)")
    ax.set_title("Quality-cost trade-off", loc="left")
    ax.grid(alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "quality-cost-pareto")


def figure_gate_decomposition(rows: list[dict[str, Any]], output_dir: Path) -> None:
    labels = [row["label"] for row in rows]
    values = [row["count"] for row in rows]
    colors = [TEAL, ORANGE, BLUE, GRAY]
    fig, ax = plt.subplots(figsize=(6.2, 2.9))
    bars = ax.barh(range(len(rows)), values, color=colors)
    ax.set_yticks(range(len(rows)), labels)
    ax.invert_yaxis()
    ax.set_xlabel("Model-task outcomes")
    ax.set_title("Every outcome assigned to one evaluation gate", loc="left")
    ax.bar_label(
        bars,
        labels=[f"{row['count']} ({row['rate'] * 100:.1f}%)" for row in rows],
        padding=4,
        fontsize=8,
    )
    ax.set_xlim(0, max(values) * 1.18)
    ax.grid(axis="x", alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "gate-decomposition")


def write_macros(path: Path, results: dict[str, Any]) -> None:
    corpus = results["corpus"]
    macros = {
        "TaskCount": corpus["tasks"],
        "ModelCount": results["models"],
        "OpenModelCount": results["open_weight_models"],
        "ControlModelCount": results["cheap_control_models"],
        "FrontierModelCount": results["frontier_models"],
        "RequestCount": results["requests"],
        "SpecificationPassCount": results["specification_passes"],
        "SpecificationPassRate": f"{results['specification_pass_rate'] * 100:.2f}\\%",
        "NearPassCount": results["near_passes"],
        "NearPassRate": f"{results['near_pass_rate'] * 100:.2f}\\%",
        "RepairPassCount": results["repair_passes"],
        "RepairPassRate": f"{results['repair_pass_rate'] * 100:.2f}\\%",
        "CleanPassCount": results["preservation_passes"],
        "CleanPassRate": f"{results['preservation_pass_rate'] * 100:.2f}\\%",
        "SourceCleanPassCount": results["source_preservation_passes"],
        "SourceCleanPassRate": f"{results['source_preservation_pass_rate'] * 100:.2f}\\%",
        "OverallRepairProgress": f"{results['repair_progress'] * 100:.1f}\\%",
        "ValidRepairProgress": f"{results['valid_repair_progress'] * 100:.1f}\\%",
        "OverallValidUCR": f"{results['valid_output_ucr'] * 100:.1f}\\%",
        "TargetMatchCount": results["target_matches"],
        "TargetMatchRate": f"{results['target_match_rate'] * 100:.2f}\\%",
        "PartialOutcomeCount": results["partial_outcomes"],
        "PartialOutcomeRate": f"{results['partial_outcome_rate'] * 100:.1f}\\%",
        "SideEffectCount": results["side_effect_outcomes"],
        "ExpectedEditCount": corpus["expected_edits_total"],
        "MeanExpectedEdits": f"{corpus['expected_edits_mean']:.2f}",
        "MeanProtectedObjects": f"{corpus['protected_objects_mean']:.2f}",
        "TopModel": latex_escape(results["top_model"]),
        "TopReward": f"{results['top_reward'] * 100:.1f}\\%",
        "TopNearPass": f"{results['top_near_pass'] * 100:.1f}\\%",
        "TopRepairPass": f"{results['top_repair_pass'] * 100:.1f}\\%",
        "TopPreservationPass": f"{results['top_preservation_pass'] * 100:.1f}\\%",
        "TopEditCompletion": f"{results['top_edit_completion'] * 100:.1f}\\%",
        "TopRepairProgress": f"{results['top_repair_progress'] * 100:.1f}\\%",
        "TopUCR": f"{results['top_ucr'] * 100:.1f}\\%",
        "TopValidity": f"{results['top_validity'] * 100:.1f}\\%",
        "FrontierTopModel": latex_escape(results["frontier_top_model"]),
        "FrontierTopReward": f"{results['frontier_top_reward'] * 100:.1f}\\%",
        "FrontierTopNearPass": f"{results['frontier_top_near_pass'] * 100:.1f}\\%",
        "FrontierTopRepairPass": f"{results['frontier_top_repair_pass'] * 100:.1f}\\%",
        "FrontierTopPreservationPass": f"{results['frontier_top_preservation_pass'] * 100:.1f}\\%",
        "FrontierTopEditCompletion": f"{results['frontier_top_edit_completion'] * 100:.1f}\\%",
        "FrontierTopRepairProgress": f"{results['frontier_top_repair_progress'] * 100:.1f}\\%",
        "FrontierTopValidity": f"{results['frontier_top_validity'] * 100:.1f}\\%",
        "FrontierTopTruncation": f"{results['frontier_top_truncation'] * 100:.1f}\\%",
        "TotalCost": f"\\${results['total_cost_usd']:.2f}",
        "OverallErrorRate": f"{results['error_rate'] * 100:.1f}\\%",
        "OverallTruncationRate": f"{results['truncation_rate'] * 100:.1f}\\%",
        "OverallValidity": f"{results['validity_rate'] * 100:.1f}\\%",
    }
    path.write_text("\n".join(f"\\newcommand{{\\{name}}}{{{value}}}" for name, value in macros.items()) + "\n")


def group_color(group: str) -> str:
    return {
        "open-weight": TEAL,
        "cheap-control": ORANGE,
        "frontier": PURPLE,
    }.get(group, GRAY)


def highlighted_summaries(summaries) -> list[dict[str, Any]]:
    highlighted = [summaries[0]]
    highlighted.extend(row for row in summaries if row["group"] == "frontier")
    return list({row["id"]: row for row in highlighted}.values())


def annotate_point(ax, label: str, x: float, y: float, *, log_x: bool = False) -> None:
    align_right = x > (1.5 if log_x else 34)
    vertical_offset = -8 if y > 92 else (7 if y < 4 else 4)
    ax.annotate(
        label,
        (x, y),
        xytext=(-5 if align_right else 5, vertical_offset),
        textcoords="offset points",
        fontsize=7,
        ha="right" if align_right else "left",
        va="bottom" if vertical_offset >= 0 else "top",
    )


def write_main_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        r"\begin{tabular}{lrrrrrrrr}",
        r"\toprule",
        r"Model & Full $\uparrow$ & Near $\uparrow$ & Repair $\uparrow$ & Progress $\uparrow$ & Clean $\uparrow$ & UCR $\downarrow$ & Valid $\uparrow$ & Cost \\",
        r"\midrule",
    ]
    for row in rows:
        ucr = "--" if row["unintended_change_rate"] is None else f"{row['unintended_change_rate'] * 100:.1f}"
        lines.append(
            f"{latex_escape(row['name'])} & {row['spec_pass_rate'] * 100:.1f} & {row['near_pass_rate'] * 100:.1f} & "
            f"{row['repair_pass_rate'] * 100:.1f} & {row['repair_progress'] * 100:.1f} & "
            f"{row['preservation_pass_rate'] * 100:.1f} & "
            f"{ucr} & {row['validity_rate'] * 100:.1f} & \\${row['cost_usd']:.3f} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def write_full_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [r"\begin{longtable}{llrrrrrrrrr}", r"\toprule", r"Model & Group & Full & Near & Repair & Progress & Clean & UCR & Valid & Trunc. & Errors \\", r"\midrule", r"\endhead"]
    for row in rows:
        ucr = "--" if row["unintended_change_rate"] is None else f"{row['unintended_change_rate'] * 100:.1f}"
        lines.append(
            f"{latex_escape(row['name'])} & {latex_escape(row['group'])} & {row['spec_pass_rate'] * 100:.1f} & "
            f"{row['near_pass_rate'] * 100:.1f} & {row['repair_pass_rate'] * 100:.1f} & "
            f"{row['repair_progress'] * 100:.1f} & {row['preservation_pass_rate'] * 100:.1f} & "
            f"{ucr} & "
            f"{row['validity_rate'] * 100:.1f} & {row['truncation_rate'] * 100:.1f} & "
            f"{row['error_rate'] * 100:.1f} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{longtable}"])
    path.write_text("\n".join(lines) + "\n")


def write_corpus_table(path: Path, corpus: dict[str, Any]) -> None:
    rows = [
        ("Tasks", corpus["tasks"]),
        ("Annotated repairs", corpus["expected_edits_total"]),
        ("Repairs per task (mean)", f"{corpus['expected_edits_mean']:.2f}"),
        ("Protected objects per task (mean)", f"{corpus['protected_objects_mean']:.2f}"),
        ("SVG elements per task (mean)", f"{corpus['svg_nodes_mean']:.1f}"),
        ("Input characters (total)", f"{corpus['input_characters_total']:,}"),
    ]
    lines = [r"\begin{tabular}{lr}", r"\toprule", r"Statistic & Value \\", r"\midrule"]
    lines.extend(f"{label} & {value} \\\\" for label, value in rows)
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def write_gate_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        r"\begin{tabular}{lrr}",
        r"\toprule",
        r"Outcome & Count & Rate \\",
        r"\midrule",
    ]
    lines.extend(
        f"{latex_escape(row['label'])} & {row['count']} & {row['rate'] * 100:.1f} \\\\"
        for row in rows
    )
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def write_sensitivity_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        r"\begin{tabular}{lrrrr}",
        r"\toprule",
        r"Scale & Full $n$ & Full \% & Repair $n$ & Repair \% \\",
        r"\midrule",
    ]
    labels = {0.5: r"$0.5\times$", 1.0: r"$\mathbf{1.0\times}$", 1.5: r"$1.5\times$"}
    for row in rows:
        lines.append(
            f"{labels[row['scale']]} & {row['specification_passes']} & "
            f"{row['specification_pass_rate'] * 100:.2f} & {row['repair_passes']} & "
            f"{row['repair_pass_rate'] * 100:.2f} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def write_controls_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        r"\begin{tabular}{lrrrrrr}",
        r"\toprule",
        r"Control & Full & Repair & Progress & Clean & UCR & Valid \\",
        r"\midrule",
    ]
    for row in rows:
        ucr = "--" if row["ucr"] is None else f"{row['ucr'] * 100:.1f}"
        lines.append(
            f"{latex_escape(row['name'])} & {row['full'] * 100:.1f} & {row['repair'] * 100:.1f} & "
            f"{row['progress'] * 100:.1f} & {row['clean'] * 100:.1f} & {ucr} & "
            f"{row['valid'] * 100:.1f} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def latex_escape(value: str) -> str:
    replacements = {"&": r"\&", "%": r"\%", "_": r"\_", "#": r"\#"}
    return "".join(replacements.get(char, char) for char in value)


if __name__ == "__main__":
    raise SystemExit(main())
