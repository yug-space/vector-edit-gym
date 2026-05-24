"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskSummary } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
          (!q || t.instruction.toLowerCase().includes(q.toLowerCase()) || t.task_id.toLowerCase().includes(q.toLowerCase())),
      ),
    [tasks, cat, diff, q],
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <Input
          placeholder="Search by id or instruction…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        <ChipRow label="Difficulty" value={diff} setValue={setDiff} options={difficulties} />
        <ChipRow label="Category" value={cat} setValue={setCat} options={categories} />
      </div>

      <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
        {filtered.length} of {tasks.length} shown
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((t) => (
          <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="group">
            <Card className="overflow-hidden transition-colors group-hover:border-[hsl(var(--foreground))]/30">
              <div
                className="flex aspect-square items-center justify-center bg-white text-[#222]"
                dangerouslySetInnerHTML={{ __html: t.initial_svg }}
              />
              <CardContent className="p-3">
                <div className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{t.task_id}</div>
                <div className="mt-1 line-clamp-2 text-sm">{t.instruction}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">{t.difficulty}</Badge>
                  <Badge variant="outline">{t.category}</Badge>
                </div>
              </CardContent>
            </Card>
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
      <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</span>
      <Button
        variant={value === null ? "default" : "outline"}
        size="sm"
        onClick={() => setValue(null)}
        className="h-7"
      >
        all
      </Button>
      {options.map((o) => (
        <Button
          key={o}
          variant={value === o ? "default" : "outline"}
          size="sm"
          onClick={() => setValue(o)}
          className="h-7"
        >
          {o}
        </Button>
      ))}
    </div>
  );
}
