// Server-only helpers: read tasks + icons off disk.
//
// The viewer is read-only: it loads the generator's JSON output. We keep the
// helpers narrow so swapping in a database later means changing just this
// module.

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
> & { initial_svg: string; display_order?: number };

export type IconEntry = {
  source: string;
  style: string;
  name: string;
  path: string;
  license: string;
  upstream: string;
};

export type IconWithSvg = IconEntry & { svg: string };

// `prepare-viewer-data.mjs` copies the release artifact into the Next app.
// Keeping this path rooted under the app prevents output tracing from walking
// the repository's ignored benchmark and development directories.
const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_DIR = path.join(DATA_DIR, "tasks");
const ICONS_DIR = path.join(DATA_DIR, "icons");
const MODEL_RESULTS_DIR = path.join(DATA_DIR, "model-results");

export type ModelGroup = "open-weight" | "cheap-control" | "frontier";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  provider: string;
  model: string;
  group: ModelGroup;
  specification_pass: number;
  reward: number;
  near_pass: number;
  repair_pass: number;
  preservation_pass: number;
  source_preservation_pass: number;
  exact: number;
  structural: number;
  validity: number;
  preservation: number;
  source_preservation: number;
  edit_completion: number;
  repair_progress: number;
  unintended_change_rate: number;
  error_rate?: number;
  truncation_rate?: number;
  mean_elapsed_ms?: number;
  cost_usd: number;
  tasks_run: number;
  submitted_by: string;
  date: string;
  notes?: string;
};

export type Leaderboard = {
  updated_at: string;
  note: string;
  protocol?: string;
  evaluator?: string;
  corpus_hash?: string;
  run?: string;
  entries: LeaderboardEntry[];
};

export type ModelRun = {
  name: string;
  provider: string;
  model: string;
  group: ModelGroup;
};

export type ModelExpectedChange = {
  part: string;
  attribute: string;
  expected_after: unknown;
  produced: unknown;
  passed: boolean;
  comparison: string;
  distance: number | null;
  tolerance: number | null;
  baseline_distance: number | null;
  progress: number | null;
  unit: string | null;
  detail: string | null;
};

export type TaskModelResult = {
  name: string;
  provider: string;
  model: string;
  resolved_model: string | null;
  response_id: string | null;
  group: ModelGroup;
  status: "PASS" | "NEAR" | "SIDE_EFFECTS" | "PARTIAL" | "INVALID" | "FAIL" | "ERR";
  reward: number;
  specification_pass: boolean;
  near_pass: boolean;
  repair_pass: boolean;
  preservation_pass: boolean;
  source_preservation_pass: boolean;
  validity_pass: boolean;
  exact: boolean;
  structural: boolean;
  edit_completion: number;
  repair_progress: number;
  preservation: number;
  source_preservation: number;
  unintended_change_rate: number;
  expected_changes_passed: number;
  expected_changes_total: number;
  expected_changes: ModelExpectedChange[];
  unexpected_changed_parts: string[];
  failure_reasons: string[];
  preservation_failures: string[];
  source_preservation_failures: string[];
  elapsed_ms: number;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  max_output_tokens: number;
  finish_reason: string | null;
  produced_parse_ok: boolean;
  produced_valid_svg: boolean;
  error: { code: string; message: string } | null;
  produced_svg: string | null;
  raw_response: string | null;
};

export type TaskModelResultSummary = Omit<
  TaskModelResult,
  "expected_changes" | "produced_svg" | "raw_response"
>;

export type ModelResults = {
  updated_at: string;
  note: string;
  protocol?: string;
  evaluator?: string;
  corpus_hash?: string;
  run?: string;
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

export const getTaskModelResults = async (id: string): Promise<TaskModelResult[]> => {
  if (!/^sv_\d{3}$/.test(id)) return [];
  try {
    return await readJson<TaskModelResult[]>(path.join(MODEL_RESULTS_DIR, `${id}.json`));
  } catch {
    return [];
  }
};

export const getModelResultSummaries = async (): Promise<Record<string, TaskModelResultSummary[]>> => {
  try {
    const modelResults = await readJson<ModelResults>(path.join(DATA_DIR, "model-results-summary.json"));
    return modelResults.results;
  } catch {
    return {};
  }
};

const readJson = async <T>(p: string): Promise<T> =>
  JSON.parse(await fs.readFile(p, "utf-8")) as T;

const DIFFICULTY_ORDER: Record<string, number> = {
  hard: 0,
  very_hard: 1,
};

export const listTasks = async (): Promise<TaskSummary[]> => {
  const files = (await fs.readdir(TASKS_DIR)).filter((f) => /^sv_\d{3}\.json$/.test(f));
  const tasks = await Promise.all(files.map(async (file) => {
    const task = await readJson<Task>(path.join(TASKS_DIR, file));
    return {
      task_id: task.task_id,
      difficulty: task.difficulty,
      category: task.category,
      instruction: task.instruction,
      parts: task.parts,
      initial_svg: task.initial_svg,
      display_order: task.display_order,
    };
  }));
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
  if (!/^sv_\d{3}$/.test(id)) return null;
  try {
    return await readJson<Task>(path.join(TASKS_DIR, `${id}.json`));
  } catch {
    return null;
  }
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
