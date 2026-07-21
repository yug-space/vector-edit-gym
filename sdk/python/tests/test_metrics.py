from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from vector_edit_gym.diffing import diff_report, outcome_status
from vector_edit_gym.evaluate import EvaluationResult, TaskResult
from vector_edit_gym.metrics import parse_svg, structural_match, target_match_reward, valid_svg_tree
from vector_edit_gym.semantic import semantic_trees_equal
from vector_edit_gym.tasks import Task


ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture()
def task() -> Task:
    raw = json.loads((ROOT / "data" / "tasks" / "sv_001.json").read_text())
    return Task.from_json(raw)


def test_target_passes_the_specification(task: Task) -> None:
    report = diff_report(task, task.target_svg)
    assert report.reward == 1
    assert report.repair_pass
    assert report.preservation_pass
    assert report.validity_pass
    assert report.edit_completion == 1.0
    assert report.unintended_change_rate == 0.0


def test_representation_only_differences_are_accepted() -> None:
    target = '<svg viewBox="0 0 10 10"><rect id="box" x="1" fill="#ffffff" width="8" height="8" /></svg>'
    produced = '<svg viewBox="0,0,10.0,10"><rect height="8.0" width="8" fill="white" x="1.000" id="box"/></svg>'
    assert structural_match(produced, target)
    assert target_match_reward(produced, target) == 1


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


def test_anonymous_added_element_fails_preservation(task: Task) -> None:
    root = ET.fromstring(task.target_svg)
    root.append(ET.Element("circle", {"cx": "1", "cy": "1", "r": "1"}))
    report = diff_report(task, ET.tostring(root, encoding="unicode"))
    assert report.repair_pass
    assert not report.preservation_pass
    assert report.reward == 0
    assert "__svg" in report.unexpected_changed_parts


def _single_edit_task(*, attribute: str = "x", before=10, after=30) -> Task:
    box_x = before if attribute == "x" else 10
    box_fill = before if attribute == "fill" else "#6a1a1a"
    initial = (
        '<svg viewBox="0 0 200 100"><defs><linearGradient id="paint">'
        '<stop id="stop" offset="0" stop-color="#000000" /></linearGradient></defs>'
        f'<rect id="box" x="{box_x}" y="10" width="20" height="20" fill="{box_fill}" />'
        '<circle id="keep" cx="150" cy="50" r="8" fill="#ffffff" /></svg>'
    )
    target = initial.replace(f'{attribute}="{before}"', f'{attribute}="{after}"')
    return Task(
        task_id="sv_999",
        difficulty="hard",
        category="test",
        instruction="Put the box back where it belongs.",
        initial_svg=initial,
        target_svg=target,
        parts=["box", "keep", "paint", "stop"],
        target_parts=["box"],
        expected_diff=[{"part": "box", "attribute": attribute, "before": before, "after": after}],
        should_preserve=["keep"],
    )


def test_approximate_requested_edit_passes_without_target_match() -> None:
    task = _single_edit_task()
    produced = task.target_svg.replace('x="30"', 'x="33"')
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.repair_pass
    assert report.preservation_pass
    assert not report.structural
    assert report.expected_changes[0].distance == 3
    assert report.expected_changes[0].tolerance == 5
    assert report.expected_changes[0].baseline_distance == 20
    assert report.expected_changes[0].progress == 0.85


def test_requested_edit_outside_tolerance_fails() -> None:
    task = _single_edit_task()
    produced = task.target_svg.replace('x="30"', 'x="36"')
    report = diff_report(task, produced)
    assert report.reward == 0
    assert not report.repair_pass
    assert report.preservation_pass


def test_perceptually_close_color_passes() -> None:
    task = _single_edit_task(attribute="fill", before="#00ffff", after="#6a1a1a")
    produced = task.target_svg.replace('fill="#6a1a1a"', 'fill="#6b1a1a"', 1)
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.expected_changes[0].comparison == "color-lab"


def test_unlisted_definition_change_fails_preservation() -> None:
    task = _single_edit_task()
    produced = task.target_svg.replace('stop-color="#000000"', 'stop-color="#010101"')
    report = diff_report(task, produced)
    assert report.repair_pass
    assert not report.preservation_pass
    assert report.reward == 0
    assert "stop" in report.unexpected_changed_parts


def test_unrequested_attribute_on_repaired_object_fails_preservation() -> None:
    task = _single_edit_task()
    produced = task.target_svg.replace('fill="#6a1a1a"', 'fill="#6b1a1a"')
    report = diff_report(task, produced)
    assert report.repair_pass
    assert not report.preservation_pass
    assert "box" in report.unexpected_changed_parts


def test_scene_reordering_fails_preservation() -> None:
    task = _single_edit_task()
    root = ET.fromstring(task.target_svg)
    children = list(root)
    root[:] = [children[0], children[2], children[1]]
    report = diff_report(task, ET.tostring(root, encoding="unicode"))
    assert report.repair_pass
    assert not report.preservation_pass
    assert report.reward == 0


