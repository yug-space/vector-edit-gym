#!/usr/bin/env python3
"""Generate paper-ready tables, figures, and statistics from one canonical run."""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import subprocess
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
    parser.add_argument("--bootstrap", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=731)
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

    rng = random.Random(args.seed)
    confidence = bootstrap_intervals(records, args.bootstrap, rng)
    for summary in summaries:
        summary["reward_ci_low"], summary["reward_ci_high"] = confidence[summary["id"]]

    corpus = corpus_stats(tasks)
    results = result_stats(records, summaries, meta, corpus)
    (args.out / "analysis.json").write_text(json.dumps(results, indent=2) + "\n")
    write_macros(args.out / "results.tex", results)
    write_main_table(args.out / "main-table.tex", summaries[:10])
    write_full_table(args.out / "full-table.tex", summaries)
    write_corpus_table(args.out / "corpus-table.tex", corpus)

    set_style()
    figure_examples(tasks, args.figures)
    figure_task_operations(tasks, args.figures)
    figure_complexity(tasks, args.figures)
    figure_model_rewards(summaries, args.figures)
    figure_edit_vs_ucr(summaries, args.figures)
    figure_operation_heatmap(records, summaries, tasks, args.figures)
    figure_cost_pareto(summaries, args.figures)
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
    repairs = sum(bool(record.get("repair_pass")) for record in records)
    preserved = sum(bool(record.get("preservation_pass")) for record in records)
    target_matches = sum(bool(record.get("structural")) for record in records)
    partials = sum(
        not record.get("reward") and float(record.get("edit_completion") or 0) > 0
        for record in records
    )
    side_effects = sum(record.get("status") == "SIDE_EFFECTS" for record in records)
    return {
        "protocol": meta.get("protocol"),
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
        "repair_passes": repairs,
        "repair_pass_rate": repairs / len(records),
        "preservation_passes": preserved,
        "preservation_pass_rate": preserved / len(records),
        "target_matches": target_matches,
        "target_match_rate": target_matches / len(records),
        "partial_outcomes": partials,
        "partial_outcome_rate": partials / len(records),
        "side_effect_outcomes": side_effects,
        "side_effect_outcome_rate": side_effects / len(records),
        "top_model": best["name"],
        "top_model_id": best["id"],
        "top_reward": best["spec_pass_rate"],
        "top_repair_pass": best["repair_pass_rate"],
        "top_preservation_pass": best["preservation_pass_rate"],
        "top_reward_ci_low": best["reward_ci_low"],
        "top_reward_ci_high": best["reward_ci_high"],
        "top_edit_completion": best["edit_completion"],
        "top_ucr": best["unintended_change_rate"],
        "top_validity": best["validity_rate"],
        "frontier_top_model": frontier_best["name"] if frontier_best else "n/a",
        "frontier_top_reward": frontier_best["spec_pass_rate"] if frontier_best else 0.0,
        "frontier_top_repair_pass": frontier_best["repair_pass_rate"] if frontier_best else 0.0,
        "frontier_top_preservation_pass": frontier_best["preservation_pass_rate"] if frontier_best else 0.0,
        "frontier_top_edit_completion": frontier_best["edit_completion"] if frontier_best else 0.0,
        "frontier_top_validity": frontier_best["validity_rate"] if frontier_best else 0.0,
        "frontier_top_truncation": frontier_best["truncation_rate"] if frontier_best else 0.0,
        "corpus": corpus,
    }


def bootstrap_intervals(records, samples: int, rng: random.Random) -> dict[str, tuple[float, float]]:
    grouped = defaultdict(list)
    for record in records:
        grouped[record["requested_model"]].append(float(record.get("reward") or 0))
    intervals = {}
    for model, values in grouped.items():
        means = []
        for _ in range(samples):
            means.append(sum(rng.choice(values) for _ in values) / len(values))
        intervals[model] = (float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5)))
    return intervals


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
    ax.set_title("Tolerant repair with strict preservation (95% task-bootstrap CIs)", loc="left")
    ax.set_xlim(0, max(5.0, float(np.max(values + upper)) * 115))
    ax.grid(axis="x", alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "model-binary-reward")


