from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from vector_edit_gym.diffing import diff_report
from vector_edit_gym.metrics import binary_reward, structural_match
from vector_edit_gym.tasks import Task


ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture()
def task() -> Task:
    raw = json.loads((ROOT / "data" / "tasks" / "sv_001.json").read_text())
    return Task.from_json(raw)


def test_target_receives_binary_reward(task: Task) -> None:
    report = diff_report(task, task.target_svg)
    assert report.reward == 1
    assert report.edit_completion == 1.0
    assert report.unintended_change_rate == 0.0


def test_representation_only_differences_are_accepted() -> None:
    target = '<svg viewBox="0 0 10 10"><rect id="box" x="1" fill="#ffffff" width="8" height="8" /></svg>'
    produced = '<svg viewBox="0,0,10.0,10"><rect height="8.0" width="8" fill="white" x="1.000" id="box"/></svg>'
    assert structural_match(produced, target)
    assert binary_reward(produced, target) == 1


def test_namespace_prefix_spelling_is_accepted_but_missing_namespace_is_not() -> None:
    target = '<svg xmlns="http://www.w3.org/2000/svg"><path id="p" d="M0 0L1 1" /></svg>'
    prefixed = '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:path d="M 0,0 L 1,1" id="p"/></s:svg>'
    unnamespaced = '<svg><path id="p" d="M0 0L1 1" /></svg>'
    assert structural_match(prefixed, target)
    assert not structural_match(unnamespaced, target)


def test_invalid_path_punctuation_is_not_discarded() -> None:
    target = '<svg><path d="M0 0 L1 1" /></svg>'
    produced = '<svg><path d="M0 0; L1 1" /></svg>'
    assert not structural_match(produced, target)


def test_numeric_normalization_does_not_round_semantic_changes() -> None:
    target = '<svg><rect x="0.123456789" /></svg>'
    produced = '<svg><rect x="0.123456788" /></svg>'
    assert not structural_match(produced, target)


def test_malformed_style_and_changed_tail_text_are_rejected() -> None:
    target = '<svg><g style="fill:red;stroke:white" />label</svg>'
    reordered = '<svg><g style="stroke:#fff; fill:#ff0000" />label</svg>'
    malformed = '<svg><g style="fill:red;stroke:white;garbage" />label</svg>'
    changed_tail = '<svg><g style="fill:red;stroke:white" />other</svg>'
    assert structural_match(reordered, target)
    assert not structural_match(malformed, target)
    assert not structural_match(changed_tail, target)


def test_unchanged_output_fails_a_repair(task: Task) -> None:
    report = diff_report(task, task.initial_svg)
    assert report.reward == 0
    assert report.edit_completion < 1.0


def test_unintended_deletion_fails_even_when_requested_edits_pass(task: Task) -> None:
    root = ET.fromstring(task.target_svg)
    protected_id = task.should_preserve[0]
    for parent in root.iter():
        for child in list(parent):
            if child.attrib.get("id") == protected_id:
                parent.remove(child)
                produced = ET.tostring(root, encoding="unicode")
                report = diff_report(task, produced)
                assert report.reward == 0
                assert report.edit_completion == 1.0
                assert report.unintended_change_rate > 0.0
                assert protected_id in report.unexpected_changed_parts
                return
    raise AssertionError(f"protected element not found: {protected_id}")


def test_unknown_element_is_reported(task: Task) -> None:
    root = ET.fromstring(task.target_svg)
    root.append(ET.Element("circle", {"id": "unrequested-dot", "cx": "1", "cy": "1", "r": "1"}))
    report = diff_report(task, ET.tostring(root, encoding="unicode"))
    assert report.reward == 0
    assert "+unrequested-dot" in report.unexpected_changed_parts


def test_malformed_svg_gets_zero(task: Task) -> None:
    report = diff_report(task, "<svg><g></svg>")
    assert report.reward == 0
    assert not report.produced_parse_ok
    assert report.edit_completion == 0.0
    assert report.unintended_change_rate == 1.0


def test_malformed_svg_does_not_pass_a_deletion_check() -> None:
    deletion_task = Task(
        task_id="sv_999",
        difficulty="hard",
        category="test",
        instruction="Remove the extra dot.",
        initial_svg='<svg><circle id="dot" /></svg>',
        target_svg="<svg />",
        parts=["dot"],
        target_parts=["dot"],
        expected_diff=[{"part": "dot", "attribute": "exists", "before": True, "after": False}],
    )
    report = diff_report(deletion_task, "<svg><g></svg>")
    assert report.reward == 0
    assert report.edit_completion == 0.0