def test_duplicate_ids_make_svg_invalid() -> None:
    task = _single_edit_task()
    produced = task.target_svg.replace(
        "</svg>", '<circle id="keep" cx="1" cy="1" r="1" /></svg>'
    )
    report = diff_report(task, produced)
    assert not report.validity_pass
    assert report.reward == 0


def test_approximate_path_coordinates_pass_with_matching_topology() -> None:
    task = Task(
        task_id="sv_998",
        difficulty="hard",
        category="test",
        instruction="Restore the bent line.",
        initial_svg='<svg viewBox="0 0 200 100"><path id="line" d="M10 10 L30 30" /></svg>',
        target_svg='<svg viewBox="0 0 200 100"><path id="line" d="M20 20 L40 40" /></svg>',
        parts=["line"],
        target_parts=["line"],
        expected_diff=[{
            "part": "line",
            "attribute": "d",
            "before": "M10 10 L30 30",
            "after": "M20 20 L40 40",
        }],
    )
    report = diff_report(task, '<svg viewBox="0 0 200 100"><path id="line" d="M21 19 L41 39" /></svg>')
    assert report.reward == 1
    assert report.expected_changes[0].comparison == "path-shape"


def test_equivalent_path_with_different_commands_passes() -> None:
    task = Task(
        task_id="sv_995",
        difficulty="hard",
        category="test",
        instruction="Straighten the line.",
        initial_svg='<svg viewBox="0 0 100 100"><path id="line" d="M10 30 L90 30" /></svg>',
        target_svg='<svg viewBox="0 0 100 100"><path id="line" d="M10 20 C36.6667 20 63.3333 20 90 20" /></svg>',
        parts=["line"],
        target_parts=["line"],
        expected_diff=[{
            "part": "line",
            "attribute": "d",
            "before": "M10 30 L90 30",
            "after": "M10 20 C36.6667 20 63.3333 20 90 20",
        }],
    )
    report = diff_report(task, '<svg viewBox="0 0 100 100"><path id="line" d="M10 20 L90 20" /></svg>')
    assert report.reward == 1
    assert report.expected_changes[0].comparison == "path-shape"
    assert report.expected_changes[0].distance == pytest.approx(0, abs=0.001)


def test_consistent_id_renaming_is_semantically_preserved() -> None:
    task = _single_edit_task()
    produced = (
        task.target_svg
        .replace('id="paint"', 'id="renamed-paint"')
        .replace('id="stop"', 'id="renamed-stop"')
        .replace('id="box"', 'id="renamed-box"')
        .replace('id="keep"', 'id="renamed-keep"')
    )
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.repair_pass
    assert report.preservation_pass
    assert not report.source_preservation_pass
    assert report.expected_changes[0].produced == 30


def test_style_and_presentation_attribute_are_equivalent() -> None:
    task = _single_edit_task(attribute="fill", before="#00ffff", after="#6a1a1a")
    produced = task.target_svg.replace('fill="#6a1a1a"', 'style="fill: #6a1a1a"', 1)
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.preservation_pass
    assert not report.structural


def test_consistent_referenced_id_renaming_is_equivalent() -> None:
    target = ET.fromstring(
        '<svg><defs><linearGradient id="paint"><stop offset="0" /></linearGradient></defs>'
        '<rect id="box" fill="url(#paint)" /></svg>'
    )
    renamed = ET.fromstring(
        '<svg><defs><linearGradient id="gradient"><stop offset="0" /></linearGradient></defs>'
        '<rect id="subject" fill="url(&quot;#gradient&quot;)" /></svg>'
    )
    broken = ET.fromstring(
        '<svg><defs><linearGradient id="gradient"><stop offset="0" /></linearGradient></defs>'
        '<rect id="subject" fill="url(#paint)" /></svg>'
    )
    assert semantic_trees_equal(renamed, target)
    assert not semantic_trees_equal(broken, target)


def test_ucr_accepts_a_protected_external_reference_renamed_consistently() -> None:
    initial = (
        '<svg><defs><linearGradient id="paint"><stop id="stop" offset="0" /></linearGradient></defs>'
        '<rect id="box" x="10" /><circle id="keep" fill="url(#paint)" /></svg>'
    )
    target = initial.replace('x="10"', 'x="30"')
    task = Task(
        task_id="sv_994",
        difficulty="hard",
        category="test",
        instruction="Move the box back into place.",
        initial_svg=initial,
        target_svg=target,
        parts=["paint", "stop", "box", "keep"],
        target_parts=["box"],
        expected_diff=[{"part": "box", "attribute": "x", "before": 10, "after": 30}],
        should_preserve=["keep"],
    )
    produced = (
        target.replace('id="paint"', 'id="gradient"')
        .replace('id="stop"', 'id="gradient-stop"')
        .replace('id="box"', 'id="subject"')
        .replace('id="keep"', 'id="protected"')
        .replace("url(#paint)", "url('#gradient')")
    )
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.preservation_pass
    assert report.unintended_change_rate == 0.0


