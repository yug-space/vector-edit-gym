import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ListTree } from "lucide-react";
import { getTaskModelResults, listTasks } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run traces",
  description: "Browse request, response, extraction, and verifier traces for every published Vector-Bench outcome.",
};

type SearchParams = { task?: string | string[] };

export default async function TraceIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const tasks = await listTasks();
  const requested = typeof query.task === "string" ? query.task : "";
  const selectedTask = tasks.find((task) => task.task_id === requested) ?? tasks[0];
  const results = selectedTask ? await getTaskModelResults(selectedTask.task_id) : [];

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[hsl(var(--border))] pb-7">
          <div>
            <p className="eyebrow">published execution records</p>
            <h1 className="mt-5 text-4xl font-semibold">Run traces</h1>
            <p className="section-copy mt-4">
              Request, provider attempt, extraction, and verifier events for every published model-task outcome.
            </p>
          </div>
          <form action="/traces" className="flex items-end gap-2">
            <label className="block">
              <span className="mono-label mb-2 block">Task</span>
              <select
                name="task"
                defaultValue={selectedTask?.task_id}
                className="h-10 min-w-40 border border-[hsl(var(--border))] bg-white px-3 font-mono text-xs outline-none focus:border-[var(--brand)]"
              >
                {tasks.map((task) => <option key={task.task_id} value={task.task_id}>{task.task_id} · {task.category}</option>)}
              </select>
            </label>
            <button type="submit" className="theta-button theta-button-primary">Load</button>
          </form>
        </div>

        {selectedTask && (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mono-label">{selectedTask.task_id} · {selectedTask.difficulty}</div>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{selectedTask.instruction}</p>
              </div>
              <span className="font-mono text-xs text-[var(--brand)]">{results.length} traces</span>
            </div>

            <div className="overflow-x-auto border border-[hsl(var(--border))] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="border-b border-[hsl(var(--border))] bg-zinc-50 font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-4 py-3 font-medium">Retention</th>
                    <th className="px-4 py-3 font-medium" aria-label="Open trace" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {results.map((result) => (
                    <tr key={result.model} className="hover:bg-zinc-50/70">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{result.name}</div>
                        <div className="mt-1 break-all font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{result.model}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{result.status.replaceAll("_", " ").toLowerCase()}</td>
                      <td className="px-4 py-3 font-mono text-xs">{(result.repair_progress * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 font-mono text-xs">{result.trace?.attempts.length ?? 1}</td>
                      <td className="px-4 py-3 font-mono text-[10px] uppercase">{result.trace?.retention === "complete" ? "complete" : "legacy"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/traces/run?task=${encodeURIComponent(selectedTask.task_id)}&model=${encodeURIComponent(result.model)}`}
                          className="theta-button min-h-8 px-2.5 py-1"
                          aria-label={`Open ${result.name} trace`}
                        >
                          <ListTree className="h-3.5 w-3.5" />
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
