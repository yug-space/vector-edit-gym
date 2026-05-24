// Shared task emitter used by every tier generator.
//
// Tier scripts call `taskBuilder(prefix, difficulty)` to get a closure that
// accepts { category, initialSpec, edit, instruction, targetIds } and appends
// a fully-formed task record to its internal list. Call `write(outDir)` to
// flush everything to disk + emit an _index.json.

import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { renderSpec } from "./render.mjs";

export const taskBuilder = (prefix, difficulty) => {
  const tasks = [];
  let counter = 0;

  const make = ({ category, initialSpec, edit, instruction, targetIds }) => {
    counter += 1;
    const id = `${prefix}_${String(counter).padStart(3, "0")}`;
    const { spec: targetSpec, diff } = edit(initialSpec);
    const parts = initialSpec.objects.map((o) => o.id);
    const targets = new Set(targetIds ?? diff.map((d) => d.part).filter((p) => p !== "__svg"));
    const should_preserve = parts.filter((p) => !targets.has(p));
    tasks.push({
      task_id: id,
      difficulty,
      category,
      instruction,
      initial_svg: renderSpec(initialSpec),
      target_svg: renderSpec(targetSpec),
      initial_spec: initialSpec,
      target_spec: targetSpec,
      parts,
      target_parts: [...targets],
      expected_diff: diff,
      should_preserve,
    });
    return id;
  };

  // For tasks whose initial/target SVG comes from outside the spec pipeline
  // (e.g. scraped real icons). Caller supplies the fully-formed record minus
  // the id + difficulty; we assign the next sequential id.
  const pushRaw = (record) => {
    counter += 1;
    const id = `${prefix}_${String(counter).padStart(3, "0")}`;
    const task = { task_id: id, difficulty, ...record };
    tasks.push(task);
    return id;
  };

  const write = (outDir) => {
    if (existsSync(outDir)) {
      for (const f of readdirSync(outDir)) {
        if (new RegExp(`^${prefix}_\\d+\\.json$`).test(f)) rmSync(join(outDir, f));
      }
    } else {
      mkdirSync(outDir, { recursive: true });
    }
    for (const t of tasks) {
      writeFileSync(join(outDir, `${t.task_id}.json`), JSON.stringify(t, null, 2));
    }
    return tasks;
  };

  return { make, pushRaw, write, tasks };
};
