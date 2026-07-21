"""Human-readable diff tooling for scored SVG outputs."""

from __future__ import annotations

import copy
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from typing import Any

from .metrics import (
    element_by_id,
    exact_match,
    normalize_attribute,
    normalized_attributes,
    parse_svg,
    preservation_score,
    strip_namespace,
    structural_match,
    trees_equal,
    valid_svg_tree,
)
from .tasks import Task
from .tolerance import ValueMatch, compare_expected_value, compare_visual_attribute, viewport_from_root


@dataclass
class ExpectedChangeCheck:
    part: str
    attribute: str
    expected_before: Any
    expected_after: Any
    produced: Any
    passed: bool
    comparison: str
    distance: float | None = None
    tolerance: float | None = None
    unit: str | None = None
    detail: str | None = None


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
    specification_pass: bool
    repair_pass: bool
    preservation_pass: bool
    validity_pass: bool
    exact: bool
    structural: bool
    preservation: float
    edit_completion: float
    unintended_change_rate: float
    produced_parse_ok: bool
    produced_valid_svg: bool
    target_parse_ok: bool
    target_valid_svg: bool
    expected_changes: list[ExpectedChangeCheck] = field(default_factory=list)
    preserve_checks: list[PreserveCheck] = field(default_factory=list)
    unexpected_changed_parts: list[str] = field(default_factory=list)
    failure_reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def outcome_status(report: DiffReport | dict[str, Any]) -> str:
    """Map a diff report to a compact, user-facing outcome label."""
    value = report.to_dict() if isinstance(report, DiffReport) else report
    if value.get("specification_pass") or value.get("reward"):
        return "PASS"
    if not value.get("validity_pass", value.get("produced_parse_ok", False)):
        return "INVALID"
    if value.get("repair_pass") and not value.get("preservation_pass"):
        return "SIDE_EFFECTS"
    if float(value.get("edit_completion") or 0) > 0:
        return "PARTIAL"
    return "FAIL"


def diff_report(task: Task, produced_svg: str) -> DiffReport:
    """Score one produced SVG and explain expected/preserved part status."""
    produced_root = parse_svg(produced_svg)
    target_root = parse_svg(task.target_svg)
    viewport = viewport_from_root(target_root)
    produced_valid = valid_svg_tree(produced_root)
    target_valid = valid_svg_tree(target_root)

    expected_checks = []
    for expected in task.expected_diff:
        part = str(expected.get("part"))
        attribute = str(expected.get("attribute"))
        produced_value = _part_attr_value(produced_root, part, attribute)
        match = compare_expected_value(
            produced_value,
            expected.get("before"),
            expected.get("after"),
            attribute,
            viewport,
        )
        if attribute == "exists" and expected.get("after") is True and match.passed:
            match = _requested_addition_match(produced_root, target_root, part, viewport)
        expected_checks.append(
            ExpectedChangeCheck(
                part=part,
                attribute=attribute,
                expected_before=expected.get("before"),
                expected_after=expected.get("after"),
                produced=produced_value,
                passed=produced_valid and match.passed,
                comparison=match.comparison,
                distance=match.distance,
                tolerance=match.tolerance,
                unit=match.unit,
                detail=match.detail,
            )
        )

    preserve_checks: list[PreserveCheck] = []
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
    structural = structural_match(produced_svg, task.target_svg)
    expected_passed = sum(1 for check in expected_checks if check.passed)
    edit_completion = expected_passed / len(expected_checks) if expected_checks else 1.0
    preserve_failures = sum(1 for check in preserve_checks if not check.passed)
    unintended_change_rate = preserve_failures / len(preserve_checks) if preserve_checks else 0.0
    masked_produced, masked_target = _mask_requested_changes(
        produced_root,
        target_root,
        task.expected_diff,
    )
    preservation_pass = (
        produced_valid
        and target_valid
        and masked_produced is not None
        and masked_target is not None
        and trees_equal(masked_produced, masked_target)
    )
    unexpected_changed_parts = _tree_differences(masked_produced, masked_target)
    unexpected_changed_parts.extend(check.part for check in preserve_checks if not check.passed)
    repair_pass = produced_valid and bool(expected_checks) and expected_passed == len(expected_checks)
    if not expected_checks:
        repair_pass = produced_valid
    specification_pass = produced_valid and repair_pass and preservation_pass
    failure_reasons = []
    if not produced_valid:
        failure_reasons.append("invalid_svg")
    if not repair_pass:
        failure_reasons.append("requested_repairs_incomplete")
    if not preservation_pass:
        failure_reasons.append("unintended_document_changes")

    return DiffReport(
        task_id=task.task_id,
        reward=int(specification_pass),
        specification_pass=specification_pass,
        repair_pass=repair_pass,
        preservation_pass=preservation_pass,
        validity_pass=produced_valid,
        exact=exact_match(produced_svg, task.target_svg),
        structural=structural,
        preservation=preservation_score(produced_svg, task.target_svg, task.should_preserve),
        edit_completion=edit_completion,
        unintended_change_rate=unintended_change_rate,
        produced_parse_ok=produced_root is not None,
        produced_valid_svg=produced_valid,
        target_parse_ok=target_root is not None,
        target_valid_svg=target_valid,
        expected_changes=expected_checks,
        preserve_checks=preserve_checks,
        unexpected_changed_parts=sorted(set(unexpected_changed_parts)),
        failure_reasons=failure_reasons,
    )


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
    style_value = _style_value(el.attrib.get("style", ""), attr)
    if style_value is not None:
        return _maybe_number(style_value)
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
    try:
        return [float(x) for x in re.split(r"[\s,]+", value.strip()) if x]
    except ValueError:
        return None


