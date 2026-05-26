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
import { getTask, type DiffEntry } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function TaskDetail({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const task = await getTask(id);
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
