"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskSummary } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Props = {
  tasks: TaskSummary[];
  categories: string[];
  difficulties: string[];
};

export function TaskFilters({ tasks, categories, difficulties }: Props) {
  const [cat, setCat] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!cat || t.category === cat) &&
          (!diff || t.difficulty === diff) &&
          (!q ||
            t.instruction.toLowerCase().includes(q.toLowerCase()) ||
            t.task_id.toLowerCase().includes(q.toLowerCase())),
      ),
    [tasks, cat, diff, q],
  );

  return (
    <>
      <div className="theta-frame p-5">
        <div className="frame-header -mx-5 -mt-5 mb-5 px-5">
          <span>filter & search</span>
          <span className="text-[var(--brand)]">{filtered.length} / {tasks.length}</span>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            placeholder="Search by id or instruction…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
          <ChipRow label="Difficulty" value={diff} setValue={setDiff} options={difficulties} />
          <ChipRow label="Category" value={cat} setValue={setCat} options={categories} />
        </div>
      </div>

      <p className="mb-4 mt-6 mono-label">
        Showing <span className="text-[var(--brand)]">{filtered.length}</span> of {tasks.length}
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
                <Badge variant="secondary">{t.difficulty}</Badge>
                <Badge variant="outline">{t.category}</Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function ChipRow({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string | null;
  setValue: (v: string | null) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mono-label mr-1">{label}</span>
      <Chip active={value === null} onClick={() => setValue(null)}>
        all
      </Chip>
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => setValue(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-[color:color-mix(in_srgb,var(--brand)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand)] font-medium"
          : "border-[hsl(var(--border))] bg-white/70 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]/30 hover:text-[hsl(var(--foreground))]")
      }
    >
      {children}
    </button>
  );
}
