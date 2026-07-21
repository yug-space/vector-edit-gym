import { getModelResultSummaries, listTasks } from "@/lib/data";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, modelResults] = await Promise.all([
    listTasks(),
    getModelResultSummaries(),
  ]);

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="max-w-3xl">
          <p className="eyebrow">theta labs / task catalog</p>
          <h1 className="subheading mt-5">Browse the task catalog.</h1>
          <p className="section-copy mt-5">
            Forty dense SVG repair tasks with naturalistic visual instructions, hidden canonical
            targets, tolerant repair checks, and strict whole-document preservation.
          </p>
        </div>

        <div className="mt-10">
          <TaskFilters
            tasks={tasks}
            modelResults={modelResults}
          />
        </div>
      </div>
    </section>
  );
}
