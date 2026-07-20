"""Deterministic metrics for VectorEditGym SVG repairs."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import Optional


_NUMBER = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
_NUMBER_RE = re.compile(f"^{_NUMBER}$")
_NUMBER_TOKEN_RE = re.compile(_NUMBER)
_PATH_TOKEN_RE = re.compile(f"{_NUMBER}|[AaCcHhLlMmQqSsTtVvZz]")
_TRANSFORM_RE = re.compile(r"([A-Za-z]+)\s*\(([^()]*)\)")
_TRANSFORM_ARITY = {
    "matrix": {6},
    "rotate": {1, 3},
    "scale": {1, 2},
    "skewX": {1},
    "skewY": {1},
    "translate": {1, 2},
}
_INVALID_PREFIX = "__invalid_svg_syntax__:"
_COLOR_ATTRS = {"color", "fill", "flood-color", "lighting-color", "stop-color", "stroke"}
_BASIC_COLORS = {
    "aqua": "#00ffff",
    "black": "#000000",
    "blue": "#0000ff",
    "fuchsia": "#ff00ff",
    "gray": "#808080",
    "green": "#008000",
    "grey": "#808080",
    "lime": "#00ff00",
    "maroon": "#800000",
    "navy": "#000080",
    "olive": "#808000",
    "orange": "#ffa500",
    "purple": "#800080",
    "red": "#ff0000",
    "silver": "#c0c0c0",
    "teal": "#008080",
    "white": "#ffffff",
    "yellow": "#ffff00",
}


def normalize(svg: str) -> str:
    """Collapse formatting-only whitespace for the strict string diagnostic."""
    return re.sub(r"\s+", " ", svg.strip())


def exact_match(produced: str, target: str) -> bool:
    """Return whether source strings match after whitespace normalization."""
    return normalize(produced) == normalize(target)


def parse_svg(svg: str) -> Optional[ET.Element]:
    """Parse an SVG string, returning ``None`` for malformed XML."""
    try:
        return ET.fromstring(svg)
    except ET.ParseError:
        return None


def strip_namespace(name: str) -> str:
    return name.split("}", 1)[-1] if "}" in name else name


def normalize_color(value: str) -> str:
    """Canonicalize common equivalent CSS color spellings."""
    value = value.strip().lower()
    if value in _BASIC_COLORS:
        return _BASIC_COLORS[value]
    if re.fullmatch(r"#[0-9a-f]{3}", value):
        return "#" + "".join(char * 2 for char in value[1:])
    if re.fullmatch(r"#[0-9a-f]{6}", value):
        return value
    rgb = re.fullmatch(
        r"rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)",
        value,
    )
    if rgb and all(0 <= int(component) <= 255 for component in rgb.groups()):
        return "#" + "".join(f"{int(component):02x}" for component in rgb.groups())
    return value


def normalize_number(value: str) -> str:
    number = Decimal(value)
    if number == 0:
        return "0"
    normalized = format(number.normalize(), "f")
    if "." in normalized:
        normalized = normalized.rstrip("0").rstrip(".")
    return normalized


def normalize_attribute(name: str, value: str) -> str:
    """Canonicalize formatting while preserving SVG semantics."""
    name = strip_namespace(name)
    value = re.sub(r"\s+", " ", value.strip())
    if name == "style":
        declarations = []
        for chunk in (part.strip() for part in value.split(";")):
            if not chunk:
                continue
            if ":" not in chunk:
                return _INVALID_PREFIX + value
            key, raw = chunk.split(":", 1)
            key = key.strip().lower()
            if not key or not raw.strip():
                return _INVALID_PREFIX + value
            declarations.append((key, normalize_attribute(key, raw)))
        if len({key for key, _ in declarations}) == len(declarations):
            declarations.sort()
        return ";".join(f"{key}:{normalized}" for key, normalized in declarations)
    if name in _COLOR_ATTRS and not value.lower().startswith("url("):
        return normalize_color(value)
    if _NUMBER_RE.fullmatch(value):
        return normalize_number(value)
    if name == "d":
        normalized = _normalize_token_stream(value, _PATH_TOKEN_RE, commands=True)
        return normalized if normalized is not None else _INVALID_PREFIX + value
    if name in {"points", "viewBox"}:
        normalized = _normalize_token_stream(value, _NUMBER_TOKEN_RE)
        return normalized if normalized is not None else _INVALID_PREFIX + value
    if name == "transform":
        normalized = _normalize_transform(value)
        return normalized if normalized is not None else _INVALID_PREFIX + value
    numeric_list = _normalize_token_stream(value, _NUMBER_TOKEN_RE)
    if numeric_list is not None and numeric_list:
        return numeric_list
    return value


def normalized_attributes(attrs: dict[str, str]) -> dict[str, str]:
    return {
        key: normalize_attribute(strip_namespace(key), value)
        for key, value in attrs.items()
    }


def trees_equal(a: ET.Element, b: ET.Element) -> bool:
    """Compare parsed SVG subtrees after representation-only normalization."""
    if a.tag != b.tag:
        return False
    if normalized_attributes(a.attrib) != normalized_attributes(b.attrib):
        return False
    if _normalized_text(a.text) != _normalized_text(b.text):
        return False
    if _normalized_text(a.tail) != _normalized_text(b.tail):
        return False
    a_children = list(a)
    b_children = list(b)
    if len(a_children) != len(b_children):
        return False
    return all(trees_equal(left, right) for left, right in zip(a_children, b_children))


def structural_match(produced: str, target: str) -> bool:
    """Return whether both SVG programs have the same canonical element tree."""
    produced_root = parse_svg(produced)
    target_root = parse_svg(target)
    if produced_root is None or target_root is None:
        return False
    return trees_equal(produced_root, target_root)


def element_by_id(root: ET.Element | None, part_id: str) -> Optional[ET.Element]:
    if root is None:
        return None
    if part_id == "__svg":
        return root
    for element in root.iter():
        if element.attrib.get("id") == part_id:
            return element
    return None


def preservation_score(produced: str, target: str, should_preserve: list[str]) -> float:
    """Fraction of protected object subtrees preserved in the produced SVG."""
    if not should_preserve:
        return 1.0
    produced_root = parse_svg(produced)
    target_root = parse_svg(target)
    if produced_root is None or target_root is None:
        return 0.0
    hits = 0
    for part_id in should_preserve:
        produced_element = element_by_id(produced_root, part_id)
        target_element = element_by_id(target_root, part_id)
        if (
            produced_element is not None
            and target_element is not None
            and trees_equal(produced_element, target_element)
        ):
            hits += 1
    return hits / len(should_preserve)


def binary_reward(produced: str, target: str) -> int:
    """One iff the output is valid and canonically equivalent to the target."""
    return int(structural_match(produced, target))


def _normalized_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_token_stream(
    value: str,
    token_re: re.Pattern[str],
    *,
    commands: bool = False,
) -> str | None:
    if not value.strip():
        return ""
    tokens: list[str] = []
    position = 0
    previous_was_number = False
    for match in token_re.finditer(value):
        separator = value[position:match.start()]
        token = match.group(0)
        current_is_number = bool(_NUMBER_RE.fullmatch(token))
        if not re.fullmatch(r"[\s,]*", separator):
            return None
        if (
            not separator
            and previous_was_number
            and current_is_number
            and not token.startswith(("+", "-"))
        ):
            return None
        if not current_is_number and not commands:
            return None
        tokens.append(normalize_number(token) if current_is_number else token)
        previous_was_number = current_is_number
        position = match.end()
    if not tokens or not re.fullmatch(r"[\s,]*", value[position:]):
        return None
    return " ".join(tokens)


def _normalize_transform(value: str) -> str | None:
    if not value.strip():
        return ""
    functions: list[str] = []
    position = 0
    for match in _TRANSFORM_RE.finditer(value):
        if not re.fullmatch(r"[\s,]*", value[position:match.start()]):
            return None
        name = match.group(1)
        normalized_args = _normalize_token_stream(match.group(2), _NUMBER_TOKEN_RE)
        if normalized_args is None:
            return None
        args = normalized_args.split() if normalized_args else []
        if name not in _TRANSFORM_ARITY or len(args) not in _TRANSFORM_ARITY[name]:
            return None
        functions.append(f"{name}({' '.join(args)})")
        position = match.end()
    if not functions or not re.fullmatch(r"[\s,]*", value[position:]):
        return None
    return " ".join(functions)
