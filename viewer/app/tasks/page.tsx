import Link from "next/link";
import { listTasks } from "@/lib/data";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await listTasks();
  const categories = Array.from(new Set(tasks.map((t) => t.category))).sort();
  const difficulties = Array.from(new Set(tasks.map((t) => t.difficulty))).sort();

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
          Each task is one corrupted SVG plus a natural-language fix instruction. Browse the {tasks.length}{" "}
          available below; click into one to see the corrupted input, the target, and the structured diff.
        </p>
      </div>
      <TaskFilters tasks={tasks} categories={categories} difficulties={difficulties} />
    </section>
  );
}
