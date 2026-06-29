import { getModelResultSummaries, listTasks } from "@/lib/data";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, modelResults] = await Promise.all([
    listTasks(),
    getModelResultSummaries(),
  ]);
  const v2Count = tasks.filter((t) => t.corpus === "v2").length;
  const v1Count = tasks.filter((t) => t.corpus === "v1").length;

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="max-w-3xl">
          <p className="eyebrow">theta labs / task catalog</p>
          <h1 className="subheading mt-5">Browse the task catalog.</h1>
          <p className="section-copy mt-5">
            V2 opens by default: scenic, surgical SVG repair tasks with exact local diffs and preservation
            checks. Switch to V1 at the top when you want the original icon corpus.
          </p>
        </div>

        <div className="mt-10">
          <TaskFilters
            tasks={tasks}
            counts={{ v2: v2Count, v1: v1Count }}
            modelResults={modelResults}
          />
        </div>
      </div>
    </section>
  );
}
