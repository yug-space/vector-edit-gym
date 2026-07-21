import Link from "next/link";
import { ArrowRight, FileText, Mail } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaderboardChart } from "@/components/leaderboard-chart";
import { GithubMark } from "@/components/github-mark";
import { getLeaderboard, listTasks } from "@/lib/data";

export const dynamic = "force-dynamic";

const SUBMIT_MAILTO =
  "mailto:yug@thetalab.tech?subject=Vector-Bench%20leaderboard%20submission&body=" +
  encodeURIComponent(
    [
      "Model:",
      "Requested endpoint:",
      "Run name:",
      "Corpus hash:",
      "Tasks run:",
      "Specification pass rate:",
      "Near-complete rate:",
      "Repair progress:",
      "Semantic-preservation pass rate:",
      "Source-preservation pass rate:",
      "Unintended change rate:",
      "Preservation:",
      "Truncation rate:",
      "Error rate:",
      "Recorded cost:",
      "",
      "Reproduction (CLI + commit hash):",
    ].join("\n"),
  );

const AUTHORS = [
  { name: "Yug Aditi Gupta", email: "yug@thetalab.tech", affiliation: "Theta Labs" },
  { name: "Prannay Hebbar", email: "prannay@warping.co", affiliation: "Warping" },
];

export default async function HomePage() {
  const [board, tasks] = await Promise.all([getLeaderboard(), listTasks()]);

  return (
    <>
      <Hero
        totalTasks={tasks.length}
        totalEndpoints={board.entries.length}
        totalTraces={board.entries.reduce((sum, entry) => sum + entry.tasks_run, 0)}
      />

      <Section
        id="leaderboard"
        eyebrow="Results"
        title="Leaderboard"
        intro={`A repair can be approximate. Its side effects cannot. ${board.entries.length} model endpoints receive one scored outcome per task with no fallback routing. A full pass requires every requested repair within tolerance, a valid SVG, and semantic preservation outside the requested fields.`}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 mono-label">
            <span>Updated <span className="text-[var(--brand)]">{board.updated_at || "-"}</span></span>
            <span>Evaluator <span className="text-[hsl(var(--foreground))]">{board.evaluator ?? "-"}</span></span>
            <span>Corpus <span className="text-[hsl(var(--foreground))]">{board.corpus_hash?.slice(0, 12) ?? "-"}</span></span>
          </div>
          <a href={SUBMIT_MAILTO} className="theta-button theta-button-brand">
            <Mail className="h-4 w-4" />
            Submit your run
          </a>
        </div>

        <div className="theta-frame overflow-hidden">
          <div className="frame-header">
            <span>top ten / specification gates</span>
            <span className="text-[var(--brand-strong)]">higher is better</span>
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
                  <TableHead className="whitespace-nowrap text-right">Full pass</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Near</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Progress</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Clean</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Source</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valid UCR</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valid</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Target</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Truncated</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Errors</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Cost</TableHead>
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
                    <TableCell className="whitespace-nowrap text-right font-mono font-semibold">{fmtPct(e.specification_pass)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.near_pass)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.repair_progress)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.preservation_pass)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.source_preservation_pass)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtNullablePct(e.unintended_change_rate)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.validity)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtPct(e.structural)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtOptionalPct(e.truncation_rate)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">{fmtOptionalPct(e.error_rate)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono">${e.cost_usd.toFixed(3)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-mono text-sm">{e.tasks_run}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">{e.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-14 border-t border-[hsl(var(--border))] pt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">paper analysis</p>
              <h3 className="mt-3 text-2xl font-semibold">The binary score separates four distinct outcomes.</h3>
            </div>
            <a href="/vectoreditgym-paper.pdf" className="theta-button">
              <FileText className="h-4 w-4" />
              Full paper
            </a>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <figure className="border-t border-[hsl(var(--border))] pt-3 lg:col-span-2">
              <img src="/figures/gate-decomposition.png" alt="Mutually exclusive decomposition of benchmark outcomes by evaluation gate" className="mx-auto w-full max-w-4xl bg-white" />
              <figcaption className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Each output is assigned once: full pass, completed repair with side effects, valid incomplete repair, or invalid artifact.</figcaption>
            </figure>
            <figure className="border-t border-[hsl(var(--border))] pt-3">
              <img src="/figures/edit-completion-vs-ucr.png" alt="Scatter plot of repair progress against valid-output unintended change rate" className="w-full bg-white" />
              <figcaption className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Repair progress and collateral change on valid outputs are measured independently.</figcaption>
            </figure>
            <figure className="border-t border-[hsl(var(--border))] pt-3">
              <img src="/figures/quality-cost-pareto.png" alt="Scatter plot of model repair progress against benchmark run cost" className="w-full bg-white" />
              <figcaption className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Provider cost does not fully predict repair quality.</figcaption>
            </figure>
          </div>
        </div>
      </Section>

      <section id="team" className="section-pad team-band screen-line-after">
        <div className="page-shell">
          <div className="section-intro">
            <p className="eyebrow eyebrow-centered">Team</p>
            <h2 className="subheading mt-5">Shared research, shared material.</h2>
            <p className="section-copy mt-5">Vector-Bench and its paper are equal-contribution work by both authors.</p>
          </div>
          <div className="team-grid">
            {AUTHORS.map(({ name, email, affiliation }) => (
              <article key={email} className="team-member">
                <span className="team-initials" aria-hidden="true">{name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                <div>
                  <h3>{name}</h3>
                  <p>{affiliation}</p>
                  <a href={`mailto:${email}`}>{email}</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}

function Hero({ totalTasks, totalEndpoints, totalTraces }: { totalTasks: number; totalEndpoints: number; totalTraces: number }) {
  return (
    <section className="hero-band screen-line-after">
      <div className="page-shell hero-shell">
        <p className="eyebrow eyebrow-centered">A thetalab benchmark</p>
        <h1 className="hero-title"><span>Vector-</span><span>Bench</span></h1>
        <p className="hero-question">Can models surgically edit SVG code?</p>
        <p className="hero-copy">Natural-language repairs, hidden structural targets, and a binary specification reward that rejects collateral changes.</p>

        <div className="hero-actions">
            <Link href="/tasks" className="theta-button theta-button-brand">
              Browse tasks
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="/vectoreditgym-paper.pdf" className="theta-button">
              <FileText className="h-4 w-4" />
              Read the paper
            </a>
            <Link href="/traces" className="theta-button">Browse traces</Link>
        </div>

        <div className="hero-facts" aria-label="Benchmark summary">
          <HeroFact value={String(totalTasks)} label="tasks" />
          <HeroFact value="202" label="repairs" />
          <HeroFact value={String(totalEndpoints)} label="endpoints" />
          <HeroFact value={totalTraces.toLocaleString()} label="traces" />
        </div>
      </div>
    </section>
  );
}

function HeroFact({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
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
        <div className="section-intro">
          <p className="eyebrow eyebrow-centered">{eyebrow}</p>
          <h2 className="subheading mt-5">{title}</h2>
          <p className="section-copy mt-5">{intro}</p>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmtNullablePct(v: number | null) { return v === null ? "n/a" : fmtPct(v); }
function fmtOptionalPct(v?: number) { return v === undefined ? "-" : fmtPct(v); }
