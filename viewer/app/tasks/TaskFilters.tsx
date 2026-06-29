"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskModelResultSummary, TaskSummary } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

type Props = {
  tasks: TaskSummary[];
  counts: { v2: number; v1: number };
  modelResults: Record<string, TaskModelResultSummary[]>;
};

type Corpus = "v2" | "v1";

export function TaskFilters({ tasks, counts, modelResults }: Props) {
  const [corpus, setCorpus] = useState<Corpus>("v2");

  const filtered = useMemo(
    () => tasks.filter((t) => t.corpus === corpus),
    [tasks, corpus],
  );

  return (
    <>
      <div className="theta-frame p-5">
        <div className="frame-header -mx-5 -mt-5 mb-5 px-5">
          <span>corpus</span>
          <span className="text-[var(--brand)]">{filtered.length} tasks</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CorpusButton
            active={corpus === "v2"}
            label="V2 surgical"
            count={counts.v2}
            onClick={() => setCorpus("v2")}
          />
          <CorpusButton
            active={corpus === "v1"}
            label="V1 original"
            count={counts.v1}
            onClick={() => setCorpus("v1")}
          />
        </div>
      </div>

      <p className="mb-4 mt-6 mono-label">
        Showing <span className="text-[var(--brand)]">{corpus.toUpperCase()}</span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((t) => (
          <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="group block svg-preview-tile">
            <div
              className="flex aspect-square items-center justify-center bg-white text-[#222]"
              dangerouslySetInnerHTML={{ __html: t.initial_svg }}
            />
            <div className="border-t border-[hsl(var(--border))] p-3">
              <div className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{t.task_id}</div>
              <div className="mt-1 line-clamp-2 text-sm">{t.instruction}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">{t.corpus.toUpperCase()}</Badge>
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

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
      <div className="mb-1 mono-label">model outputs</div>
      <div className="flex flex-wrap gap-1.5">
        {results.map((result) => (
          <span
            key={result.model}
            className={
              "rounded-full border px-2 py-0.5 font-mono text-[10px] leading-4 " +
              statusClass(result.status)
            }
            title={`${result.name}: ${result.status}, expected changes ${result.expected_changes_passed}/${result.expected_changes_total}, preservation ${(result.preservation * 100).toFixed(1)}%`}
          >
            {shortName(result.name)} {result.status}
          </span>
        ))}
      </div>
    </div>
  );
}

function shortName(name: string) {
  if (name.includes("Pro")) return "G-Pro";
  if (name.includes("Flash")) return "G-Flash";
  if (name.includes("GPT")) return "GPT";
  return name;
}

function statusClass(status: TaskModelResultSummary["status"]) {
  switch (status) {
    case "EXACT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "STRUCT":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "PRES":
      return "border-[color:color-mix(in_srgb,var(--brand)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand)]";
    case "ERR":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

function CorpusButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-4 py-2 text-left transition-colors " +
        (active
          ? "border-[color:color-mix(in_srgb,var(--brand)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand)] font-medium"
          : "border-[hsl(var(--border))] bg-white/70 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]/30 hover:text-[hsl(var(--foreground))]")
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-1 block font-mono text-[11px]">{count} tasks</span>
    </button>
  );
}
