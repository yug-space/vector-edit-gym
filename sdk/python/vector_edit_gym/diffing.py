"""Human-readable diff tooling for scored SVG outputs."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from typing import Any

from .metrics import exact_match, preservation_score, structural_match
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
    exact: bool
    structural: bool
    preservation: float
    produced_parse_ok: bool
    target_parse_ok: bool
    expected_changes: list[ExpectedChangeCheck] = field(default_factory=list)
    preserve_checks: list[PreserveCheck] = field(default_factory=list)
    unexpected_changed_parts: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def diff_report(task: Task, produced_svg: str) -> DiffReport:
    """Score one produced SVG and explain expected/preserved part status."""
    produced_root = _parse(produced_svg)
    target_root = _parse(task.target_svg)
    expected_parts = {d.get("part") for d in task.expected_diff}

    expected_checks = [
        ExpectedChangeCheck(
            part=str(d.get("part")),
            attribute=str(d.get("attribute")),
            expected_before=d.get("before"),
            expected_after=d.get("after"),
            produced=_part_attr_value(produced_root, str(d.get("part")), str(d.get("attribute"))),
            passed=_values_equal(
                _part_attr_value(produced_root, str(d.get("part")), str(d.get("attribute"))),
                d.get("after"),
            ),
        )
        for d in task.expected_diff
    ]

    preserve_checks: list[PreserveCheck] = []
    unexpected_changed_parts: list[str] = []
    for part in task.should_preserve:
        target_el = _element_by_id(target_root, part)
        produced_el = _element_by_id(produced_root, part)
        passed = (
            target_el is not None
            and produced_el is not None
            and _tree_eq(target_el, produced_el)
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
        target_el = _element_by_id(target_root, part)
        produced_el = _element_by_id(produced_root, part)
        if target_el is None and produced_el is None:
            continue
        if target_el is None or produced_el is None or not _tree_eq(target_el, produced_el):
            unexpected_changed_parts.append(part)

    return DiffReport(
        task_id=task.task_id,
        exact=exact_match(produced_svg, task.target_svg),
        structural=structural_match(produced_svg, task.target_svg),
        preservation=preservation_score(produced_svg, task.target_svg, task.should_preserve),
        produced_parse_ok=produced_root is not None,
        target_parse_ok=target_root is not None,
        expected_changes=expected_checks,
        preserve_checks=preserve_checks,
        unexpected_changed_parts=sorted(set(unexpected_changed_parts)),
    )


def _parse(svg: str) -> ET.Element | None:
    try:
        return ET.fromstring(svg)
    except ET.ParseError:
        return None


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _norm_attrs(attrs: dict[str, str]) -> dict[str, str]:
    out = {}
    for key, value in attrs.items():
        key = key.split("}", 1)[-1] if "}" in key else key
        out[key] = re.sub(r"\s+", " ", value.strip())
    return out


def _tree_eq(a: ET.Element, b: ET.Element) -> bool:
    if _strip_ns(a.tag) != _strip_ns(b.tag):
        return False
    if _norm_attrs(a.attrib) != _norm_attrs(b.attrib):
        return False
    a_children = list(a)
    b_children = list(b)
    if len(a_children) != len(b_children):
        return False
    return all(_tree_eq(x, y) for x, y in zip(a_children, b_children))


def _element_by_id(root: ET.Element | None, part: str) -> ET.Element | None:
    if root is None:
        return None
    if part == "__svg":
        return root
    for el in root.iter():
        if el.attrib.get("id") == part:
            return el
    return None


def _part_attr_value(root: ET.Element | None, part: str, attr: str) -> Any:
    el = _element_by_id(root, part)
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


def _values_equal(actual: Any, expected: Any) -> bool:
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
        return all(_values_equal(a, e) for a, e in zip(actual, expected))
    return str(actual).strip() == str(expected).strip()
