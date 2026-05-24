"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TaskSummary } from "@/lib/data";

type Props = {
  tasks: TaskSummary[];
  categories: string[];
  difficulties: string[];
};

export function TaskFilters({ tasks, categories, difficulties }: Props) {
  const [cat, setCat] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);

  const filtered = useMemo(
    () => tasks.filter((t) => (!cat || t.category === cat) && (!diff || t.difficulty === diff)),
    [tasks, cat, diff],
  );

  return (
    <>
      <div className="filters">
        <Chip label={`difficulty: all`} active={diff === null} onClick={() => setDiff(null)} />
        {difficulties.map((d) => (
          <Chip key={d} label={d} active={diff === d} onClick={() => setDiff(d)} />
        ))}
      </div>
      <div className="filters">
        <Chip label={`category: all`} active={cat === null} onClick={() => setCat(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
        ))}
      </div>

      <div className="grid">
        {filtered.map((t) => (
          <Link key={t.task_id} href={`/tasks/${t.task_id}`} className="card">
            <div
              className="card-svg"
              dangerouslySetInnerHTML={{ __html: t.initial_svg }}
            />
            <div className="card-meta">
              <div className="card-id">{t.task_id}</div>
              <div className="card-instr">{t.instruction}</div>
              <div className="card-tags">
                <span className="tag">{t.difficulty}</span>
                <span className="tag">{t.category}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className="chip" data-active={active} onClick={onClick} type="button">
      {label}
    </button>
  );
}
