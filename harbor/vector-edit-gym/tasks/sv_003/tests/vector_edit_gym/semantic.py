"""Rendering-relevant SVG tree comparison and element alignment."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from .metrics import element_by_id, normalize_attribute, strip_namespace


_URL_REFERENCE_RE = re.compile(r"url\(\s*#([^\s)]+)\s*\)", re.IGNORECASE)
_DIRECT_REFERENCE_ATTRIBUTES = {"href"}


def corresponding_element(
    produced_root: ET.Element | None,
    reference_root: ET.Element | None,
    part_id: str,
) -> ET.Element | None:
    """Find an element by ID, then by its stable position in a reference tree."""
    direct = element_by_id(produced_root, part_id)
    if direct is not None or produced_root is None or reference_root is None:
        return direct
    reference = element_by_id(reference_root, part_id)
    if reference is None:
        return None
    path = element_path(reference_root, reference)
    candidate = element_at_path(produced_root, path)
    if candidate is None or candidate.tag != reference.tag:
        return None
    return candidate


def element_path(root: ET.Element, needle: ET.Element) -> tuple[int, ...] | None:
    """Return a child-index path from ``root`` to ``needle``."""
    if root is needle:
        return ()
    for index, child in enumerate(root):
        child_path = element_path(child, needle)
        if child_path is not None:
            return (index, *child_path)
    return None


def element_at_path(root: ET.Element, path: tuple[int, ...] | None) -> ET.Element | None:
    if path is None:
        return None
    current = root
    for index in path:
        children = list(current)
        if index >= len(children):
            return None
        current = children[index]
    return current


def semantic_trees_equal(produced: ET.Element, target: ET.Element) -> bool:
    """Compare rendering-relevant structure while allowing harmless ID rewrites."""
    produced_aliases, target_aliases = aligned_id_aliases(produced, target)
    return _semantic_trees_equal(produced, target, produced_aliases, target_aliases)


def semantic_tree_differences(
    produced: ET.Element | None,
    target: ET.Element | None,
    fallback: str = "__document__",
) -> list[str]:
    """Return concise labels for rendering-relevant tree differences."""
    if produced is None or target is None:
        return [fallback]
    produced_aliases, target_aliases = aligned_id_aliases(produced, target)
    return _semantic_tree_differences(
        produced,
        target,
        produced_aliases,
        target_aliases,
        fallback,
    )


def aligned_id_aliases(
    produced: ET.Element,
    target: ET.Element,
) -> tuple[dict[str, str], dict[str, str]]:
    """Map consistently renamed IDs in positionally aligned trees to one token."""
    produced_aliases: dict[str, str] = {}
    target_aliases: dict[str, str] = {}

    def walk(left: ET.Element, right: ET.Element, path: tuple[int, ...]) -> None:
        if left.tag != right.tag:
            return
        canonical = "@" + "/".join(str(index) for index in path)
        left_id = left.attrib.get("id")
        right_id = right.attrib.get("id")
        if left_id:
            produced_aliases[left_id] = canonical
        if right_id:
            target_aliases[right_id] = canonical
        for index, (left_child, right_child) in enumerate(zip(left, right)):
            walk(left_child, right_child, (*path, index))

    walk(produced, target, ())
    return produced_aliases, target_aliases


def semantic_attributes(
    element: ET.Element,
    id_aliases: dict[str, str],
) -> dict[str, str]:
    """Canonicalize attributes that can affect rendering or SVG behavior."""
    attributes: dict[str, str] = {}
    for raw_name, raw_value in element.attrib.items():
        name = strip_namespace(raw_name)
        # Keep data-* attributes: applications may use them in selectors or
        # rendering scripts. Accessibility metadata is non-rendering here.
        if name == "id" or name.startswith("aria-"):
            continue
        if name == "style":
            continue
        attributes[name] = _normalize_reference_value(
            name,
            normalize_attribute(name, raw_value),
            id_aliases,
        )

    style = _style_declarations(element.attrib.get("style", ""))
    if style is None:
        attributes["style"] = normalize_attribute("style", element.attrib.get("style", ""))
    else:
        for name, raw_value in style.items():
            attributes[name] = _normalize_reference_value(
                name,
                normalize_attribute(name, raw_value),
                id_aliases,
            )
    return attributes


def _semantic_trees_equal(
    produced: ET.Element,
    target: ET.Element,
    produced_aliases: dict[str, str],
    target_aliases: dict[str, str],
) -> bool:
    if produced.tag != target.tag:
        return False
    if semantic_attributes(produced, produced_aliases) != semantic_attributes(target, target_aliases):
        return False
    if _semantic_text(produced, produced_aliases) != _semantic_text(target, target_aliases):
        return False
    if _normalized_text(produced.tail) != _normalized_text(target.tail):
        return False
    produced_children = list(produced)
    target_children = list(target)
    if len(produced_children) != len(target_children):
        return False
    return all(
        _semantic_trees_equal(left, right, produced_aliases, target_aliases)
        for left, right in zip(produced_children, target_children)
    )


def _semantic_tree_differences(
    produced: ET.Element,
    target: ET.Element,
    produced_aliases: dict[str, str],
    target_aliases: dict[str, str],
    fallback: str,
) -> list[str]:
    label = target.attrib.get("id") or produced.attrib.get("id") or (
        "__svg" if strip_namespace(target.tag) == "svg" else fallback
    )
    if produced.tag != target.tag:
        return [label]
    differences: list[str] = []
    if semantic_attributes(produced, produced_aliases) != semantic_attributes(target, target_aliases):
        differences.append(label)
    if _semantic_text(produced, produced_aliases) != _semantic_text(target, target_aliases):
        differences.append(label)
    if _normalized_text(produced.tail) != _normalized_text(target.tail):
        differences.append(label)

    produced_children = list(produced)
    target_children = list(target)
    if len(produced_children) != len(target_children):
        produced_ids = {child.attrib["id"] for child in produced_children if "id" in child.attrib}
        target_ids = {child.attrib["id"] for child in target_children if "id" in child.attrib}
        differences.extend(f"+{part}" for part in sorted(produced_ids - target_ids))
        differences.extend(f"-{part}" for part in sorted(target_ids - produced_ids))
        if not differences:
            differences.append(label)
        return differences

    for index, (produced_child, target_child) in enumerate(zip(produced_children, target_children)):
        child_fallback = f"{label}/{strip_namespace(target_child.tag)}[{index}]"
        differences.extend(
            _semantic_tree_differences(
                produced_child,
                target_child,
                produced_aliases,
                target_aliases,
                child_fallback,
            )
        )
    return differences


def _style_declarations(style: str) -> dict[str, str] | None:
    declarations: dict[str, str] = {}
    for chunk in style.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" not in chunk:
            return None
        name, value = chunk.split(":", 1)
        name = name.strip().lower()
        value = value.strip()
        if not name or not value:
            return None
        declarations[name] = value
    return declarations


def _normalize_reference_value(name: str, value: str, aliases: dict[str, str]) -> str:
    def replace_url(match: re.Match[str]) -> str:
        reference = match.group(1)
        return f"url({aliases.get(reference, '#' + reference)})"

    value = _URL_REFERENCE_RE.sub(replace_url, value)
    if name in _DIRECT_REFERENCE_ATTRIBUTES and value.startswith("#"):
        return aliases.get(value[1:], value)
    return value


def _semantic_text(element: ET.Element, aliases: dict[str, str]) -> str:
    text = _normalized_text(element.text)
    if strip_namespace(element.tag) != "style":
        return text
    for raw_id, canonical in sorted(aliases.items(), key=lambda item: -len(item[0])):
        text = text.replace(f"#{raw_id}", canonical)
    return text


def _normalized_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())