def _points_list(value: str | None) -> list[list[float]] | None:
    if value is None:
        return None
    points: list[list[float]] = []
    try:
        for pair in value.split():
            coords = [float(x) for x in pair.split(",") if x]
            if coords:
                points.append(coords)
    except ValueError:
        return None
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


def _requested_addition_match(
    produced_root: ET.Element | None,
    target_root: ET.Element | None,
    part: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    produced = element_by_id(produced_root, part)
    target = element_by_id(target_root, part)
    if produced is None or target is None:
        return ValueMatch(False, "inserted-subtree", detail="requested element is missing")
    passed, maximum_ratio, detail = _visual_subtrees_match(produced, target, viewport)
    return ValueMatch(
        passed=passed,
        comparison="inserted-subtree",
        distance=round(maximum_ratio, 6) if maximum_ratio is not None else None,
        tolerance=1.0 if maximum_ratio is not None else None,
        unit="normalized tolerance" if maximum_ratio is not None else None,
        detail=detail,
    )


def _visual_subtrees_match(
    produced: ET.Element,
    target: ET.Element,
    viewport: tuple[float, float],
) -> tuple[bool, float | None, str | None]:
    if produced.tag != target.tag:
        return (False, None, "inserted element type differs")
    if set(produced.attrib) != set(target.attrib):
        return (False, None, "inserted element attributes differ")
    maximum_ratio = 0.0
    for attribute, expected in target.attrib.items():
        actual = produced.attrib[attribute]
        if normalize_attribute(attribute, actual) == normalize_attribute(attribute, expected):
            continue
        match = compare_visual_attribute(actual, expected, strip_namespace(attribute), viewport)
        if not match.passed:
            return (False, None, f"inserted element {strip_namespace(attribute)} is outside tolerance")
        if match.distance is not None and match.tolerance:
            maximum_ratio = max(maximum_ratio, match.distance / match.tolerance)
    if _normalized_text(produced.text) != _normalized_text(target.text):
        return (False, None, "inserted element text differs")
    produced_children = list(produced)
    target_children = list(target)
    if len(produced_children) != len(target_children):
        return (False, None, "inserted element child count differs")
    for produced_child, target_child in zip(produced_children, target_children):
        passed, ratio, detail = _visual_subtrees_match(produced_child, target_child, viewport)
        if not passed:
            return (False, None, detail)
        if ratio is not None:
            maximum_ratio = max(maximum_ratio, ratio)
    return (True, maximum_ratio, "inserted element is within visual tolerances")


def _mask_requested_changes(
    produced_root: ET.Element | None,
    target_root: ET.Element | None,
    expected_diff: list[dict[str, Any]],
) -> tuple[ET.Element | None, ET.Element | None]:
    if produced_root is None or target_root is None:
        return (produced_root, target_root)
    produced = copy.deepcopy(produced_root)
    target = copy.deepcopy(target_root)
    for expected in expected_diff:
        part = str(expected.get("part"))
        attribute = str(expected.get("attribute"))
        if attribute == "exists":
            _remove_element_by_id(produced, part)
            _remove_element_by_id(target, part)
            continue
        produced_element = element_by_id(produced, part)
        target_element = element_by_id(target, part)
        if produced_element is None or target_element is None:
            continue
        _mask_attribute(produced_element, target_element, attribute)
    return (produced, target)


def _remove_element_by_id(root: ET.Element, part: str) -> None:
    if root.attrib.get("id") == part:
        root.clear()
        return
    for parent in root.iter():
        for child in list(parent):
            if child.attrib.get("id") == part:
                parent.remove(child)
                return


def _mask_attribute(produced: ET.Element, target: ET.Element, attribute: str) -> None:
    storage = "transform" if attribute == "size" else attribute
    candidates = {storage, _camel_case(storage)}
    target_key = next((key for key in candidates if key in target.attrib), None)
    for key in candidates:
        produced.attrib.pop(key, None)
    _remove_style_value(produced, storage)
    if target_key is not None:
        produced.attrib[target_key] = target.attrib[target_key]
        return
    target_style = _style_value(target.attrib.get("style", ""), storage)
    if target_style is not None:
        _set_style_value(produced, storage, target_style)


def _remove_style_value(element: ET.Element, key: str) -> None:
    declarations = _style_declarations(element.attrib.get("style", ""))
    if key not in declarations:
        return
    declarations.pop(key)
    if declarations:
        element.attrib["style"] = ";".join(f"{name}:{value}" for name, value in sorted(declarations.items()))
    else:
        element.attrib.pop("style", None)


def _set_style_value(element: ET.Element, key: str, value: str) -> None:
    declarations = _style_declarations(element.attrib.get("style", ""))
    declarations[key] = value
    element.attrib["style"] = ";".join(f"{name}:{raw}" for name, raw in sorted(declarations.items()))


def _style_declarations(style: str) -> dict[str, str]:
    declarations: dict[str, str] = {}
    for chunk in style.split(";"):
        if ":" not in chunk:
            continue
        name, value = chunk.split(":", 1)
        declarations[name.strip()] = value.strip()
    return declarations


def _tree_differences(
    produced: ET.Element | None,
    target: ET.Element | None,
    fallback: str = "__document__",
) -> list[str]:
    if produced is None or target is None:
        return [fallback]
    label = target.attrib.get("id") or produced.attrib.get("id") or (
        "__svg" if strip_namespace(target.tag) == "svg" else fallback
    )
    differences: list[str] = []
    if produced.tag != target.tag:
        return [label]
    if normalized_attributes(produced.attrib) != normalized_attributes(target.attrib):
        differences.append(label)
    if _normalized_text(produced.text) != _normalized_text(target.text):
        differences.append(label)
    if _normalized_text(produced.tail) != _normalized_text(target.tail):
        differences.append(label)

    produced_children = list(produced)
    target_children = list(target)
    produced_keys = [_child_key(child) for child in produced_children]
    target_keys = [_child_key(child) for child in target_children]
    if produced_keys != target_keys:
        produced_ids = {child.attrib["id"] for child in produced_children if "id" in child.attrib}
        target_ids = {child.attrib["id"] for child in target_children if "id" in child.attrib}
        differences.extend(f"+{part}" for part in sorted(produced_ids - target_ids))
        differences.extend(f"-{part}" for part in sorted(target_ids - produced_ids))
        if not differences or produced_ids == target_ids:
            differences.append(f"order:{label}")
        return differences

    for index, (produced_child, target_child) in enumerate(zip(produced_children, target_children)):
        child_fallback = f"{label}/{strip_namespace(target_child.tag)}[{index}]"
        differences.extend(_tree_differences(produced_child, target_child, child_fallback))
    return differences


def _child_key(element: ET.Element) -> tuple[str, str]:
    return (strip_namespace(element.tag), element.attrib.get("id", ""))


def _camel_case(attribute: str) -> str:
    chunks = attribute.split("-")
    return "".join([chunks[0], *[chunk.title() for chunk in chunks[1:]]])


def _normalized_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())
