// Build a combined task _index.json after all tier generators run.
//
// The viewer reads files directly; this index is just a convenience for
// downstream scripts (scoring harnesses, dashboards, etc.).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const positionalDir = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const TASKS = argValue("--tasks-dir")
  ? resolve(process.cwd(), argValue("--tasks-dir"))
  : positionalDir
    ? resolve(process.cwd(), positionalDir)
    : join(__dirname, "..", "data", "tasks");

const ORDER = { very_easy: 0, easy: 1, medium: 2, hard: 3, very_hard: 4 };

const files = readdirSync(TASKS)
  .filter((f) => /^[a-z]+_\d+\.json$/.test(f));

const tasks = files.map((f) => JSON.parse(readFileSync(join(TASKS, f), "utf-8")));
tasks.sort((a, b) => {
  if (Number.isFinite(a.display_order) || Number.isFinite(b.display_order)) {
    const oa = Number.isFinite(a.display_order) ? a.display_order : Number.MAX_SAFE_INTEGER;
    const ob = Number.isFinite(b.display_order) ? b.display_order : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
  }
  const da = ORDER[a.difficulty] ?? 99;
  const db = ORDER[b.difficulty] ?? 99;
  if (da !== db) return da - db;
  return a.task_id.localeCompare(b.task_id);
});

const byDifficulty = tasks.reduce((acc, t) => {
  acc[t.difficulty] = (acc[t.difficulty] ?? 0) + 1;
  return acc;
}, {});
const byCategory = tasks.reduce((acc, t) => {
  acc[t.category] = (acc[t.category] ?? 0) + 1;
  return acc;
}, {});

const indexBody = {
  count: tasks.length,
  by_difficulty: byDifficulty,
  by_category: byCategory,
  tasks: tasks.map((t) => ({
    task_id: t.task_id,
    difficulty: t.difficulty,
    category: t.category,
    instruction: t.instruction,
    display_order: t.display_order,
  })),
};

const indexPath = join(TASKS, "_index.json");
let generatedAt = new Date().toISOString();
try {
  const existing = JSON.parse(readFileSync(indexPath, "utf-8"));
  const { generated_at: existingGeneratedAt, ...existingBody } = existing;
  if (JSON.stringify(existingBody) === JSON.stringify(indexBody)) {
    generatedAt = existingGeneratedAt;
  }
} catch {
  // No previous index to preserve.
}

writeFileSync(indexPath, JSON.stringify({ generated_at: generatedAt, ...indexBody }, null, 2));
console.log(`index: ${tasks.length} tasks in ${TASKS}`);
console.log("by difficulty:", byDifficulty);
console.log("by category:  ", byCategory);
