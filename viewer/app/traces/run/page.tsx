import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTask, getTaskModelResults } from "@/lib/data";
import { TraceRun } from "./TraceRun";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run trace",
  description: "Inspect a complete Vector-Bench model request, response, extraction, and verifier trace.",
};

type SearchParams = {
  task?: string | string[];
  model?: string | string[];
};

export default async function TraceRunPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const taskId = typeof query.task === "string" ? query.task : "";
  const modelId = typeof query.model === "string" ? query.model : "";
  if (!/^sv_\d{3}$/.test(taskId) || !modelId) notFound();

  const [task, results] = await Promise.all([
    getTask(taskId),
    getTaskModelResults(taskId),
  ]);
  const result = results.find((candidate) => candidate.model === modelId);
  if (!task || !result) notFound();

  return <TraceRun task={task} result={result} />;
}
