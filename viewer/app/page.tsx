import Link from "next/link";
import { listTasks } from "@/lib/data";
import { TaskFilters } from "./TaskFilters";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await listTasks();
  const categories = Array.from(new Set(tasks.map((t) => t.category))).sort();
  const difficulties = Array.from(new Set(tasks.map((t) => t.difficulty))).sort();

  return (
    <>
      <h1>Tasks <span className="muted">({tasks.length})</span></h1>
      <p className="muted" style={{ marginTop: -4, marginBottom: 16 }}>
        Each task pairs an initial SVG with an edit instruction, a target SVG, the structured diff,
        and the parts that must stay unchanged.
      </p>
      <TaskFilters tasks={tasks} categories={categories} difficulties={difficulties} />
    </>
  );
}
