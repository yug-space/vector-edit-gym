// Build a combined data/tasks/_index.json after all tier generators run.
//
// The viewer reads files directly; this index is just a convenience for
// downstream scripts (scoring harnesses, dashboards, etc.).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS = join(__dirname, "..", "data", "tasks");

const ORDER = { very_easy: 0, easy: 1, medium: 2, hard: 3, very_hard: 4 };

const files = readdirSync(TASKS)
  .filter((f) => /^[a-z]+_\d+\.json$/.test(f));

const tasks = files.map((f) => JSON.parse(readFileSync(join(TASKS, f), "utf-8")));
tasks.sort((a, b) => {
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

const index = {
  generated_at: new Date().toISOString(),
  count: tasks.length,
  by_difficulty: byDifficulty,
  by_category: byCategory,
  tasks: tasks.map((t) => ({
    task_id: t.task_id,
    difficulty: t.difficulty,
    category: t.category,
    instruction: t.instruction,
  })),
};
writeFileSync(join(TASKS, "_index.json"), JSON.stringify(index, null, 2));
console.log(`index: ${tasks.length} tasks`);
console.log("by difficulty:", byDifficulty);
console.log("by category:  ", byCategory);