def test_near_status_is_distinct_from_partial() -> None:
    assert outcome_status({"validity_pass": True, "near_pass": True}) == "NEAR"


def test_requested_addition_uses_visual_tolerances() -> None:
    task = Task(
        task_id="sv_997",
        difficulty="hard",
        category="test",
        instruction="Put the missing panel back.",
        initial_svg='<svg viewBox="0 0 200 100"><circle id="keep" cx="150" cy="50" r="8" /></svg>',
        target_svg='<svg viewBox="0 0 200 100"><circle id="keep" cx="150" cy="50" r="8" /><rect id="panel" x="20" y="20" width="30" height="15" fill="#6a1a1a" /></svg>',
        parts=["keep", "panel"],
        target_parts=["panel"],
        expected_diff=[{"part": "panel", "attribute": "exists", "before": False, "after": True}],
        should_preserve=["keep"],
    )
    produced = '<svg viewBox="0 0 200 100"><circle id="keep" cx="150" cy="50" r="8" /><rect id="panel-renamed" x="23" y="20" width="30" height="15" style="fill:#6b1a1a" /></svg>'
    report = diff_report(task, produced)
    assert report.reward == 1
    assert report.expected_changes[0].comparison == "inserted-subtree"


def test_missing_addition_does_not_alias_a_shifted_sibling() -> None:
    task = Task(
        task_id="sv_997",
        difficulty="hard",
        category="test",
        instruction="Put the missing panel back.",
        initial_svg='<svg><rect id="keep" x="20" width="30" /></svg>',
        target_svg='<svg><rect id="panel" x="20" width="30" /><rect id="keep" x="20" width="30" /></svg>',
        parts=["panel", "keep"],
        target_parts=["panel"],
        expected_diff=[{"part": "panel", "attribute": "exists", "before": False, "after": True}],
        should_preserve=["keep"],
    )
    report = diff_report(task, task.initial_svg)
    assert report.expected_changes[0].produced is False
    assert not report.expected_changes[0].passed


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
    assert report.repair_progress == 0.0


@pytest.mark.parametrize(
    "svg",
    [
        '<svg><path d="M0 0 L" /></svg>',
        '<svg><polyline points="0,0 10" /></svg>',
        '<svg viewBox="0 0 0 100" />',
        '<svg><rect fill="url(#missing)" /></svg>',
        '<svg><rect fill="url(&quot;#missing&quot;)" /></svg>',
        '<svg><use href="#missing" /></svg>',
    ],
)
def test_svg_validity_rejects_broken_geometry_and_references(svg: str) -> None:
    assert not valid_svg_tree(parse_svg(svg))


def test_svg_validity_accepts_resolved_quoted_local_reference() -> None:
    svg = (
        '<svg><defs><filter id="shadow" /></defs>'
        '<rect filter="url(&quot;#shadow&quot;)" /></svg>'
    )
    assert valid_svg_tree(parse_svg(svg))


def test_valid_output_ucr_excludes_invalid_outputs() -> None:
    shared = dict(
        task_id="sv_999",
        difficulty="hard",
        category="test",
        reward=0,
        near_pass=False,
        repair_pass=False,
        preservation_pass=False,
        source_preservation_pass=False,
        exact=False,
        structural=False,
        preservation=0.0,
        source_preservation=0.0,
        edit_completion=0.0,
        repair_progress=0.0,
        elapsed_ms=1.0,
    )
    result = EvaluationResult([
        TaskResult(valid=False, unintended_change_rate=1.0, **shared),
        TaskResult(valid=True, unintended_change_rate=0.2, **shared),
    ])
    assert result.unintended_change_rate == pytest.approx(0.2)
    invalid_only = EvaluationResult([TaskResult(valid=False, unintended_change_rate=1.0, **shared)])
    assert invalid_only.unintended_change_rate is None


def test_invalid_requested_numeric_list_returns_a_report() -> None:
    task = Task(
        task_id="sv_996",
        difficulty="hard",
        category="test",
        instruction="Restore the canvas framing.",
        initial_svg='<svg viewBox="0 0 80 80" />',
        target_svg='<svg viewBox="0 0 100 100" />',
        parts=["__svg"],
        target_parts=["__svg"],
        expected_diff=[{
            "part": "__svg",
            "attribute": "viewBox",
            "before": [0, 0, 80, 80],
            "after": [0, 0, 100, 100],
        }],
    )
    report = diff_report(task, '<svg viewBox="not-a-viewbox" />')
    assert report.reward == 0
    assert not report.validity_pass
    assert not report.repair_pass
