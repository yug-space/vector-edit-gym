"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { TaskModelResultSummary, TaskSummary } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

type Props = {
  tasks: TaskSummary[];
  modelResults: Record<string, TaskModelResultSummary[]>;
};

type Difficulty = "all" | "hard" | "very_hard";

export function TaskFilters({ tasks, modelResults }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (difficulty !== "all" && task.difficulty !== difficulty) return false;
      if (!needle) return true;
      return `${task.task_id} ${task.category} ${task.instruction}`.toLowerCase().includes(needle);
    });
  }, [tasks, difficulty, query]);

  return (
    <>
      <div className="theta-frame p-5">
        <div className="frame-header -mx-5 -mt-5 mb-5 px-5">
          <span>task filters</span>
          <span className="text-[var(--brand)]">{filtered.length} tasks</span>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search tasks</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scenes or repairs"
              className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--brand)]"
            />
          </label>
          <div className="inline-flex h-10 rounded-md border border-[hsl(var(--border))] bg-white p-1" aria-label="Difficulty">
            {(["all", "hard", "very_hard"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={
                  "rounded px-3 text-xs font-medium transition-colors " +
                  (difficulty === value
                    ? "bg-[hsl(var(--foreground))] text-white"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]")
                }
              >
                {value === "all" ? "All" : value.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mb-4 mt-6 mono-label">
        Showing <span className="text-[var(--brand)]">{filtered.length}</span> of {tasks.length}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="group block svg-preview-tile">
            <div
              className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white text-[#222]"
              dangerouslySetInnerHTML={{ __html: t.initial_svg }}
            />
            <div className="border-t border-[hsl(var(--border))] p-3">
              <div className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{t.task_id}</div>
              <div className="mt-1 line-clamp-2 text-sm">{t.instruction}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">{t.difficulty}</Badge>
                <Badge variant="outline">{t.category}</Badge>
              </div>
              <ModelResultChips results={modelResults[t.task_id] ?? []} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function ModelResultChips({ results }: { results: TaskModelResultSummary[] }) {
  if (results.length === 0) return null;

  const passes = results.filter((result) => result.reward === 1).length;
  const repairs = results.filter((result) => result.repair_pass).length;
  const clean = results.filter((result) => result.preservation_pass).length;
  const errors = results.filter((result) => result.status === "ERR").length;
  const averageEdit = results.reduce((sum, result) => sum + result.edit_completion, 0) / results.length;
  const averageUcr = results.reduce((sum, result) => sum + result.unintended_change_rate, 0) / results.length;

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
      <div className="mb-1 flex items-center justify-between gap-3 mono-label">
        <span>{results.length} model outputs</span>
        <span className="text-[var(--brand)]">{passes} pass</span>
      </div>
      <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        <span>{repairs} repaired</span>
        <span>{clean} clean</span>
        <span>{errors} errors</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        <span>edit {(averageEdit * 100).toFixed(0)}%</span>
        <span>ucr {(averageUcr * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}