def figure_edit_vs_ucr(summaries, output_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(5.6, 3.7))
    for row in summaries:
        color = group_color(row["group"])
        ax.scatter(row["edit_completion"] * 100, row["unintended_change_rate"] * 100, s=26 + row["spec_pass_rate"] * 120, color=color, alpha=0.8)
    for row in highlighted_summaries(summaries):
        annotate_point(
            ax,
            row["name"],
            row["edit_completion"] * 100,
            row["unintended_change_rate"] * 100,
        )
    ax.set_xlabel("Requested edits completed (%)")
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
                by_model[record["requested_model"]][family].append(float(check.get("passed", False)))
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
    ax.set_title("Expected-edit completion by operation family", loc="left")
    colorbar = fig.colorbar(image, ax=ax, fraction=0.025, pad=0.02)
    colorbar.set_label("Checks passed (%)")
    fig.tight_layout()
    save(fig, output_dir, "operation-heatmap")


def figure_cost_pareto(summaries, output_dir: Path) -> None:
    fig, ax = plt.subplots(figsize=(5.6, 3.7))
    for row in summaries:
        color = group_color(row["group"])
        ax.scatter(max(row["cost_usd"], 1e-5), row["edit_completion"] * 100, color=color, s=32, alpha=0.82)
    for row in highlighted_summaries(summaries):
        annotate_point(
            ax,
            row["name"],
            max(row["cost_usd"], 1e-5),
            row["edit_completion"] * 100,
            log_x=True,
        )
    ax.set_xscale("log")
    ax.set_xlabel("Run cost for 40 tasks (USD, log scale)")
    ax.set_ylabel("Requested edits completed (%)")
    ax.set_title("Quality-cost trade-off", loc="left")
    ax.grid(alpha=0.18)
    fig.tight_layout()
    save(fig, output_dir, "quality-cost-pareto")


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
        "RepairPassCount": results["repair_passes"],
        "RepairPassRate": f"{results['repair_pass_rate'] * 100:.2f}\\%",
        "CleanPassCount": results["preservation_passes"],
        "CleanPassRate": f"{results['preservation_pass_rate'] * 100:.2f}\\%",
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
        "TopRepairPass": f"{results['top_repair_pass'] * 100:.1f}\\%",
        "TopPreservationPass": f"{results['top_preservation_pass'] * 100:.1f}\\%",
        "TopEditCompletion": f"{results['top_edit_completion'] * 100:.1f}\\%",
        "TopUCR": f"{results['top_ucr'] * 100:.1f}\\%",
        "TopValidity": f"{results['top_validity'] * 100:.1f}\\%",
        "FrontierTopModel": latex_escape(results["frontier_top_model"]),
        "FrontierTopReward": f"{results['frontier_top_reward'] * 100:.1f}\\%",
        "FrontierTopRepairPass": f"{results['frontier_top_repair_pass'] * 100:.1f}\\%",
        "FrontierTopPreservationPass": f"{results['frontier_top_preservation_pass'] * 100:.1f}\\%",
        "FrontierTopEditCompletion": f"{results['frontier_top_edit_completion'] * 100:.1f}\\%",
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
        r"\begin{tabular}{lrrrrrrr}",
        r"\toprule",
        r"Model & Spec. $\uparrow$ & Repair $\uparrow$ & Clean $\uparrow$ & Edit $\uparrow$ & UCR $\downarrow$ & Valid $\uparrow$ & Cost \\",
        r"\midrule",
    ]
    for row in rows:
        lines.append(
            f"{latex_escape(row['name'])} & {row['spec_pass_rate'] * 100:.1f} & {row['repair_pass_rate'] * 100:.1f} & "
            f"{row['preservation_pass_rate'] * 100:.1f} & {row['edit_completion'] * 100:.1f} & "
            f"{row['unintended_change_rate'] * 100:.1f} & {row['validity_rate'] * 100:.1f} & \\${row['cost_usd']:.3f} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}"])
    path.write_text("\n".join(lines) + "\n")


def write_full_table(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [r"\begin{longtable}{llrrrrrrrr}", r"\toprule", r"Model & Group & Spec. & Repair & Clean & Edit & UCR & Valid & Trunc. & Errors \\", r"\midrule", r"\endhead"]
    for row in rows:
        lines.append(
            f"{latex_escape(row['name'])} & {latex_escape(row['group'])} & {row['spec_pass_rate'] * 100:.1f} & "
            f"{row['repair_pass_rate'] * 100:.1f} & {row['preservation_pass_rate'] * 100:.1f} & "
            f"{row['edit_completion'] * 100:.1f} & {row['unintended_change_rate'] * 100:.1f} & "
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


def latex_escape(value: str) -> str:
    replacements = {"&": r"\&", "%": r"\%", "_": r"\_", "#": r"\#"}
    return "".join(replacements.get(char, char) for char in value)


if __name__ == "__main__":
    raise SystemExit(main())
