import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaderboardChart } from "@/components/leaderboard-chart";
import { getLeaderboard, listTasks } from "@/lib/data";

export const dynamic = "force-dynamic";

const SUBMIT_MAILTO =
  "mailto:theta.computer01@gmail.com?subject=VectorEditGym%20leaderboard%20submission&body=" +
  encodeURIComponent(
    [
      "Model:",
      "Provider:",
      "Tasks run (split):",
      "Exact match:",
      "Structural match:",
      "Preservation:",
      "Expected changes:",
      "Error rate:",
      "Mean latency:",
      "",
      "Reproduction (CLI + commit hash):",
    ].join("\n"),
  );

export default async function HomePage() {
  const [board, tasks] = await Promise.all([getLeaderboard(), listTasks()]);

  return (
    <>
      {/* HERO -------------------------------------------------------------- */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <Badge variant="outline" className="mb-6">v0.1 · preview</Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            A benchmark for <span className="italic">surgical</span> SVG editing.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[hsl(var(--muted-foreground))]">
            Each task is one corrupted SVG plus a natural-language fix. Models have to repair what's
            broken without touching anything else. Strict structural and preservation metrics catch
            stylistic drift, not just visual approximation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/tasks">
                Browse tasks
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://github.com/yug-space/vector-edit-gym" target="_blank" rel="noreferrer">
                <GithubMark className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8">
            <Stat label="Tasks authored" value={tasks.length.toString()} />
            <Stat label="Icons in catalog" value="955" />
            <Stat label="Difficulty tiers" value="5" />
            <Stat label="Corruption types" value="10" />
          </div>
        </div>
      </section>

      {/* LEADERBOARD ------------------------------------------------------- */}
      <section id="leaderboard" className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Leaderboard</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Manually curated · last updated {board.updated_at || "—"}
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={SUBMIT_MAILTO}>
                <Mail />
                Submit your run
              </a>
            </Button>
          </div>

          <Card className="mb-6 p-6">
            <LeaderboardChart entries={board.entries} />
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] whitespace-nowrap">#</TableHead>
                    <TableHead className="min-w-[220px]">Solver</TableHead>
                    <TableHead className="whitespace-nowrap">Provider</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Exact</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Structural</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Preservation</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Expected changes</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Errors</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Mean latency</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Tasks</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.entries.map((e) => (
                    <TableRow key={`${e.rank}-${e.name}`}>
                      <TableCell className="font-mono text-xs">{e.rank}</TableCell>
                      <TableCell>
                        <div className="font-medium">{e.name}</div>
                        {e.notes && <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{e.notes}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">{e.provider}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.exact)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.structural)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.preservation)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtOptionalPct(e.expected_changes)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtOptionalPct(e.error_rate)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono">{fmtLatency(e.mean_latency_ms)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-sm">{e.tasks_run}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">{e.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="mt-6 rounded-lg border bg-[hsl(var(--muted))]/40 p-4 text-sm">
            <p className="font-medium">How to be added</p>
            <p className="mt-1 text-[hsl(var(--muted-foreground))]">
              Run the Python SDK or LiteLLM benchmark against the published task set, then email us your numbers
              + the CLI command + a commit hash. We re-run the oracle baseline against each submission for sanity
              and update this table by hand.
            </p>
            <pre className="mt-3 overflow-x-auto rounded bg-[hsl(var(--background))] p-3 font-mono text-xs">
{`pip install -e 'sdk/python[litellm]'
export LITELLM_BASE_URL=https://your-litellm-gateway.example
export LITELLM_API_KEY=...
python scripts/benchmark-litellm.py --models gemini/gemini-3-pro-preview gemini/gemini-3-flash-preview --save-svgs`}
            </pre>
          </div>
        </div>
      </section>

    </>
  );
}

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtOptionalPct(v?: number) {
  return v === undefined ? "—" : fmtPct(v);
}

function fmtLatency(ms?: number) {
  if (ms === undefined || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="text-sm text-[hsl(var(--muted-foreground))]">{label}</div>
    </div>
  );
}
