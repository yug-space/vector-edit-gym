import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTask, getTaskModelResults, type DiffEntry, type TaskModelResult } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function TaskDetail({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [task, modelResults] = await Promise.all([
    getTask(id),
    getTaskModelResults(id),
  ]);
  if (!task) notFound();

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All tasks
        </Link>

        <div className="mb-6">
          <p className="eyebrow">theta labs / task</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-[hsl(var(--muted-foreground))]">{task.task_id}</span>
            <span className="tag-orange">{task.difficulty}</span>
            <Badge variant="outline">{task.category}</Badge>
          </div>
        </div>

        <div className="theta-frame mb-8 overflow-hidden">
          <div className="frame-header">
            <span>instruction</span>
            <span className="text-[var(--brand)]">natural language</span>
          </div>
          <p className="px-5 py-5 text-lg leading-relaxed">{task.instruction}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="theta-frame overflow-hidden">
            <div className="frame-header">
              <span>initial · broken</span>
              <span className="text-[hsl(var(--muted-foreground))]">input</span>
            </div>
            <div className="p-5">
              <div
                className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white text-[#222]"
                dangerouslySetInnerHTML={{ __html: task.initial_svg }}
              />
            </div>
          </div>

          <div className="theta-frame overflow-hidden">
            <div className="frame-header">
              <span>target · expected fix</span>
              <span className="text-[var(--brand)]">canonical</span>
            </div>
            <div className="p-5">
              <div
                className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white text-[#222]"
                dangerouslySetInnerHTML={{ __html: task.target_svg }}
              />
            </div>
          </div>
        </div>

        <ModelOutputs results={modelResults} />

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="theta-frame overflow-hidden">
            <div className="frame-header">
              <span>expected diff</span>
              <span className="text-[var(--brand)]">{task.expected_diff.length} edits</span>
            </div>
            <div className="p-2">
              <DiffTable diff={task.expected_diff} />
            </div>
          </div>

          <div className="theta-frame p-5">
            <div className="frame-header -mx-5 -mt-5 mb-5 px-5">
              <span>parts</span>
              <span className="text-[hsl(var(--muted-foreground))]">scope</span>
            </div>
            <div className="mb-4">
              <div className="mono-label mb-2">Target ({(task.target_parts ?? []).length})</div>
              <div className="flex flex-wrap gap-1">
                {(task.target_parts ?? []).length === 0 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                ) : (
                  (task.target_parts ?? []).map((p) => <Badge key={p} variant="default">{p}</Badge>)
                )}
              </div>
            </div>
            <div>
              <div className="mono-label mb-2">Should preserve ({task.should_preserve.length})</div>
              <div className="flex flex-wrap gap-1">
                {task.should_preserve.length === 0 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">no other parts in this scene</span>
                ) : (
                  task.should_preserve.map((p) => <Badge key={p} variant="outline">{p}</Badge>)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="code-panel">
            <div className="code-head">
              <span>initial svg</span>
              <span className="code-head-accent">source</span>
            </div>
            <pre>
              <code>{task.initial_svg}</code>
            </pre>
          </div>
          <div className="code-panel">
            <div className="code-head">
              <span>target svg</span>
              <span className="code-head-accent">source</span>
            </div>
            <pre>
              <code>{task.target_svg}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelOutputs({ results }: { results: TaskModelResult[] }) {
  if (results.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">published model outputs</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">What each model produced.</h2>
        </div>
        <span className="mono-label text-[var(--brand)]">{results.length} runs</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {results.map((result) => (
          <div key={result.model} className="theta-frame overflow-hidden">
            <div className="frame-header">
              <span>{result.name}</span>
              <span className={statusClass(result.status)}>{result.status}</span>
            </div>
            <div className="p-5">
              {result.error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {result.error}
                </div>
              ) : result.produced_svg ? (
                <img
                  alt={`${result.name} output`}
                  src={svgDataUri(result.produced_svg)}
                  className="mx-auto aspect-square w-full max-w-sm rounded-md border border-[hsl(var(--border))] bg-white object-contain p-2"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-md border border-[hsl(var(--border))] bg-white text-sm text-[hsl(var(--muted-foreground))]">
                  No SVG output.
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="exact" value={result.exact ? "yes" : "no"} />
                <Metric label="structural" value={result.structural ? "yes" : "no"} />
                <Metric label="preserve" value={fmtPct(result.preservation)} />
                <Metric label="latency" value={fmtLatency(result.elapsed_ms)} />
              </div>

              <div className="mt-4 rounded-md border border-[hsl(var(--border))] bg-white/70 p-3">
                <div className="mono-label mb-2">
                  expected changes {result.expected_changes_passed}/{result.expected_changes_total}
                </div>
                {result.expected_changes.length === 0 ? (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No expected-change checks.</p>
                ) : (
                  <div className="space-y-2">
                    {result.expected_changes.map((check, index) => (
                      <div key={`${check.part}-${check.attribute}-${index}`} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono">{check.part}.{check.attribute}</span>
                          <span className={check.passed ? "text-emerald-700" : "text-rose-700"}>
                            {check.passed ? "passed" : "missed"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[hsl(var(--muted-foreground))]">
                          expected {fmt(check.expected_after)} · got {fmt(check.produced)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <IssueList
                title="unexpected changes"
                items={result.unexpected_changed_parts}
                empty="none"
              />
              <IssueList
                title="preservation failures"
                items={result.preservation_failures}
                empty="none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-white/70 p-2">
      <div className="mono-label">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function IssueList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="mt-3">
      <div className="mono-label mb-1">{title}</div>
      {items.length === 0 ? (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{empty}</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <Badge key={item} variant="outline">{item}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffTable({ diff }: { diff: DiffEntry[] }) {
  if (diff.length === 0) {
    return <p className="px-3 py-4 text-sm text-[hsl(var(--muted-foreground))]">No diff entries.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Part</TableHead>
          <TableHead>Attr</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {diff.map((d, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs">{d.part}</TableCell>
            <TableCell className="font-mono text-xs">{d.attribute}</TableCell>
            <TableCell className="font-mono text-xs text-[hsl(var(--destructive))]">{fmt(d.before)}</TableCell>
            <TableCell className="font-mono text-xs text-[var(--brand)]">{fmt(d.after)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtLatency(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function statusClass(status: TaskModelResult["status"]) {
  switch (status) {
    case "EXACT":
      return "text-emerald-700";
    case "STRUCT":
      return "text-sky-700";
    case "PRES":
      return "text-[var(--brand)]";
    case "ERR":
      return "text-rose-700";
    default:
      return "text-[hsl(var(--muted-foreground))]";
  }
}
