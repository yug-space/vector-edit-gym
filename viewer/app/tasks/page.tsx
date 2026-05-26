import { getModelResultSummaries, listTasks } from "@/lib/data";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, modelResults] = await Promise.all([
    listTasks(),
    getModelResultSummaries(),
  ]);
  const categories = Array.from(new Set(tasks.map((t) => t.category))).sort();
  const difficulties = Array.from(new Set(tasks.map((t) => t.difficulty))).sort();

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="max-w-3xl">
          <p className="eyebrow">theta labs / task catalog</p>
          <h1 className="subheading mt-5">Browse the task catalog.</h1>
          <p className="section-copy mt-5">
            Each task is one corrupted SVG plus a natural-language fix instruction. Browse the{" "}
            <span className="text-[var(--brand)] font-medium">{tasks.length}</span> available below — click
            into one to see the corrupted input, the target, the structured diff, and what each published
            model produced.
          </p>
        </div>

        <div className="mt-10">
          <TaskFilters
            tasks={tasks}
            categories={categories}
            difficulties={difficulties}
            modelResults={modelResults}
          />
        </div>
      </div>
    </section>
  );
}
