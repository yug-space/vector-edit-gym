// Generate Harbor benchmark tasks from data/tasks/*.json.
//
// Output: harbor/vector-edit-gym/ with one subdirectory per task.
//
// Usage:
//   node scripts/generate-harbor.mjs
//   node scripts/generate-harbor.mjs --dry-run   (print list, no writes)

import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data", "tasks");
const OUT = join(ROOT, "harbor", "vector-edit-gym");

const DRY_RUN = process.argv.includes("--dry-run");
const ORG = "thetalab";

// ---- helpers ---------------------------------------------------------------

const write = (path, content) => {
  if (DRY_RUN) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
};

const writeExec = (path, content) => {
  write(path, content);
  if (!DRY_RUN) chmodSync(path, 0o755);
};

// task_id "ea_001" → harbor task name "theta-rl-lab/vector-edit-gym-ea-001"
const harborName = (taskId) =>
  `${ORG}/vector-edit-gym-${taskId.replace(/_/g, "-")}`;

// ---- shared verifier (same for every task) ---------------------------------

const TEST_VERIFY_PY = `\
import json, re, argparse
import xml.etree.ElementTree as ET


def normalize(svg):
    return re.sub(r"\\s+", " ", svg.strip())


def exact_match(a, b):
    return normalize(a) == normalize(b)


def _strip_ns(tag):
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _norm_attrs(attrs):
    return {
        (k.split("}", 1)[-1] if "}" in k else k): re.sub(r"\\s+", " ", v.strip())
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
`;

const TEST_SH = `\
#!/bin/bash
set -euo pipefail
mkdir -p /logs/verifier

# Grab preserve IDs from the task metadata file (comma-separated, may be empty)
PRESERVE_IDS="$(cat /tests/preserve_ids.txt 2>/dev/null || echo '')"

python3 /tests/test_verify.py \\
    --produced /workspace/output.svg \\
    --target   /tests/target.svg \\
    --preserve-ids "$PRESERVE_IDS"
`;

const SOLVE_SH = `\
#!/bin/bash
# Oracle: copy the ground-truth target into the agent workspace.
cp /solution/target.svg /workspace/output.svg
`;

const DOCKERFILE = `\
FROM python:3.12-slim
WORKDIR /workspace
COPY initial.svg /workspace/initial.svg
`;

// ---- dataset-level files ---------------------------------------------------

const DATASET_TOML = `\
[dataset]
name = "${ORG}/vector-edit-gym"
description = "106 hand-authored SVG editing tasks across four difficulty tiers (easy / medium / hard / very_hard). Each task is a corrupted SVG plus a natural-language fix instruction. Strict structural and preservation metrics catch stylistic drift."
authors = [
  { name = "Prannay Hebbar", email = "prannay@hexo.ai" }
]
`;

const METRICS_PY = `\
def mean(rewards: list[dict]) -> dict:
    """Aggregate per-task rewards.

    Returns mean of each metric key across all tasks.
    """
    if not rewards:
        return {"reward": 0.0}
    keys = {"reward", "exact", "structural", "preservation"}
    return {k: sum(r.get(k, 0.0) for r in rewards) / len(rewards) for k in keys}
`;

// ---- per-task task.toml template ------------------------------------------

const taskToml = ({ taskId, difficulty, category, description }) => `\
schema_version = "1.1"

[task]
name = "${harborName(taskId)}"
description = ${JSON.stringify(description)}
authors = [{ name = "Prannay Hebbar", email = "prannay@hexo.ai" }]
keywords = ["svg", "visual-editing", ${JSON.stringify(difficulty)}, ${JSON.stringify(category)}]

[metadata]
difficulty = ${JSON.stringify(difficulty)}
category   = ${JSON.stringify(category)}
task_id    = ${JSON.stringify(taskId)}

[verifier]
timeout_sec = 30.0

[agent]
timeout_sec = 120.0

[environment]
allow_internet = false
memory_mb = 512
`;

// ---- per-task instruction.md ----------------------------------------------

const instructionMd = ({ taskId, instruction }) => `\
# SVG Repair Task

**Task ID:** ${taskId}

## Your goal
${instruction}

## Input
The corrupted SVG is at \`/workspace/initial.svg\`.

## Output
Write your corrected SVG to \`/workspace/output.svg\`.

Return a valid \`<svg>...</svg>\` document only — no markdown, no commentary.
`;

// ---- main ------------------------------------------------------------------

const taskFiles = readdirSync(DATA).filter((f) => /^[a-z]+_\d+\.json$/.test(f));

if (!DRY_RUN) {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });
}

// Dataset-level files
write(join(OUT, "dataset.toml"), DATASET_TOML);
write(join(OUT, "metrics.py"), METRICS_PY);

let count = 0;
for (const file of taskFiles) {
  const raw = JSON.parse(readFileSync(join(DATA, file), "utf-8"));
  const { task_id, difficulty, category, instruction, initial_svg, target_svg, should_preserve = [] } = raw;

  if (DRY_RUN) {
    console.log(`  ${task_id}  [${difficulty}]  ${category}`);
    count++;
    continue;
  }

  const taskDir = join(OUT, "tasks", task_id);

  // task.toml
  write(
    join(taskDir, "task.toml"),
    taskToml({ taskId: task_id, difficulty, category, description: instruction })
  );

  // instruction.md
  write(join(taskDir, "instruction.md"), instructionMd({ taskId: task_id, instruction }));

  // environment/
  write(join(taskDir, "environment", "Dockerfile"), DOCKERFILE);
  write(join(taskDir, "environment", "initial.svg"), initial_svg);

  // solution/
  write(join(taskDir, "solution", "target.svg"), target_svg);
  writeExec(join(taskDir, "solution", "solve.sh"), SOLVE_SH);

  // tests/
  write(join(taskDir, "tests", "target.svg"), target_svg);
  write(join(taskDir, "tests", "preserve_ids.txt"), should_preserve.join(","));
  writeExec(join(taskDir, "tests", "test.sh"), TEST_SH);
  write(join(taskDir, "tests", "test_verify.py"), TEST_VERIFY_PY);

  count++;
}

if (DRY_RUN) {
  console.log(`\n${count} tasks would be generated (dry run).`);
} else {
  console.log(`Generated ${count} Harbor tasks → harbor/vector-edit-gym/`);
  console.log(`Registering tasks in dataset manifest…`);
  const { execSync } = await import("node:child_process");
  execSync(
    `harbor add "${join(OUT, "tasks")}" --to "${OUT}" --scan`,
    { stdio: "inherit" }
  );
}
