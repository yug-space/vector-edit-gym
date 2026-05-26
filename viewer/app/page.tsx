import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
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

function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const SUBMIT_MAILTO =
  "mailto:yug@thetalab.tech?subject=VectorEditGym%20leaderboard%20submission&body=" +
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

const AUTHORS = [
  { name: "Yug Aditi Gupta", email: "yug@thetalab.tech" },
  { name: "Prannay Hebber", email: null },
];

export default async function HomePage() {
  const [board, tasks] = await Promise.all([getLeaderboard(), listTasks()]);

  return (
    <>
      <Hero totalTasks={tasks.length} />

      <Section
        id="leaderboard"
        eyebrow="leaderboard"
        title="Where the frontier currently sits."
        intro="Manually curated runs from the Python SDK and our LiteLLM benchmark harness. Submit yours by email and we'll verify and add it."
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <span className="mono-label">
            Last updated <span className="text-[var(--brand)]">{board.updated_at || "—"}</span>
          </span>
          <a href={SUBMIT_MAILTO} className="theta-button theta-button-brand">
            <Mail className="h-4 w-4" />
            Submit your run
          </a>
        </div>

        <div className="theta-frame overflow-hidden">
          <div className="frame-header">
            <div className="signal-dots">
              <span className="signal-dot" />
              <span className="signal-dot signal-dot-brand" />
              <span className="signal-dot" />
            </div>
            <span>solver / scoreboard</span>
          </div>
          <div className="p-4 sm:p-6">
            <LeaderboardChart entries={board.entries} />
          </div>
        </div>

        <div className="theta-frame mt-6 overflow-hidden">
          <div className="frame-header">
            <span>full table</span>
            <span className="text-[var(--brand)]">{board.entries.length} entries</span>
          </div>
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
                    <TableCell className="font-mono text-xs">
                      <span className={e.rank === 1 ? "tag-orange" : ""}>
                        {e.rank === 1 ? `#${e.rank}` : e.rank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{e.name}</div>
                      {e.notes && (
                        <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{e.notes}</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                      {e.provider}
                    </TableCell>
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
        </div>
      </Section>

    </>
  );
}

function Hero({ totalTasks }: { totalTasks: number }) {
  return (
    <section className="screen-line-after">
      <div className="page-shell section-pad pt-12 md:pt-16">
        <div className="narrow-shell">
          <p className="eyebrow">theta labs / svg editing benchmark</p>
          <h1 className="section-heading mt-6">
            A benchmark for <span className="brand-underline italic">surgical</span> SVG editing.
          </h1>
          <p className="section-copy mt-6">
            Each task is one corrupted SVG plus a natural-language fix instruction. Models have to
            repair what is broken without touching anything else. Strict structural and preservation
            metrics catch stylistic drift, not just visual approximation.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/tasks" className="theta-button theta-button-primary">
              Browse {totalTasks} tasks
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#leaderboard" className="theta-button theta-button-brand">
              See the leaderboard
            </Link>
            <a
              href="https://github.com/yug-space/vector-edit-gym"
              target="_blank"
              rel="noreferrer"
              className="theta-button"
            >
              <GithubMark className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          <div className="mt-10">
            <p className="mono-label mb-3">authors</p>
            <div className="flex flex-wrap gap-3">
              {AUTHORS.map(({ name, email }) => (
                <div
                  key={name}
                  className="flex items-center gap-3 border border-[hsl(var(--border))] bg-white/75 px-3 py-2 rounded-full"
                >
                  <span className="brand-square" style={{ width: "1.75rem", height: "1.75rem", fontSize: "0.75rem" }}>
                    <span>{name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                  </span>
                  <span className="text-sm leading-tight">
                    <span className="font-medium">{name}</span>
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="ml-2 text-[hsl(var(--muted-foreground))] hover:text-[var(--brand)] transition-colors"
                      >
                        {email}
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="max-w-4xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="subheading mt-5">{title}</h2>
          <p className="section-copy mt-5">{intro}</p>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmtOptionalPct(v?: number) { return v === undefined ? "—" : fmtPct(v); }
function fmtLatency(ms?: number) {
  if (ms === undefined || ms <= 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
