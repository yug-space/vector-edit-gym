import argparse
import json
import os
from metrics import element_by_id, parse_svg, trees_equal


def subtree_equal(left, right):
    if left is None or right is None:
        return left is right
    return trees_equal(left, right)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--produced", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--metadata", required=True)
    args = parser.parse_args()
    try:
        produced_text = open(args.produced).read()
    except FileNotFoundError:
        produced_text = ""
    target_text = open(args.target).read()
    metadata = json.load(open(args.metadata))
    produced = parse_svg(produced_text)
    target = parse_svg(target_text)

    reward = int(produced is not None and target is not None and trees_equal(produced, target))
    expected = metadata["target_parts"]
    edit_hits = 0
    if produced is not None:
        for part in expected:
            produced_part = element_by_id(produced, part)
            target_part = element_by_id(target, part)
            if target_part is None:
                edit_hits += int(produced_part is None)
            else:
                edit_hits += int(subtree_equal(produced_part, target_part))
    edit_completion = edit_hits / len(expected) if expected else 1.0

    preserve = metadata["should_preserve"]
    preserved = sum(
        subtree_equal(element_by_id(produced, part), element_by_id(target, part))
        for part in preserve
    )
    preservation = preserved / len(preserve) if preserve else 1.0
    result = {
        "reward": reward,
        "edit_completion": edit_completion,
        "preservation": preservation,
        "unintended_change_rate": 1.0 - preservation,
        "valid": int(produced is not None),
    }
    log_dir = os.environ.get("HARBOR_LOG_DIR", "/logs/verifier")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "reward.json"), "w") as handle:
        json.dump(result, handle)


main()
