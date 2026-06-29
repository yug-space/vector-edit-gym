#!/usr/bin/env python3
"""Append downloaded scenic SVGs as exact v2 repair tasks."""

from __future__ import annotations

import argparse
import copy
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SVG_NS = "http://www.w3.org/2000/svg"
SHAPE_TAGS = {"rect", "circle", "ellipse", "path", "polygon", "polyline", "line"}
COLOR_ATTRS = {"fill", "stroke", "stop-color"}
WRONG_COLORS = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#111827",
    "#f8fafc",
]

ET.register_namespace("", SVG_NS)


def main() -> int:
    args = parse_args()
    src_dir = args.src_dir
    out_dir = args.out_dir
    if not src_dir.is_dir():
        raise SystemExit(f"missing scenic SVG source directory: {src_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(src_dir.glob("*.svg"))
    if args.limit:
        files = files[: args.limit]
    if len(files) != args.expected_count:
        raise SystemExit(f"expected {args.expected_count} scenic SVGs, found {len(files)} in {src_dir}")

    authored_at = datetime.now(timezone.utc).isoformat()
    for offset, svg_path in enumerate(files, start=0):
        task_id = f"{args.prefix}_{args.start + offset:03d}"
        record = build_task(svg_path, task_id, authored_at, offset)
        (out_dir / f"{task_id}.json").write_text(json.dumps(record, indent=2))

    print(f"imported {len(files)} downloaded scenic SVG tasks to {out_dir}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src-dir", type=Path, default=ROOT / "data" / "scenic_svgs")
    parser.add_argument("--out-dir", type=Path, default=ROOT / "data" / "tasks_v2")
    parser.add_argument("--prefix", default="sv")
    parser.add_argument("--start", type=int, default=21)
    parser.add_argument("--expected-count", type=int, default=20)
    parser.add_argument("--limit", type=int)
    return parser.parse_args()


def build_task(svg_path: Path, task_id: str, authored_at: str, offset: int) -> dict[str, Any]:
    target_root = ET.parse(svg_path).getroot()
    prefix = f"download-{task_id}"
    visible = assign_visible_ids(target_root, prefix)
    if len(visible) < 4:
        raise SystemExit(f"not enough visible SVG elements in {svg_path}")

    target_svg = serialize(target_root)
    initial_root = copy.deepcopy(target_root)

    expected_diff: list[dict[str, Any]] = []
    changed: set[str] = set()

    color_el = choose_color_element(initial_root, offset)
    if color_el is not None:
        attr = "fill" if clean_color(color_el.get("fill")) else "stroke"
        before = color_el.get(attr)
        after = element_by_id(target_root, color_el.get("id")).get(attr)
        wrong = wrong_color(after, offset)
        color_el.set(attr, wrong)
        expected_diff.append({"part": color_el.get("id"), "attribute": attr, "before": wrong, "after": after})
        changed.add(color_el.get("id"))

    numeric_el, attr = choose_numeric_element(initial_root, changed)
    if numeric_el is not None and attr is not None:
        after = parse_number(element_by_id(target_root, numeric_el.get("id")).get(attr))
        wrong = wrong_number(after, attr, offset)
        numeric_el.set(attr, format_number(wrong))
        expected_diff.append({"part": numeric_el.get("id"), "attribute": attr, "before": wrong, "after": after})
        changed.add(numeric_el.get("id"))

    stroke_el = choose_stroke_element(initial_root, changed)
    if stroke_el is not None:
        after = parse_number(element_by_id(target_root, stroke_el.get("id")).get("stroke-width"))
        wrong = wrong_number(after, "stroke-width", offset)
        stroke_el.set("stroke-width", format_number(wrong))
        expected_diff.append({"part": stroke_el.get("id"), "attribute": "stroke-width", "before": wrong, "after": after})
        changed.add(stroke_el.get("id"))

    opacity_el = choose_opacity_element(initial_root, changed)
    if opacity_el is not None:
        after = parse_number(element_by_id(target_root, opacity_el.get("id")).get("opacity"))
        wrong = max(0.1, min(0.95, round(after * 0.45, 2)))
        if abs(wrong - after) < 0.01:
            wrong = 0.35
        opacity_el.set("opacity", format_number(wrong))
        expected_diff.append({"part": opacity_el.get("id"), "attribute": "opacity", "before": wrong, "after": after})
        changed.add(opacity_el.get("id"))

    extra = extra_part(task_id, offset)
    initial_root.append(make_element(extra))
    expected_diff.insert(0, {
        "part": extra["id"],
        "attribute": "exists",
        "before": True,
        "after": False,
        "removed": extra,
    })
    changed.add(extra["id"])

    initial_svg = serialize(initial_root)
    visible_ids = [el.get("id") for el in visible]
    parts = [*visible_ids, extra["id"]]
    should_preserve = [part for part in visible_ids if part not in changed]
    title = title_from_filename(svg_path)
    instruction = instruction_for(title, expected_diff)

    return {
        "task_id": task_id,
        "difficulty": "very_hard",
        "category": "downloaded_scenic_surgical",
        "instruction": instruction,
        "initial_svg": initial_svg,
        "target_svg": target_svg,
        "parts": parts,
        "target_parts": list(dict.fromkeys(d["part"] for d in expected_diff)),
        "expected_diff": expected_diff,
        "should_preserve": should_preserve,
        "prompt_version": "v2",
        "source_svg": str(svg_path.relative_to(ROOT)) if svg_path.is_relative_to(ROOT) else str(svg_path),
        "authored_at": authored_at,
    }


def assign_visible_ids(root: ET.Element, prefix: str) -> list[ET.Element]:
    counters: dict[str, int] = {}
    visible: list[ET.Element] = []

    def walk(el: ET.Element, in_defs: bool = False) -> None:
        tag = strip_ns(el.tag)
        now_in_defs = in_defs or tag == "defs"
        if not now_in_defs and tag in SHAPE_TAGS:
            counters[tag] = counters.get(tag, 0) + 1
            if not el.get("id"):
                el.set("id", f"{prefix}-{tag}-{counters[tag]:03d}")
            visible.append(el)
        for child in list(el):
            walk(child, now_in_defs)

    walk(root)
    return visible


def choose_color_element(root: ET.Element, offset: int) -> ET.Element | None:
    candidates = [
        el for el in visible_shapes(root)
        if clean_color(el.get("fill")) or clean_color(el.get("stroke"))
    ]
    return candidates[offset % len(candidates)] if candidates else None


def choose_numeric_element(root: ET.Element, changed: set[str]) -> tuple[ET.Element | None, str | None]:
    preferred = ["cx", "cy", "x", "y", "r", "rx", "ry"]
    for el in visible_shapes(root):
        if el.get("id") in changed:
            continue
        for attr in preferred:
            if parse_number_or_none(el.get(attr)) is not None:
                return el, attr
    return None, None


def choose_stroke_element(root: ET.Element, changed: set[str]) -> ET.Element | None:
    for el in visible_shapes(root):
        if el.get("id") not in changed and parse_number_or_none(el.get("stroke-width")) is not None:
            return el
    return None


def choose_opacity_element(root: ET.Element, changed: set[str]) -> ET.Element | None:
    for el in visible_shapes(root):
        if el.get("id") not in changed and parse_number_or_none(el.get("opacity")) is not None:
            return el
    return None


def visible_shapes(root: ET.Element) -> list[ET.Element]:
    out: list[ET.Element] = []

    def walk(el: ET.Element, in_defs: bool = False) -> None:
        tag = strip_ns(el.tag)
        now_in_defs = in_defs or tag == "defs"
        if not now_in_defs and tag in SHAPE_TAGS:
            out.append(el)
        for child in list(el):
            walk(child, now_in_defs)

    walk(root)
    return out


def clean_color(value: str | None) -> bool:
    if not value:
        return False
    value = value.strip()
    return value != "none" and not value.startswith("url(")


def wrong_color(after: str, offset: int) -> str:
    for color in WRONG_COLORS[offset:] + WRONG_COLORS[:offset]:
        if color != after:
            return color
    return "#ef4444"


def wrong_number(after: float | int, attr: str, offset: int) -> float | int:
    if attr in {"r", "rx", "ry"}:
        return round(max(1, float(after) + 12 + (offset % 5)), 2)
    if attr == "stroke-width":
        return round(max(0.5, float(after) + 4 + (offset % 3)), 2)
    if attr == "opacity":
        return max(0.1, min(0.95, round(float(after) * 0.45, 2)))
    delta = 35 + (offset % 6) * 8
    return round(float(after) + delta, 2)


def parse_number(value: str | None) -> float | int:
    number = parse_number_or_none(value)
    if number is None:
        raise ValueError(f"expected numeric value, got {value!r}")
    return number


def parse_number_or_none(value: str | None) -> float | int | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return int(parsed) if parsed.is_integer() else parsed


def format_number(value: float | int) -> str:
    if isinstance(value, int):
        return str(value)
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def extra_part(task_id: str, offset: int) -> dict[str, Any]:
    x = 1120 + (offset % 4) * 80
    y = 110 + (offset % 5) * 62
    return {
        "id": f"{task_id}-extra-survey-marker",
        "tag": "circle",
        "cx": x,
        "cy": y,
        "r": 32 + (offset % 4) * 3,
        "fill": WRONG_COLORS[offset % len(WRONG_COLORS)],
        "opacity": 0.82,
        "stroke": "#111827",
        "stroke-width": 5,
    }


def make_element(spec: dict[str, Any]) -> ET.Element:
    tag = spec["tag"]
    el = ET.Element(f"{{{SVG_NS}}}{tag}")
    for key, value in spec.items():
        if key == "tag":
            continue
        el.set(key, format_number(value) if isinstance(value, (int, float)) else str(value))
    return el


def element_by_id(root: ET.Element, part_id: str | None) -> ET.Element:
    if not part_id:
        raise ValueError("missing part id")
    for el in root.iter():
        if el.get("id") == part_id:
            return el
    raise ValueError(f"missing element id {part_id}")


def instruction_for(title: str, diffs: list[dict[str, Any]]) -> str:
    lines = [f"Repair the disturbed scenic SVG: {title}.", "", "Patch:"]
    for diff in diffs:
        if diff["attribute"] == "exists" and diff["after"] is False:
            lines.append(f"- remove {diff['part']}")
        else:
            lines.append(f"- {diff['part']}.{diff['attribute']}: {compact(diff['before'])} -> {compact(diff['after'])}")
    return "\n".join(lines)


def title_from_filename(path: Path) -> str:
    return re.sub(r"^\d+_", "", path.stem).replace("_", " ")


def compact(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def serialize(root: ET.Element) -> str:
    return ET.tostring(root, encoding="unicode", short_empty_elements=True)


if __name__ == "__main__":
    raise SystemExit(main())
