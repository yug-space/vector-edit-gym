import argparse
import json
import os

from vector_edit_gym.diffing import diff_report
from vector_edit_gym.tasks import Task


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--produced", required=True)
    parser.add_argument("--initial", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--metadata", required=True)
    args = parser.parse_args()
    try:
        produced_text = open(args.produced).read()
    except FileNotFoundError:
        produced_text = ""
    initial_text = open(args.initial).read()
    target_text = open(args.target).read()
    metadata = json.load(open(args.metadata))
    task = Task(initial_svg=initial_text, target_svg=target_text, **metadata)
    report = diff_report(task, produced_text)
    result = {
        "reward": report.reward,
        "specification_pass": int(report.specification_pass),
        "repair_pass": int(report.repair_pass),
        "preservation_pass": int(report.preservation_pass),
        "validity_pass": int(report.validity_pass),
        "target_match": int(report.structural),
        "edit_completion": report.edit_completion,
        "preservation": report.preservation,
        "unintended_change_rate": report.unintended_change_rate,
    }
    log_dir = os.environ.get("HARBOR_LOG_DIR", "/logs/verifier")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "reward.json"), "w") as handle:
        json.dump(result, handle)


main()
