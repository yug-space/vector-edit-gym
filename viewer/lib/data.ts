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
};

export type TaskSummary = Pick<
  Task,
  "task_id" | "difficulty" | "category" | "instruction" | "parts"
> & { initial_svg: string };

export type IconEntry = {
  source: string;
  style: string;
  name: string;
  path: string;
  license: string;
  upstream: string;
};

export type IconWithSvg = IconEntry & { svg: string };

const DATA_DIR =
  [
    path.resolve(process.cwd(), "viewer", "data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "..", "data"),
  ].find((candidate) => existsSync(candidate)) ??
  path.resolve(process.cwd(), "..", "data");
const TASKS_DIR = path.join(DATA_DIR, "tasks");
const ICONS_DIR = path.join(DATA_DIR, "icons");

export type LeaderboardEntry = {
  rank: number;
  name: string;
  provider: string;
  model: string;
  exact: number;
  structural: number;
  preservation: number;
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

export const getLeaderboard = async (): Promise<Leaderboard> => {
  const p = path.join(DATA_DIR, "leaderboard.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as Leaderboard;
  } catch {
    return { updated_at: "", note: "", entries: [] };
  }
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
  const files = (await fs.readdir(TASKS_DIR))
    .filter((f) => /^[a-z]+_\d+\.json$/.test(f));
  const tasks = await Promise.all(
    files.map(async (f) => {
      const t = await readJson<Task>(path.join(TASKS_DIR, f));
      return {
        task_id: t.task_id,
        difficulty: t.difficulty,
        category: t.category,
        instruction: t.instruction,
        parts: t.parts,
        initial_svg: t.initial_svg,
      };
    }),
  );
  tasks.sort((a, b) => {
    const da = DIFFICULTY_ORDER[a.difficulty] ?? 99;
    const db = DIFFICULTY_ORDER[b.difficulty] ?? 99;
    if (da !== db) return da - db;
    return a.task_id.localeCompare(b.task_id);
  });
  return tasks;
};

export const getTask = async (id: string): Promise<Task | null> => {
  const p = path.join(TASKS_DIR, `${id}.json`);
  try {
    return await readJson<Task>(p);
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
