import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <section className="mx-auto max-w-6xl px-6 py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/tasks">
          <ArrowLeft />
          All tasks
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-[hsl(var(--muted-foreground))]">{task.task_id}</span>
        <Badge variant="secondary">{task.difficulty}</Badge>
        <Badge variant="outline">{task.category}</Badge>
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Instruction</div>
          <p className="mt-2 text-lg">{task.instruction}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Initial (broken)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-lg border bg-white text-[#222]"
              dangerouslySetInnerHTML={{ __html: task.initial_svg }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Target (expected fix)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-lg border bg-white text-[#222]"
              dangerouslySetInnerHTML={{ __html: task.target_svg }}
            />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-10" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expected diff</CardTitle>
          </CardHeader>
          <CardContent>
            <DiffTable diff={task.expected_diff} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Target ({(task.target_parts ?? []).length})</div>
              <div className="flex flex-wrap gap-1">
                {(task.target_parts ?? []).length === 0 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                ) : (
                  (task.target_parts ?? []).map((p) => (
                    <Badge key={p} variant="default">{p}</Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Should preserve ({task.should_preserve.length})</div>
              <div className="flex flex-wrap gap-1">
                {task.should_preserve.length === 0 ? (
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">no other parts in this scene</span>
                ) : (
                  task.should_preserve.map((p) => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-10" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Initial SVG source</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 font-mono text-xs">{task.initial_svg}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Target SVG source</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 font-mono text-xs">{task.target_svg}</pre>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function DiffTable({ diff }: { diff: DiffEntry[] }) {
  if (diff.length === 0) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">No diff entries.</p>;
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
            <TableCell className="font-mono text-xs text-[hsl(var(--success))]">{fmt(d.after)}</TableCell>
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
