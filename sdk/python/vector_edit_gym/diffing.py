"""Human-readable diff tooling for scored SVG outputs."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from typing import Any

from .metrics import (
    binary_reward,
    element_by_id,
    exact_match,
    normalize_attribute,
    parse_svg,
    preservation_score,
    structural_match,
    trees_equal,
)
from .tasks import Task


@dataclass
class ExpectedChangeCheck:
    part: str
    attribute: str
    expected_before: Any
    expected_after: Any
    produced: Any
    passed: bool


@dataclass
class PreserveCheck:
    part: str
    passed: bool
    target_present: bool
    produced_present: bool


@dataclass
class DiffReport:
    task_id: str
    reward: int
    exact: bool
    structural: bool
    preservation: float
    edit_completion: float
    unintended_change_rate: float
    produced_parse_ok: bool
    target_parse_ok: bool
    expected_changes: list[ExpectedChangeCheck] = field(default_factory=list)
    preserve_checks: list[PreserveCheck] = field(default_factory=list)
    unexpected_changed_parts: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def diff_report(task: Task, produced_svg: str) -> DiffReport:
    """Score one produced SVG and explain expected/preserved part status."""
    produced_root = parse_svg(produced_svg)
    target_root = parse_svg(task.target_svg)
    expected_parts = {d.get("part") for d in task.expected_diff}

    expected_checks = []
    for expected in task.expected_diff:
        part = str(expected.get("part"))
        attribute = str(expected.get("attribute"))
        produced_value = _part_attr_value(produced_root, part, attribute)
        expected_checks.append(
            ExpectedChangeCheck(
                part=part,
                attribute=attribute,
                expected_before=expected.get("before"),
                expected_after=expected.get("after"),
                produced=produced_value,
                passed=(
                    produced_root is not None
                    and _values_equal(produced_value, expected.get("after"), attribute)
                ),
            )
        )

    preserve_checks: list[PreserveCheck] = []
    unexpected_changed_parts: list[str] = []
    for part in task.should_preserve:
        target_el = element_by_id(target_root, part)
        produced_el = element_by_id(produced_root, part)
        passed = (
            target_el is not None
            and produced_el is not None
            and trees_equal(target_el, produced_el)
        )
        preserve_checks.append(
            PreserveCheck(
                part=part,
                passed=passed,
                target_present=target_el is not None,
                produced_present=produced_el is not None,
            )
        )
        if not passed:
            unexpected_changed_parts.append(part)

    # Also catch known task parts that were not explicitly listed in
    # should_preserve but are not expected to change.
    for part in task.parts:
        if part in expected_parts or part in task.should_preserve or part == "__svg":
            continue
        target_el = element_by_id(target_root, part)
        produced_el = element_by_id(produced_root, part)
        if target_el is None and produced_el is None:
            continue
        if target_el is None or produced_el is None or not trees_equal(target_el, produced_el):
            unexpected_changed_parts.append(part)

    target_ids = _ids(target_root)
    produced_ids = _ids(produced_root)
    unexpected_changed_parts.extend(f"+{part}" for part in produced_ids - target_ids - expected_parts)

    structural = structural_match(produced_svg, task.target_svg)
    expected_passed = sum(1 for check in expected_checks if check.passed)
    edit_completion = expected_passed / len(expected_checks) if expected_checks else 1.0
    preserve_failures = sum(1 for check in preserve_checks if not check.passed)
    unintended_change_rate = preserve_failures / len(preserve_checks) if preserve_checks else 0.0

    # A mismatch with all named checks passing means an anonymous node, root
    # attribute, ordering, or other document-level detail changed.
    if (
        not structural
        and edit_completion == 1.0
        and preserve_failures == 0
        and not unexpected_changed_parts
    ):
        unexpected_changed_parts.append("__document__")

    return DiffReport(
        task_id=task.task_id,
        reward=binary_reward(produced_svg, task.target_svg),
        exact=exact_match(produced_svg, task.target_svg),
        structural=structural,
        preservation=preservation_score(produced_svg, task.target_svg, task.should_preserve),
        edit_completion=edit_completion,
        unintended_change_rate=unintended_change_rate,
        produced_parse_ok=produced_root is not None,
        target_parse_ok=target_root is not None,
        expected_changes=expected_checks,
        preserve_checks=preserve_checks,
        unexpected_changed_parts=sorted(set(unexpected_changed_parts)),
    )


def _ids(root: ET.Element | None) -> set[str]:
    if root is None:
        return set()
    return {element.attrib["id"] for element in root.iter() if "id" in element.attrib}


def _part_attr_value(root: ET.Element | None, part: str, attr: str) -> Any:
    el = element_by_id(root, part)
    if attr == "exists":
        return el is not None
    if el is None:
        return None
    if attr == "viewBox":
        return _number_list(el.attrib.get("viewBox"))
    if attr == "size":
        return _size_from_transform(el.attrib.get("transform"))
    if attr in {"x", "y"} and attr not in el.attrib:
        translate = _translate_from_transform(el.attrib.get("transform"))
        if translate is not None:
            return translate[0 if attr == "x" else 1]
    if attr == "points":
        return _points_list(el.attrib.get("points"))
    if attr == "color":
        style_color = _style_value(el.attrib.get("style", ""), "color")
        if style_color is not None:
            return style_color
    if attr in el.attrib:
        return _maybe_number(el.attrib[attr])
    camel = "".join([attr.split("-")[0], *[s.title() for s in attr.split("-")[1:]]])
    if camel in el.attrib:
        return _maybe_number(el.attrib[camel])
    return None


def _style_value(style: str, key: str) -> str | None:
    for chunk in style.split(";"):
        if ":" not in chunk:
            continue
        name, value = chunk.split(":", 1)
        if name.strip() == key:
            return value.strip()
    return None


def _size_from_transform(transform: str | None) -> float | None:
    if not transform:
        return None
    m = re.search(r"scale\(([-+]?[0-9]*\.?[0-9]+)\)", transform)
    if not m:
        return None
    return round(float(m.group(1)) * 24, 4)


def _translate_from_transform(transform: str | None) -> tuple[float, float] | None:
    if not transform:
        return None
    m = re.search(
        r"translate\(\s*([-+]?[0-9]*\.?[0-9]+)(?:[\s,]+([-+]?[0-9]*\.?[0-9]+))?\s*\)",
        transform,
    )
    if not m:
        return None
    x = float(m.group(1))
    y = float(m.group(2)) if m.group(2) is not None else 0.0
    return (int(x) if x.is_integer() else x, int(y) if y.is_integer() else y)


def _number_list(value: str | None) -> list[float] | None:
    if value is None:
        return None
    return [float(x) for x in re.split(r"[\s,]+", value.strip()) if x]


def _points_list(value: str | None) -> list[list[float]] | None:
    if value is None:
        return None
    points: list[list[float]] = []
    for pair in value.split():
        coords = [float(x) for x in pair.split(",") if x]
        if coords:
            points.append(coords)
    return points


def _maybe_number(value: str) -> Any:
    text = re.sub(r"\s+", " ", value.strip())
    try:
        number = float(text)
    except ValueError:
        return text
    if number.is_integer():
        return int(number)
    return number


def _values_equal(actual: Any, expected: Any, attribute: str = "") -> bool:
    if isinstance(expected, bool):
        return actual is expected
    if isinstance(expected, (int, float)):
        try:
            return abs(float(actual) - float(expected)) < 0.01
        except (TypeError, ValueError):
            return False
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return False
        return all(_values_equal(a, e, attribute) for a, e in zip(actual, expected))
    if actual is None:
        return expected is None
    return normalize_attribute(attribute, str(actual)) == normalize_attribute(attribute, str(expected))
