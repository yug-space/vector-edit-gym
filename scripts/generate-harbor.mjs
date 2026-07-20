// Generate standalone Harbor tasks from the frozen VectorEditGym corpus.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, "data", "tasks");
const OUT = join(ROOT, "harbor", "vector-edit-gym");
const DRY_RUN = process.argv.includes("--dry-run");
const SDK_METRICS = readFileSync(
  join(ROOT, "sdk", "python", "vector_edit_gym", "metrics.py"),
  "utf8",
);

const write = (path, content, executable = false) => {
  if (DRY_RUN) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  if (executable) chmodSync(path, 0o755);
};

const VERIFY_PY = String.raw`import argparse
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
`;

const TEST_SH = `#!/bin/sh
set -eu
mkdir -p /logs/verifier
python3 /tests/test_verify.py \\
  --produced /workspace/output.svg \\
  --target /tests/target.svg \\
  --metadata /tests/metadata.json
`;

const DOCKERFILE = `FROM python:3.12-slim
WORKDIR /workspace
COPY initial.svg /workspace/initial.svg
`;

const DATASET_TOML = `[dataset]
name = "thetalab/vector-edit-gym"
description = "40 dense SVG repair tasks with human visual instructions, exact targets, and preservation-aware binary rewards."
authors = [{ name = "Yug Aditi Gupta", email = "yug@thetalab.tech" }]
`;

const METRICS_PY = `def mean(rewards: list[dict]) -> dict:
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "edit_completion", "preservation", "unintended_change_rate", "valid"}
    return {key: sum(row.get(key, 0.0) for row in rewards) / len(rewards) for key in keys}
`;

const taskToml = (task) => `schema_version = "1.1"

[task]
name = "thetalab/vector-edit-gym-${task.task_id.replaceAll("_", "-")}"
description = ${JSON.stringify(task.instruction)}
authors = [{ name = "Yug Aditi Gupta", email = "yug@thetalab.tech" }]
keywords = ["svg", "visual-editing", "preservation", ${JSON.stringify(task.difficulty)}, ${JSON.stringify(task.category)}]

[metadata]
difficulty = ${JSON.stringify(task.difficulty)}
category = ${JSON.stringify(task.category)}
task_id = ${JSON.stringify(task.task_id)}

[verifier]
timeout_sec = 30.0

[agent]
timeout_sec = 180.0

[environment]
allow_internet = false
memory_mb = 512
`;

const instructionMd = (task) => `# SVG repair

${task.instruction}

The corrupted SVG is at \`/workspace/initial.svg\`. Write one complete corrected SVG to \`/workspace/output.svg\`. Do not include Markdown or commentary.
`;

const cleanSvg = (svg) => `${svg.replace(/[ \t]+$/gm, "").trimEnd()}\n`;

const files = readdirSync(DATA).filter((file) => /^sv_\d+\.json$/.test(file)).sort();
if (files.length !== 40) throw new Error(`expected 40 tasks, found ${files.length}`);
if (!DRY_RUN) {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
}
write(join(OUT, "dataset.toml"), DATASET_TOML);
write(join(OUT, "metrics.py"), METRICS_PY);

for (const file of files) {
  const task = JSON.parse(readFileSync(join(DATA, file), "utf8"));
  if (DRY_RUN) {
    console.log(`${task.task_id} ${task.category}`);
    continue;
  }
  const taskDir = join(OUT, "tasks", task.task_id);
  write(join(taskDir, "task.toml"), taskToml(task));
  write(join(taskDir, "instruction.md"), instructionMd(task));
  write(join(taskDir, "environment", "Dockerfile"), DOCKERFILE);
  write(join(taskDir, "environment", "initial.svg"), cleanSvg(task.initial_svg));
  write(join(taskDir, "tests", "target.svg"), cleanSvg(task.target_svg));
  write(join(taskDir, "tests", "metrics.py"), SDK_METRICS);
  write(
    join(taskDir, "tests", "metadata.json"),
    `${JSON.stringify({ target_parts: task.target_parts, should_preserve: task.should_preserve }, null, 2)}\n`,
  );
  write(join(taskDir, "tests", "test_verify.py"), VERIFY_PY);
  write(join(taskDir, "tests", "test.sh"), TEST_SH, true);
}

if (DRY_RUN) {
  console.log(`\n${files.length} tasks would be generated.`);
} else {
  console.log(`Generated ${files.length} Harbor tasks in ${OUT}`);
  try {
    execFileSync("harbor", ["add", join(OUT, "tasks"), "--to", OUT, "--scan"], { stdio: "inherit" });
  } catch (error) {
    if (error.code === "ENOENT") console.log("Harbor CLI not installed; skipped local registration.");
    else throw error;
  }
}
