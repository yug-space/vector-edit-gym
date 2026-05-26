import json, re, argparse
import xml.etree.ElementTree as ET


def normalize(svg):
    return re.sub(r"\s+", " ", svg.strip())


def exact_match(a, b):
    return normalize(a) == normalize(b)


def _strip_ns(tag):
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _norm_attrs(attrs):
    return {
        (k.split("}", 1)[-1] if "}" in k else k): re.sub(r"\s+", " ", v.strip())
        for k, v in attrs.items()
    }


def _tree_eq(a, b):
    if _strip_ns(a.tag) != _strip_ns(b.tag):
        return False
    if _norm_attrs(a.attrib) != _norm_attrs(b.attrib):
        return False
    ca, cb = list(a), list(b)
    return len(ca) == len(cb) and all(_tree_eq(x, y) for x, y in zip(ca, cb))


def structural_match(a, b):
    try:
        return _tree_eq(ET.fromstring(a), ET.fromstring(b))
    except ET.ParseError:
        return False


def preservation_score(produced, target, ids):
    if not ids:
        return 1.0

    def by_id(svg, id_):
        try:
            for el in ET.fromstring(svg).iter():
                if el.attrib.get("id") == id_:
                    return el
        except ET.ParseError:
            pass
        return None

    hits = sum(
        1
        for pid in ids
        if (pe := by_id(produced, pid)) is not None
        and (te := by_id(target, pid)) is not None
        and _tree_eq(pe, te)
    )
    return hits / len(ids)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--produced", required=True)
    p.add_argument("--target", required=True)
    p.add_argument("--preserve-ids", default="")
    args = p.parse_args()

    try:
        produced = open(args.produced).read()
    except FileNotFoundError:
        result = {"exact": 0.0, "structural": 0.0, "preservation": 0.0, "reward": 0.0}
        json.dump(result, open("/logs/verifier/reward.json", "w"))
        return

    target = open(args.target).read()
    ids = [x for x in args.preserve_ids.split(",") if x]

    em = float(exact_match(produced, target))
    sm = float(structural_match(produced, target))
    ps = preservation_score(produced, target, ids)

    # Primary reward is structural_match: confirms correct SVG structure
    # without being brittle to whitespace / attribute ordering.
    result = {
        "reward": sm,
        "exact": em,
        "structural": sm,
        "preservation": ps,
    }
    json.dump(result, open("/logs/verifier/reward.json", "w"))


main()
