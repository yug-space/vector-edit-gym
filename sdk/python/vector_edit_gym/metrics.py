"""Scoring metrics for solver outputs.

Three increasingly forgiving comparisons:

  exact_match         — string-equal to target_svg (modulo trailing whitespace)
  structural_match    — parsed element trees match (tag + attrs + nesting)
  preservation_score  — fraction of `should_preserve` parts that remain unchanged
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Optional


def normalize(svg: str) -> str:
    """Trim trailing whitespace and collapse multi-space runs."""
    return re.sub(r"\s+", " ", svg.strip())


def exact_match(produced: str, target: str) -> bool:
    return normalize(produced) == normalize(target)


# --------------------------------------------------------------------------

def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _to_tree(svg: str) -> Optional[ET.Element]:
    try:
        return ET.fromstring(svg)
    except ET.ParseError:
        return None


def _norm_attrs(attrs: dict) -> dict:
    out = {}
    for k, v in attrs.items():
        k = k.split("}", 1)[-1] if "}" in k else k
        out[k] = re.sub(r"\s+", " ", v.strip())
    return out


def _tree_eq(a: ET.Element, b: ET.Element) -> bool:
    if _strip_ns(a.tag) != _strip_ns(b.tag):
        return False
    if _norm_attrs(a.attrib) != _norm_attrs(b.attrib):
        return False
    ac = list(a)
    bc = list(b)
    if len(ac) != len(bc):
        return False
    for ca, cb in zip(ac, bc):
        if not _tree_eq(ca, cb):
            return False
    return True


def structural_match(produced: str, target: str) -> bool:
    """Equal up to whitespace and attribute ordering."""
    a = _to_tree(produced)
    b = _to_tree(target)
    if a is None or b is None:
        return False
    return _tree_eq(a, b)


# --------------------------------------------------------------------------

def _element_by_id(svg: str, id_: str) -> Optional[ET.Element]:
    tree = _to_tree(svg)
    if tree is None:
        return None
    for el in tree.iter():
        if el.attrib.get("id") == id_:
            return el
    return None


def preservation_score(produced: str, target: str, should_preserve: list[str]) -> float:
    """Fraction of `should_preserve` parts that match between produced and target.

    Returns 1.0 if `should_preserve` is empty.
    """
    if not should_preserve:
        return 1.0
    hits = 0
    for pid in should_preserve:
        prod_el = _element_by_id(produced, pid)
        targ_el = _element_by_id(target, pid)
        if prod_el is not None and targ_el is not None and _tree_eq(prod_el, targ_el):
            hits += 1
    return hits / len(should_preserve)
