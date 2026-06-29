// Server-only helpers: read tasks + icons off disk.
//
// The viewer is read-only: it loads the generator's JSON output. We keep the
// helpers narrow so swapping in a database later means changing just this
// module.

import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export type DiffEntry = {
  part: string;
  attribute: string;
  before: unknown;
  after: unknown;
  removed?: unknown;
};

export type Task = {
  task_id: string;
  difficulty: string;
  category: string;
  instruction: string;
  initial_svg: string;
  target_svg: string;
  initial_spec: unknown;
  target_spec: unknown;
  parts: string[];
  target_parts?: string[];
  expected_diff: DiffEntry[];
  should_preserve: string[];
  display_order?: number;
};

export type TaskSummary = Pick<
  Task,
  "task_id" | "difficulty" | "category" | "instruction" | "parts"
> & { initial_svg: string; corpus: "v1" | "v2"; display_order?: number };

export type IconEntry = {
  source: string;
  style: string;
  name: string;
  path: string;
  license: string;
  upstream: string;
};

export type IconWithSvg = IconEntry & { svg: string };

const DATA_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "viewer", "data"),
  path.resolve(process.cwd(), "data"),
  path.resolve(process.cwd(), "..", "data"),
].filter((candidate) => existsSync(candidate));
const DATA_DIR =
  DATA_DIR_CANDIDATES.find((candidate) => existsSync(path.join(candidate, "tasks_v2"))) ??
  DATA_DIR_CANDIDATES[0] ??
  path.resolve(process.cwd(), "..", "data");
const TASKS_DIRS = ["tasks", "tasks_v2"]
  .map((name) => path.join(DATA_DIR, name))
  .filter((candidate) => existsSync(candidate));
const ICONS_DIR = path.join(DATA_DIR, "icons");
const corpusForDir = (tasksDir: string): "v1" | "v2" =>
  path.basename(tasksDir) === "tasks_v2" ? "v2" : "v1";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  provider: string;
  model: string;
  exact: number;
  structural: number;
  preservation: number;
  expected_changes?: number;
  unexpected_parts?: number;
  error_rate?: number;
  mean_latency_ms?: number;
  tasks_run: number;
  submitted_by: string;
  date: string;
  notes?: string;
};

export type Leaderboard = {
  updated_at: string;
  note: string;
  entries: LeaderboardEntry[];
};

export type ModelRun = {
  name: string;
  provider: string;
  model: string;
};

export type ModelExpectedChange = {
  part: string;
  attribute: string;
  expected_after: unknown;
  produced: unknown;
  passed: boolean;
};

export type TaskModelResult = {
  name: string;
  provider: string;
  model: string;
  status: "EXACT" | "STRUCT" | "PRES" | "FAIL" | "ERR";
  exact: boolean;
  structural: boolean;
  preservation: number;
  expected_changes_passed: number;
  expected_changes_total: number;
  expected_changes: ModelExpectedChange[];
  unexpected_changed_parts: string[];
  preservation_failures: string[];
  elapsed_ms: number;
  error: string | null;
  produced_svg: string | null;
};

export type TaskModelResultSummary = Omit<
  TaskModelResult,
  "expected_changes" | "produced_svg"
>;

export type ModelResults = {
  updated_at: string;
  note: string;
  runs: ModelRun[];
  results: Record<string, TaskModelResult[]>;
};

export const getLeaderboard = async (): Promise<Leaderboard> => {
  const p = path.join(DATA_DIR, "leaderboard.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as Leaderboard;
  } catch {
    return { updated_at: "", note: "", entries: [] };
  }
};

export const getModelResults = async (): Promise<ModelResults> => {
  const p = path.join(DATA_DIR, "model-results.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as ModelResults;
  } catch {
    return { updated_at: "", note: "", runs: [], results: {} };
  }
};

export const getTaskModelResults = async (id: string): Promise<TaskModelResult[]> => {
  const modelResults = await getModelResults();
  return modelResults.results[id] ?? [];
};

export const getModelResultSummaries = async (): Promise<Record<string, TaskModelResultSummary[]>> => {
  const modelResults = await getModelResults();
  return Object.fromEntries(
    Object.entries(modelResults.results).map(([taskId, results]) => [
      taskId,
      results.map(({ expected_changes, produced_svg, ...summary }) => summary),
    ]),
  );
};

const readJson = async <T>(p: string): Promise<T> =>
  JSON.parse(await fs.readFile(p, "utf-8")) as T;

const DIFFICULTY_ORDER: Record<string, number> = {
  very_easy: 0,
  easy: 1,
  medium: 2,
  hard: 3,
  very_hard: 4,
};

export const listTasks = async (): Promise<TaskSummary[]> => {
  const taskGroups = await Promise.all(
    TASKS_DIRS.map(async (tasksDir) => {
      const corpus = corpusForDir(tasksDir);
      const files = (await fs.readdir(tasksDir))
        .filter((f) => /^[a-z]+_\d+\.json$/.test(f));
      return Promise.all(
        files.map(async (f) => {
          const t = await readJson<Task>(path.join(tasksDir, f));
          return {
            task_id: t.task_id,
            difficulty: t.difficulty,
            category: t.category,
            instruction: t.instruction,
            parts: t.parts,
            initial_svg: t.initial_svg,
            corpus,
            display_order: t.display_order,
          };
        }),
      );
    }),
  );
  const tasks = taskGroups.flat();
  tasks.sort((a, b) => {
    const oa = Number.isFinite(a.display_order) ? a.display_order! : Number.MAX_SAFE_INTEGER;
    const ob = Number.isFinite(b.display_order) ? b.display_order! : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    const da = DIFFICULTY_ORDER[a.difficulty] ?? 99;
    const db = DIFFICULTY_ORDER[b.difficulty] ?? 99;
    if (da !== db) return da - db;
    return a.task_id.localeCompare(b.task_id);
  });
  return tasks;
};

export const getTask = async (id: string): Promise<Task | null> => {
  for (const tasksDir of TASKS_DIRS) {
    const p = path.join(tasksDir, `${id}.json`);
    try {
      return await readJson<Task>(p);
    } catch {
      // Try the next corpus directory.
    }
  }
  return null;
};

export const listIcons = async (): Promise<IconEntry[]> => {
  try {
    const idx = await readJson<{ icons: IconEntry[] }>(
      path.join(ICONS_DIR, "_index.json"),
    );
    return idx.icons;
  } catch {
    return [];
  }
};

export const getIcon = async (relPath: string): Promise<IconWithSvg | null> => {
  const icons = await listIcons();
  const entry = icons.find((i) => i.path === relPath);
  if (!entry) return null;
  const svg = await fs.readFile(path.join(ICONS_DIR, relPath), "utf-8");
  return { ...entry, svg };
};
