from __future__ import annotations

import re
from pathlib import Path

from vector_edit_gym.diffing import diff_report
from vector_edit_gym.tasks import load_tasks


ROOT = Path(__file__).resolve().parents[3]
TASKS = ROOT / "data" / "tasks"


def test_all_frozen_targets_receive_reward_one() -> None:
    tasks = load_tasks(data_dir=TASKS)
    assert len(tasks) == 40
    for task in tasks:
        report = diff_report(task, task.target_svg)
        assert report.reward == 1, task.task_id
        assert report.edit_completion == 1.0, task.task_id
        assert report.unintended_change_rate == 0.0, task.task_id


def test_public_instructions_are_visual_not_dom_patches() -> None:
    forbidden = re.compile(
        r"`|#[0-9a-fA-F]{3,6}\b|\b(?:cx|cy|opacity|stroke-width|viewBox)\b|"
        r"\b(?:sv_\d+|download-sv-|Patch:)|\d|"
        r"\b(?:svg|dom|id|element|attribute|coordinate|transform|path data)\b",
        re.IGNORECASE,
    )
    tasks = load_tasks(data_dir=TASKS)
    assert len({task.instruction for task in tasks}) == 40
    for task in tasks:
        assert not forbidden.search(task.instruction), task.task_id
