// Generate standalone Harbor tasks from the frozen Vector-Bench corpus.

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
const SDK_DIR = join(ROOT, "sdk", "python", "vector_edit_gym");
const SDK_MODULES = Object.fromEntries(
  ["metrics.py", "semantic.py", "tolerance.py", "tasks.py", "diffing.py"].map((name) => [
    name,
    readFileSync(join(SDK_DIR, name), "utf8"),
  ]),
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
        "near_pass": int(report.near_pass),
        "repair_pass": int(report.repair_pass),
        "preservation_pass": int(report.preservation_pass),
        "source_preservation_pass": int(report.source_preservation_pass),
        "validity_pass": int(report.validity_pass),
        "target_match": int(report.structural),
        "edit_completion": report.edit_completion,
        "repair_progress": report.repair_progress,
        "preservation": report.preservation,
        "source_preservation": report.source_preservation,
        "unintended_change_rate": report.unintended_change_rate,
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
  --initial /workspace/initial.svg \\
  --target /tests/target.svg \\
  --metadata /tests/metadata.json
`;

const DOCKERFILE = `FROM python:3.12-slim
RUN pip install --no-cache-dir "svg.path>=7.0,<8"
WORKDIR /workspace
COPY initial.svg /workspace/initial.svg
`;

const DATASET_TOML = `[dataset]
name = "vector-bench/vector-edit-gym"
description = "40 dense SVG repair tasks with naturalistic instructions, perceptual requested-edit checks, semantic preservation, and binary rewards plus near-complete diagnostics."
authors = [{ name = "Yug Gupta" }, { name = "Prannay Hebbar" }]
`;

const METRICS_PY = `def mean(rewards: list[dict]) -> dict:
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "specification_pass", "near_pass", "repair_pass", "preservation_pass", "source_preservation_pass", "validity_pass", "target_match", "edit_completion", "repair_progress", "preservation", "source_preservation", "unintended_change_rate"}
    return {key: sum(row.get(key, 0.0) for row in rewards) / len(rewards) for key in keys}
`;

const taskToml = (task) => `schema_version = "1.1"

[task]
name = "vector-bench/vector-edit-gym-${task.task_id.replaceAll("_", "-")}"
description = ${JSON.stringify(task.instruction)}
authors = [{ name = "Yug Gupta" }, { name = "Prannay Hebbar" }]
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
  write(join(taskDir, "tests", "vector_edit_gym", "__init__.py"), "");
  for (const [name, source] of Object.entries(SDK_MODULES)) {
    write(join(taskDir, "tests", "vector_edit_gym", name), source);
  }
  write(
    join(taskDir, "tests", "metadata.json"),
    `${JSON.stringify({
      task_id: task.task_id,
      difficulty: task.difficulty,
      category: task.category,
      instruction: task.instruction,
      parts: task.parts,
      target_parts: task.target_parts,
      expected_diff: task.expected_diff,
      should_preserve: task.should_preserve,
      display_order: task.display_order,
    }, null, 2)}\n`,
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
