"""Deterministic tolerance rules for requested SVG repairs."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Iterable

from svg.path import parse_path

from .metrics import normalize_attribute, normalize_color


_NUMBER = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
_NUMBER_RE = re.compile(f"^{_NUMBER}$")
_COLOR_ATTRIBUTES = {
    "color",
    "fill",
    "flood-color",
    "lighting-color",
    "stop-color",
    "stroke",
}
_X_ATTRIBUTES = {"cx", "rx", "width", "x", "x1", "x2"}
_Y_ATTRIBUTES = {"cy", "height", "ry", "y", "y1", "y2"}


@dataclass(frozen=True)
class ValueMatch:
    """Result of one target-value comparison."""

    passed: bool
    comparison: str
    distance: float | None = None
    tolerance: float | None = None
    baseline_distance: float | None = None
    progress: float | None = None
    unit: str | None = None
    detail: str | None = None


def compare_expected_value(
    actual: Any,
    before: Any,
    expected: Any,
    attribute: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    """Compare a produced value with a target under an attribute-aware tolerance."""
    if isinstance(expected, bool):
        passed = actual is expected
        return ValueMatch(
            passed=passed,
            comparison="existence",
            progress=1.0 if passed else 0.0,
            detail="required presence matches" if passed else "required presence differs",
        )

    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return _compare_number(actual, before, float(expected), attribute, viewport)

    if isinstance(expected, list):
        return _compare_numeric_structure(actual, before, expected, attribute, viewport)

    if actual is None:
        return ValueMatch(
            passed=expected is None,
            comparison="exact",
            detail="value is missing",
        )

    if attribute in _COLOR_ATTRIBUTES:
        return _compare_color(str(actual), before, str(expected))

    if attribute == "d":
        return _compare_path(str(actual), before, str(expected), viewport)

    normalized_actual = normalize_attribute(attribute, str(actual))
    normalized_expected = normalize_attribute(attribute, str(expected))
    return ValueMatch(
        passed=normalized_actual == normalized_expected,
        comparison="canonical",
        progress=1.0 if normalized_actual == normalized_expected else 0.0,
        detail="canonical values match" if normalized_actual == normalized_expected else "canonical values differ",
    )


def compare_visual_attribute(
    actual: str,
    expected: str,
    attribute: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    """Compare an attribute on a newly inserted requested element."""
    if attribute == "id":
        return ValueMatch(actual == expected, "identity", progress=1.0 if actual == expected else 0.0)
    if attribute in _COLOR_ATTRIBUTES:
        return _compare_color(actual, None, expected)
    if attribute == "d":
        return _compare_path(actual, None, expected, viewport)
    if attribute == "points":
        actual_points = _number_tokens(actual)
        expected_points = _number_tokens(expected)
        if actual_points is None or expected_points is None:
            return ValueMatch(False, "points-rms", detail="points could not be parsed")
        return _compare_flat_numbers(actual_points, None, expected_points, "points", viewport)
    if _NUMBER_RE.fullmatch(expected.strip()):
        return _compare_number(actual, None, float(expected), attribute, viewport)
    normalized_actual = normalize_attribute(attribute, actual)
    normalized_expected = normalize_attribute(attribute, expected)
    return ValueMatch(
        normalized_actual == normalized_expected,
        "canonical",
        progress=1.0 if normalized_actual == normalized_expected else 0.0,
    )


def viewport_from_root(root: Any) -> tuple[float, float]:
    """Return positive viewport width and height, with a conservative fallback."""
    if root is None:
        return (100.0, 100.0)
    raw = root.attrib.get("viewBox")
    if raw:
        values = _number_tokens(raw)
        if values is not None and len(values) == 4 and values[2] > 0 and values[3] > 0:
            return (values[2], values[3])
    try:
        width = float(root.attrib.get("width", 100))
        height = float(root.attrib.get("height", 100))
    except (TypeError, ValueError):
        return (100.0, 100.0)
    return (max(width, 1.0), max(height, 1.0))


def _compare_number(
    actual: Any,
    before: Any,
    expected: float,
    attribute: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    try:
        actual_number = float(actual)
    except (TypeError, ValueError):
        return ValueMatch(False, _numeric_comparison_name(attribute), detail="produced value is not numeric")

    before_number = _as_float(before)
    mutation = abs(before_number - expected) if before_number is not None else None
    tolerance = _numeric_tolerance(attribute, expected, mutation, viewport)
    distance = abs(actual_number - expected)
    return ValueMatch(
        passed=distance <= tolerance + 1e-9,
        comparison=_numeric_comparison_name(attribute),
        distance=_clean(distance),
        tolerance=_clean(tolerance),
        baseline_distance=_clean(mutation) if mutation is not None else None,
        progress=_repair_progress(distance, mutation),
        unit="user units" if attribute != "opacity" else "absolute opacity",
    )


def _compare_numeric_structure(
    actual: Any,
    before: Any,
    expected: list[Any],
    attribute: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    actual_flat = _flatten_numeric(actual)
    expected_flat = _flatten_numeric(expected)
    before_flat = _flatten_numeric(before)
    if actual_flat is None or expected_flat is None or len(actual_flat) != len(expected_flat):
        return ValueMatch(False, "points-rms" if attribute == "points" else "list-rms", detail="numeric shape differs")
    if before_flat is not None and len(before_flat) != len(expected_flat):
        before_flat = None
    return _compare_flat_numbers(actual_flat, before_flat, expected_flat, attribute, viewport)


def _compare_flat_numbers(
    actual: list[float],
    before: list[float] | None,
    expected: list[float],
    attribute: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    distance = _rms_difference(actual, expected)
    mutation = _rms_difference(before, expected) if before is not None else None
    cap = max(0.75, min(viewport) * 0.03)
    tolerance = _bounded_tolerance(mutation, ratio=0.55, cap=cap, floor=0.75)
    return ValueMatch(
        passed=distance <= tolerance + 1e-9,
        comparison="points-rms" if attribute == "points" else "list-rms",
        distance=_clean(distance),
        tolerance=_clean(tolerance),
        baseline_distance=_clean(mutation) if mutation is not None else None,
        progress=_repair_progress(distance, mutation),
        unit="coordinate RMS",
    )


def _compare_path(
    actual: str,
    before: Any,
    expected: str,
    viewport: tuple[float, float],
) -> ValueMatch:
    distance = _sampled_path_distance(actual, expected)
    mutation = _sampled_path_distance(str(before), expected) if before is not None else None
    if distance is None:
        return ValueMatch(False, "path-shape", detail="path geometry could not be sampled")
    tolerance = _bounded_tolerance(
        mutation,
        ratio=0.70,
        cap=max(0.75, min(viewport) * 0.03),
        floor=0.75,
    )
    if distance > tolerance + 1e-9:
        legacy_match = _matching_topology_path_distance(actual, before, expected, viewport)
        if legacy_match is not None and legacy_match.passed:
            return legacy_match
    return ValueMatch(
        passed=distance <= tolerance + 1e-9,
        comparison="path-shape",
        distance=_clean(distance),
        tolerance=_clean(tolerance),
        baseline_distance=_clean(mutation) if mutation is not None else None,
        progress=_repair_progress(distance, mutation),
        unit="sampled geometry",
        detail="command topology is ignored; rendered path shape is compared",
    )


def _matching_topology_path_distance(
    actual: str,
    before: Any,
    expected: str,
    viewport: tuple[float, float],
) -> ValueMatch | None:
    """Retain coordinate-RMS acceptance when command streams align exactly."""
    actual_path = _path_tokens(actual)
    expected_path = _path_tokens(expected)
    before_path = _path_tokens(str(before)) if before is not None else None
    if actual_path is None or expected_path is None:
        return None
    actual_commands, actual_numbers = actual_path
    expected_commands, expected_numbers = expected_path
    if actual_commands != expected_commands or len(actual_numbers) != len(expected_numbers):
        return None
    before_numbers = None
    if before_path is not None and before_path[0] == expected_commands and len(before_path[1]) == len(expected_numbers):
        before_numbers = before_path[1]
    distance = _rms_difference(actual_numbers, expected_numbers)
    mutation = _rms_difference(before_numbers, expected_numbers) if before_numbers is not None else None
    tolerance = _bounded_tolerance(
        mutation,
        ratio=0.70,
        cap=max(0.5, min(viewport) * 0.025),
        floor=0.5,
    )
    return ValueMatch(
        passed=distance <= tolerance + 1e-9,
        comparison="path-coordinate-rms",
        distance=_clean(distance),
        tolerance=_clean(tolerance),
        baseline_distance=_clean(mutation) if mutation is not None else None,
        progress=_repair_progress(distance, mutation),
        unit="coordinate RMS",
        detail="matching command streams are within coordinate tolerance",
    )


def _compare_color(actual: str, before: Any, expected: str) -> ValueMatch:
    actual_lab = _lab_color(actual)
    expected_lab = _lab_color(expected)
    before_lab = _lab_color(str(before)) if before is not None else None
    if actual_lab is None or expected_lab is None:
        normalized_actual = normalize_color(actual)
        normalized_expected = normalize_color(expected)
        return ValueMatch(
            normalized_actual == normalized_expected,
            "canonical-color",
            detail="unsupported color syntax; canonical comparison used",
        )
    distance = _euclidean(actual_lab, expected_lab)
    mutation = _euclidean(before_lab, expected_lab) if before_lab is not None else None
    tolerance = _bounded_tolerance(mutation, ratio=0.45, cap=18.0, floor=4.0)
    return ValueMatch(
        passed=distance <= tolerance + 1e-9,
        comparison="color-lab",
        distance=_clean(distance),
        tolerance=_clean(tolerance),
        baseline_distance=_clean(mutation) if mutation is not None else None,
        progress=_repair_progress(distance, mutation),
        unit="Delta E76",
    )


def _numeric_tolerance(
    attribute: str,
    expected: float,
    mutation: float | None,
    viewport: tuple[float, float],
) -> float:
    width, height = viewport
    if attribute == "opacity":
        return _bounded_tolerance(mutation, ratio=0.50, cap=0.12, floor=0.03)
    if attribute == "stroke-width":
        return _bounded_tolerance(
            mutation,
            ratio=0.50,
            cap=max(1.0, abs(expected) * 0.40),
            floor=0.25,
        )
    if attribute in _X_ATTRIBUTES:
        cap = max(0.75, width * 0.025)
    elif attribute in _Y_ATTRIBUTES:
        cap = max(0.75, height * 0.025)
    else:
        cap = max(0.75, min(width, height) * 0.02)
    return _bounded_tolerance(mutation, ratio=0.50, cap=cap, floor=0.75)


def _bounded_tolerance(
    mutation: float | None,
    *,
    ratio: float,
    cap: float,
    floor: float,
) -> float:
    if mutation is None:
        return cap
    if mutation <= 0:
        return min(cap, floor)
    # The 90% ceiling guarantees that the known corrupted value cannot pass.
    return min(cap, max(floor, mutation * ratio), mutation * 0.90)


def _numeric_comparison_name(attribute: str) -> str:
    if attribute == "opacity":
        return "opacity-delta"
    if attribute == "stroke-width":
        return "line-weight-delta"
    return "numeric-delta"


def _path_tokens(value: str) -> tuple[tuple[str, ...], list[float]] | None:
    normalized = normalize_attribute("d", value)
    if normalized.startswith("__invalid_svg_syntax__:"):
        return None
    commands: list[str] = []
    numbers: list[float] = []
    for token in normalized.split():
        if _NUMBER_RE.fullmatch(token):
            numbers.append(float(token))
        else:
            commands.append(token)
    return (tuple(commands), numbers)


def _sampled_path_distance(left: str, right: str, samples: int = 129) -> float | None:
    """Approximate visible path distance independently of SVG command topology."""
    left_points = _sample_path(left, samples)
    right_points = _sample_path(right, samples)
    if left_points is None or right_points is None:
        return None

    # Symmetric nearest-point distances handle equivalent paths that use different
    # segment counts, directions, or starting points.
    nearest = [min(abs(point - other) for other in right_points) for point in left_points]
    nearest.extend(min(abs(point - other) for other in left_points) for point in right_points)
    if not nearest:
        return 0.0
    nearest.sort()
    rms = math.sqrt(sum(distance * distance for distance in nearest) / len(nearest))
    percentile_95 = nearest[math.ceil(0.95 * len(nearest)) - 1]
    return max(rms, percentile_95)


@lru_cache(maxsize=4096)
def _sample_path(value: str, samples: int) -> tuple[complex, ...] | None:
    try:
        path = parse_path(value)
        return tuple(path.point(index / (samples - 1)) for index in range(samples))
    except (IndexError, TypeError, ValueError, ZeroDivisionError):
        return None


def _number_tokens(value: str) -> list[float] | None:
    tokens = re.findall(_NUMBER, value)
    remainder = re.sub(_NUMBER, "", value)
    if not tokens or not re.fullmatch(r"[\s,]*", remainder):
        return None
    return [float(token) for token in tokens]


def _flatten_numeric(value: Any) -> list[float] | None:
    if not isinstance(value, list):
        return None
    flattened: list[float] = []
    stack: list[Any] = list(reversed(value))
    while stack:
        item = stack.pop()
        if isinstance(item, list):
            stack.extend(reversed(item))
            continue
        try:
            flattened.append(float(item))
        except (TypeError, ValueError):
            return None
    return flattened


def _rms_difference(left: Iterable[float], right: Iterable[float]) -> float:
    pairs = list(zip(left, right))
    if not pairs:
        return 0.0
    return math.sqrt(sum((a - b) ** 2 for a, b in pairs) / len(pairs))


def _lab_color(value: str) -> tuple[float, float, float] | None:
    normalized = normalize_color(value)
    match = re.fullmatch(r"#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})", normalized)
    if not match:
        return None
    rgb = [int(component, 16) / 255 for component in match.groups()]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in rgb]
    red, green, blue = linear
    x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047
    y = red * 0.2126729 + green * 0.7151522 + blue * 0.0721750
    z = (red * 0.0193339 + green * 0.1191920 + blue * 0.9503041) / 1.08883

    def pivot(component: float) -> float:
        return component ** (1 / 3) if component > 0.008856 else 7.787 * component + 16 / 116

    fx, fy, fz = pivot(x), pivot(y), pivot(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def _euclidean(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean(value: float) -> float:
    return round(value, 6)


def _repair_progress(distance: float, baseline: float | None) -> float | None:
    if baseline is None:
        return 1.0 if distance <= 1e-9 else None
    if baseline <= 1e-9:
        return 1.0 if distance <= 1e-9 else 0.0
    return _clean(max(0.0, min(1.0, 1.0 - distance / baseline)))
