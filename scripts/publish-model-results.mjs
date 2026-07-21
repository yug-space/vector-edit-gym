#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const runArg = process.argv[2];
if (!runArg) throw new Error("usage: node scripts/publish-model-results.mjs RUN_DIRECTORY");
const runDir = resolve(process.cwd(), runArg);
const resultsPath = join(runDir, "results.jsonl");
const summaryPath = join(runDir, "summary.json");
const metaPath = join(runDir, "meta.json");
for (const path of [resultsPath, summaryPath, metaPath]) {
  if (!existsSync(path)) throw new Error(`missing benchmark artifact: ${path}`);
}

const records = readFileSync(resultsPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const summaries = JSON.parse(readFileSync(summaryPath, "utf8"));
const meta = JSON.parse(readFileSync(metaPath, "utf8"));
if (!/^[a-f0-9]{64}$/.test(meta.corpus_hash ?? "")) {
  throw new Error("run metadata is missing a valid corpus hash; rescore the run before publishing");
}
if (new Set(meta.models.map((model) => model.id)).size !== meta.models.length) {
  throw new Error("run metadata contains duplicate model IDs");
}
if (new Set(meta.task_ids).size !== meta.task_ids.length || meta.task_ids.length !== meta.task_count) {
  throw new Error("run metadata contains duplicate tasks or an inconsistent task count");
}
const expected = meta.models.length * meta.task_count;
if (records.length !== expected) {
  throw new Error(`run is incomplete: expected ${expected} records, found ${records.length}`);
}

const expectedPairs = new Set(
  meta.models.flatMap((model) => meta.task_ids.map((taskId) => `${model.id}\u0000${taskId}`)),
);
const actualPairs = new Set();
for (const record of records) {
  const key = `${record.requested_model}\u0000${record.task_id}`;
  if (!expectedPairs.has(key)) {
    throw new Error(`unexpected model/task record: ${record.requested_model} / ${record.task_id}`);
  }
  if (actualPairs.has(key)) {
    throw new Error(`duplicate model/task record: ${record.requested_model} / ${record.task_id}`);
  }
  actualPairs.add(key);
}
const missingPairs = [...expectedPairs].filter((key) => !actualPairs.has(key));
if (missingPairs.length > 0) {
  const [model, taskId] = missingPairs[0].split("\u0000");
  throw new Error(`run is incomplete: missing ${missingPairs.length} pair(s), first is ${model} / ${taskId}`);
}

const expectedModelIds = new Set(meta.models.map((model) => model.id));
const summaryModelIds = summaries.map((summary) => summary.id);
if (
  summaries.length !== meta.models.length
  || new Set(summaryModelIds).size !== summaries.length
  || summaryModelIds.some((id) => !expectedModelIds.has(id))
  || summaries.some((summary) => summary.n !== meta.task_count)
) {
  throw new Error("summary does not match the completed model-task matrix; rescore the run before publishing");
}

const date = String(meta.created_at).slice(0, 10);
const leaderboardEntries = summaries.map((summary, index) => ({
  rank: index + 1,
  name: summary.name,
  provider: summary.family,
  model: summary.id,
  group: summary.group,
  specification_pass: Number(summary.spec_pass_rate ?? summary.binary_reward),
  reward: Number(summary.spec_pass_rate ?? summary.binary_reward),
  near_pass: Number(summary.near_pass_rate ?? 0),
  repair_pass: Number(summary.repair_pass_rate ?? 0),
  preservation_pass: Number(summary.preservation_pass_rate ?? 0),
  source_preservation_pass: Number(summary.source_preservation_pass_rate ?? 0),
  exact: Number(summary.exact_rate),
  structural: Number(summary.structural_rate),
  validity: Number(summary.validity_rate),
  edit_completion: Number(summary.edit_completion),
  repair_progress: Number(summary.repair_progress ?? summary.edit_completion),
  preservation: Number(summary.preservation),
  source_preservation: Number(summary.source_preservation ?? summary.preservation),
  unintended_change_rate: summary.unintended_change_rate == null
    ? null
    : Number(summary.unintended_change_rate),
  error_rate: Number(summary.error_rate),
  truncation_rate: Number(summary.truncation_rate),
  mean_elapsed_ms: Number(summary.mean_elapsed_ms ?? summary.mean_latency_ms),
  cost_usd: Number(summary.cost_usd),
  tasks_run: Number(summary.n),
  submitted_by: "Theta Labs",
  date,
}));

const perTask = {};
for (const record of records) {
  const report = record.diff_report ?? {};
  const expectedChanges = report.expected_changes ?? [];
  const preserveChecks = report.preserve_checks ?? [];
  const item = {
    name: record.model_name,
    provider: record.family,
    model: record.requested_model,
    resolved_model: record.resolved_model,
    response_id: record.response_id ?? null,
    group: record.group,
    status: record.status,
    reward: Number(record.reward ?? 0),
    specification_pass: Boolean(record.specification_pass ?? record.reward),
    near_pass: Boolean(record.near_pass),
    repair_pass: Boolean(record.repair_pass),
    preservation_pass: Boolean(record.preservation_pass),
    source_preservation_pass: Boolean(record.source_preservation_pass),
    validity_pass: Boolean(record.validity_pass),
    exact: Boolean(record.exact),
    structural: Boolean(record.structural),
    edit_completion: Number(record.edit_completion ?? 0),
    repair_progress: Number(record.repair_progress ?? record.edit_completion ?? 0),
    preservation: Number(record.preservation ?? 0),
    source_preservation: Number(record.source_preservation ?? record.preservation ?? 0),
    unintended_change_rate: Number(record.unintended_change_rate ?? 1),
    expected_changes_passed: expectedChanges.filter((check) => check.passed).length,
    expected_changes_total: expectedChanges.length,
    expected_changes: expectedChanges.map((check) => ({
      part: check.part,
      attribute: check.attribute,
      expected_after: check.expected_after,
      produced: check.produced,
      passed: Boolean(check.passed),
      comparison: check.comparison ?? "canonical",
      distance: check.distance ?? null,
      tolerance: check.tolerance ?? null,
      baseline_distance: check.baseline_distance ?? null,
      progress: check.progress ?? null,
      unit: check.unit ?? null,
      detail: check.detail ?? null,
    })),
    unexpected_changed_parts: report.unexpected_changed_parts ?? [],
    failure_reasons: report.failure_reasons ?? [],
    preservation_failures: preserveChecks.filter((check) => !check.passed).map((check) => check.part),
    source_preservation_failures: preserveChecks.filter((check) => !check.source_passed).map((check) => check.part),
    elapsed_ms: Number(record.elapsed_ms ?? 0),
    cost_usd: Number(record.cost_usd ?? 0),
    prompt_tokens: Number(record.prompt_tokens ?? 0),
    completion_tokens: Number(record.completion_tokens ?? 0),
    finish_reason: record.finish_reason ?? null,
    reasoning_tokens: Number(record.reasoning_tokens ?? 0),
    max_output_tokens: Number(record.max_output_tokens ?? 0),
    produced_parse_ok: Boolean(report.produced_parse_ok),
    produced_valid_svg: Boolean(report.produced_valid_svg),
    error: record.error ?? null,
    produced_svg: report.produced_parse_ok ? (record.produced_svg ?? null) : null,
    raw_response: report.produced_parse_ok ? null : (record.raw_response ?? record.produced_svg ?? null),
  };
  perTask[record.task_id] = [...(perTask[record.task_id] ?? []), item];
}

const modelOrder = new Map(leaderboardEntries.map((entry, index) => [entry.model, index]));
for (const results of Object.values(perTask)) {
  results.sort((left, right) => (modelOrder.get(left.model) ?? 999) - (modelOrder.get(right.model) ?? 999));
}

const leaderboard = {
  updated_at: date,
  note: "One scored outcome per model-task pair with temperature omitted. Full pass requires every requested repair within calibrated perceptual tolerance, semantic preservation outside requested fields, and a valid SVG. Near-complete and repair progress expose useful non-binary behavior; UCR is conditional on valid outputs; canonical target and source preservation remain diagnostics.",
  protocol: meta.protocol,
  evaluator: meta.evaluator,
  corpus_hash: meta.corpus_hash,
  run: basename(runDir),
  entries: leaderboardEntries,
};
const modelResults = {
  updated_at: date,
  note: "Per-task outputs from the published OpenRouter evaluation. Full pass is tolerant for requested repairs and semantic for preserved content; source fidelity is reported separately. Provider errors are scored as zero and no fallback model is used.",
  protocol: meta.protocol,
  evaluator: meta.evaluator,
  corpus_hash: meta.corpus_hash,
  run: basename(runDir),
  runs: leaderboardEntries.map(({ name, provider, model, group }) => ({ name, provider, model, group })),
  results: perTask,
};

const summaryResults = {
  ...modelResults,
  note: "Compact per-task diagnostics for the task catalog. Full outputs are stored in model-results.json and model-results/<task-id>.json.",
  results: Object.fromEntries(
    Object.entries(perTask).map(([taskId, results]) => [
      taskId,
      results.map(({ expected_changes, produced_svg, raw_response, ...summary }) => summary),
    ]),
  ),
};

for (const [name, value] of [
  ["leaderboard.json", leaderboard],
  ["model-results.json", modelResults],
  ["model-results-summary.json", summaryResults],
]) {
  const path = join(ROOT, "data", name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${path}`);
}

const perTaskDirectory = join(ROOT, "data", "model-results");
rmSync(perTaskDirectory, { recursive: true, force: true });
mkdirSync(perTaskDirectory, { recursive: true });
for (const [taskId, results] of Object.entries(perTask)) {
  const path = join(perTaskDirectory, `${taskId}.json`);
  writeFileSync(path, `${JSON.stringify(results, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(perTask).length} task result files to ${perTaskDirectory}`);
