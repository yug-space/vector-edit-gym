import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const RUNS = [
  {
    name: "Gemini 3 Pro Preview",
    provider: "Google via LiteLLM",
    model: "gemini/gemini-3-pro-preview",
    resultsPath: "runs/litellm/gemini3-flash-vs-pro/gemini-gemini-3-pro-preview/results.jsonl",
  },
  {
    name: "GPT-5.5",
    provider: "OpenAI",
    model: "gpt-5.5",
    resultsPath: "runs/openai/gpt55-fixed/gpt-5.5/results.jsonl",
  },
  {
    name: "Gemini 3 Flash Preview",
    provider: "Google via LiteLLM",
    model: "gemini/gemini-3-flash-preview",
    resultsPath: "runs/litellm/gemini3-flash-vs-pro/gemini-gemini-3-flash-preview/results.jsonl",
  },
];

const statusFor = (record) => {
  if (record.error) return "ERR";
  if (record.metrics?.exact) return "EXACT";
  if (record.metrics?.structural) return "STRUCT";
  if ((record.metrics?.preservation ?? 0) > 0) return "PRES";
  return "FAIL";
};

const loadJsonl = (relPath) => {
  const raw = readFileSync(join(ROOT, relPath), "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").map((line) => JSON.parse(line));
};

const results = {};

for (const run of RUNS) {
  for (const record of loadJsonl(run.resultsPath)) {
    const report = record.diff_report ?? {};
    const expectedChanges = report.expected_changes ?? [];
    const preserveChecks = report.preserve_checks ?? [];
    const taskResults = results[record.task_id] ?? [];

    taskResults.push({
      name: run.name,
      provider: run.provider,
      model: run.model,
      status: statusFor(record),
      exact: Boolean(record.metrics?.exact),
      structural: Boolean(record.metrics?.structural),
      preservation: Number(record.metrics?.preservation ?? 0),
      expected_changes_passed: expectedChanges.filter((check) => check.passed).length,
      expected_changes_total: expectedChanges.length,
      expected_changes: expectedChanges.map((check) => ({
        part: check.part,
        attribute: check.attribute,
        expected_after: check.expected_after,
        produced: check.produced,
        passed: Boolean(check.passed),
      })),
      unexpected_changed_parts: report.unexpected_changed_parts ?? [],
      preservation_failures: preserveChecks
        .filter((check) => !check.passed)
        .map((check) => check.part),
      elapsed_ms: Number(record.elapsed_ms ?? 0),
      error: record.error ?? null,
      produced_svg: record.produced_svg ?? null,
    });

    results[record.task_id] = taskResults;
  }
}

const output = {
  updated_at: "2026-05-26",
  note: "Per-task model outputs from published benchmark runs.",
  runs: RUNS.map(({ name, provider, model }) => ({ name, provider, model })),
  results,
};

const outPath = join(ROOT, "data", "model-results.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${outPath}`);
