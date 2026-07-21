"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleX,
  Clock3,
  Code2,
  FileDiff,
  Hash,
  Link2,
  ListTree,
  ShieldCheck,
} from "lucide-react";
import type {
  BenchmarkTrace,
  ModelExpectedChange,
  Task,
  TaskModelResult,
  TraceAttempt,
  TraceMessage,
} from "@/lib/data";

type Tab = "trace" | "verifier" | "artifacts";

type TimelineEvent = {
  id: string;
  label: string;
  title: string;
  kind: "start" | "message" | "provider" | "error" | "extract" | "verify" | "end";
  timestamp?: string | null;
  elapsed?: number | null;
  content: React.ReactNode;
};

export function TraceRun({ task, result }: { task: Task; result: TaskModelResult }) {
  const [tab, setTab] = useState<Tab>("trace");
  const [expanded, setExpanded] = useState(false);
  const trace = result.trace ?? fallbackTrace(task, result);
  const events = useMemo(
    () => buildTimeline(trace, task, result, expanded),
    [trace, task, result, expanded],
  );

  const jumpTo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = Number(data.get("event"));
    if (!Number.isInteger(target) || target < 1 || target > events.length) return;
    document.getElementById(events[target - 1].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="py-8 lg:py-10">
      <div className="mx-auto w-full max-w-[100rem] px-4 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-5">
          <Link href="/traces" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <ArrowLeft className="h-4 w-4" />
            All traces
          </Link>
          <Link href={`/tasks/${task.task_id}`} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Task details
          </Link>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)_250px]">
          <RunSummary task={task} result={result} trace={trace} />

          <main className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[hsl(var(--border))]">
              <div className="flex" role="tablist" aria-label="Trace views">
                <TabButton active={tab === "trace"} onClick={() => setTab("trace")} icon={<ListTree className="h-4 w-4" />}>
                  Run trace
                </TabButton>
                <TabButton active={tab === "verifier"} onClick={() => setTab("verifier")} icon={<ShieldCheck className="h-4 w-4" />}>
                  Verifier
                </TabButton>
                <TabButton active={tab === "artifacts"} onClick={() => setTab("artifacts")} icon={<FileDiff className="h-4 w-4" />}>
                  Artifacts
                </TabButton>
              </div>
              <span className="pb-3 font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                {trace.schema_version}
              </span>
            </div>

            {tab === "trace" && (
              <>
                <div className="my-5 flex flex-wrap items-center justify-between gap-3 border border-[hsl(var(--border))] bg-white px-4 py-3">
                  <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                    {events.length} events · {trace.attempts.length} provider attempt{trace.attempts.length === 1 ? "" : "s"}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <form onSubmit={jumpTo} className="flex items-center">
                      <label htmlFor="trace-jump" className="sr-only">Jump to event</label>
                      <input
                        id="trace-jump"
                        name="event"
                        type="number"
                        min={1}
                        max={events.length}
                        placeholder="event #"
                        className="h-8 w-24 border border-[hsl(var(--border))] bg-white px-2 font-mono text-xs outline-none focus:border-[var(--brand)]"
                      />
                    </form>
                    <label className="flex items-center gap-2 font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
                      <input
                        type="checkbox"
                        checked={expanded}
                        onChange={(event) => setExpanded(event.target.checked)}
                        className="accent-[var(--brand)]"
                      />
                      expand outputs
                    </label>
                  </div>
                </div>
                <Timeline events={events} />
              </>
            )}

            {tab === "verifier" && <VerifierView result={result} trace={trace} expanded={expanded} />}
            {tab === "artifacts" && <ArtifactView task={task} result={result} expanded={expanded} />}
          </main>

          <GateRail result={result} />
        </div>
      </div>
    </section>
  );
}

function RunSummary({ task, result, trace }: { task: Task; result: TaskModelResult; trace: BenchmarkTrace }) {
  return (
    <aside className="border border-[hsl(var(--border))] bg-white p-5 xl:sticky xl:top-24">
      <div className="border-b border-[hsl(var(--border))] pb-4">
        <div className="mono-label">{task.task_id} · {task.category}</div>
        <h1 className="mt-3 text-xl font-semibold leading-tight">{result.name}</h1>
        <p className="mt-1 break-all font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{result.model}</p>
      </div>

      <div className="border-b border-[hsl(var(--border))] py-5">
        <div className={"font-mono text-4xl font-semibold " + outcomeColor(result.status)}>
          {result.specification_pass ? "PASS" : `${(result.repair_progress * 100).toFixed(1)}%`}
        </div>
        <div className="mt-2 h-1.5 bg-zinc-100">
          <div className="h-full bg-[var(--brand)]" style={{ width: `${result.repair_progress * 100}%` }} />
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">
          {formatStatus(result.status)} · binary reward {result.reward}
        </p>
      </div>

      <dl className="space-y-2.5 border-b border-[hsl(var(--border))] py-5 font-mono text-[10px]">
        <Definition term="provider" value={result.provider} />
        <Definition term="resolved" value={result.resolved_model ?? "n/a"} breakAll />
        <Definition term="duration" value={formatElapsed(result.elapsed_ms)} />
        <Definition term="attempts" value={String(trace.attempts.length)} />
        <Definition term="cost" value={`$${result.cost_usd.toFixed(4)}`} />
        <Definition term="finish" value={result.finish_reason ?? "n/a"} />
      </dl>

      <div className="border-b border-[hsl(var(--border))] py-5">
        <div className="mono-label mb-3">Token usage</div>
        <dl className="space-y-2 font-mono text-[10px]">
          <Definition term="input" value={result.prompt_tokens.toLocaleString()} />
          <Definition term="output" value={result.completion_tokens.toLocaleString()} />
          <Definition term="reasoning" value={result.reasoning_tokens.toLocaleString()} />
          <Definition term="ceiling" value={result.max_output_tokens.toLocaleString()} />
        </dl>
      </div>

      <div className="pt-5">
        <div className="flex items-center justify-between gap-2">
          <span className="mono-label">retention</span>
          <span className={trace.retention === "complete" ? "text-emerald-700" : "text-orange-700"}>
            {trace.retention === "complete" ? "complete" : "legacy"}
          </span>
        </div>
        {trace.limitations.length > 0 && (
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            {trace.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        )}
        <div className="mt-4 break-all border-t border-[hsl(var(--border))] pt-3 font-mono text-[9px] text-[hsl(var(--muted-foreground))]">
          {trace.trace_id}
        </div>
      </div>
    </aside>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative ml-4 border-l border-[hsl(var(--border))] pb-4 sm:ml-20">
      {events.map((event, index) => (
        <article id={event.id} key={event.id} className="relative mb-4 pl-6 sm:pl-8">
          <div className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--brand)] ring-1 ring-[hsl(var(--border))]" />
          <div className="absolute right-[calc(100%+1.25rem)] top-3 hidden w-16 text-right font-mono text-[9px] text-[hsl(var(--muted-foreground))] sm:block">
            <div>#{index + 1}</div>
            <div className="mt-1">{event.elapsed == null ? "" : formatElapsed(event.elapsed)}</div>
          </div>
          <div className={"overflow-hidden border bg-white " + eventBorder(event.kind)}>
            <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <EventIcon kind={event.kind} />
                <span className="font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{event.label}</span>
                <span className="truncate text-sm font-medium">{event.title}</span>
              </div>
              <a href={`#${event.id}`} aria-label={`Link to event ${index + 1}`} className="shrink-0 text-zinc-400 hover:text-[var(--brand)]">
                <Link2 className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="p-4">{event.content}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function buildTimeline(trace: BenchmarkTrace, task: Task, result: TaskModelResult, expanded: boolean): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  events.push({
    id: "event-start",
    label: "start",
    title: "Evaluation request created",
    kind: "start",
    timestamp: trace.started_at,
    elapsed: 0,
    content: (
      <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
        <Definition term="model" value={trace.request.model ?? result.model} breakAll />
        <Definition term="endpoint" value={trace.request.base_url ?? "not recorded"} breakAll />
        <Definition term="max output" value={String(trace.request.max_output_tokens ?? result.max_output_tokens)} />
        <Definition term="temperature" value={String(trace.request.temperature ?? "provider_default")} />
      </dl>
    ),
  });

  trace.request.messages.forEach((message, index) => {
    events.push({
      id: `event-message-${index + 1}`,
      label: message.role,
      title: message.role === "system" ? "System instruction" : "Repair request and corrupted SVG",
      kind: "message",
      elapsed: 0,
      content: <TraceText value={resolveMessage(message, task)} expanded={expanded} />,
    });
  });

  trace.attempts.forEach((attempt) => {
    events.push(attemptEvent(attempt, expanded));
  });

  events.push({
    id: "event-extraction",
    label: "extract",
    title: trace.extraction.method ? `SVG extraction · ${trace.extraction.method}` : "SVG extraction",
    kind: "extract",
    elapsed: result.elapsed_ms,
    content: (
      <div>
        <dl className="mb-3 grid gap-2 font-mono text-xs sm:grid-cols-2">
          <Definition term="raw source" value={trace.extraction.raw_response_source ?? "recorded"} />
          <Definition term="parse" value={result.produced_parse_ok ? "parsed" : "failed"} />
        </dl>
        <TraceText value={resolveRawResponse(trace, result)} expanded={expanded} dark />
      </div>
    ),
  });

  result.expected_changes.forEach((check, index) => {
    events.push({
      id: `event-check-${index + 1}`,
      label: "verify",
      title: `${check.part}.${check.attribute}`,
      kind: check.passed ? "verify" : "error",
      elapsed: result.elapsed_ms,
      content: <RepairCheck check={check} />,
    });
  });

  events.push({
    id: "event-end",
    label: "end",
    title: `Outcome · ${formatStatus(result.status)}`,
    kind: "end",
    elapsed: result.elapsed_ms,
    content: (
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <OutcomeLine label="repairs" passed={result.repair_pass} value={`${result.expected_changes_passed}/${result.expected_changes_total}`} />
        <OutcomeLine label="preservation" passed={result.preservation_pass} value={formatPct(result.preservation)} />
        <OutcomeLine label="validity" passed={result.validity_pass} value={result.validity_pass ? "valid" : "invalid"} />
      </div>
    ),
  });
  return events;
}

function attemptEvent(attempt: TraceAttempt, expanded: boolean): TimelineEvent {
  const failed = attempt.error !== null;
  return {
    id: `event-attempt-${attempt.attempt}`,
    label: failed ? "retry" : "provider",
    title: failed ? `Attempt ${attempt.attempt} failed` : `Attempt ${attempt.attempt} response`,
    kind: failed ? "error" : "provider",
    timestamp: attempt.finished_at,
    elapsed: attempt.elapsed_ms,
    content: (
      <TraceText
        value={JSON.stringify(failed ? attempt.error : attempt.response, null, 2)}
        expanded={expanded}
        dark={!failed}
      />
    ),
  };
}

function VerifierView({ result, trace, expanded }: { result: TaskModelResult; trace: BenchmarkTrace; expanded: boolean }) {
  return (
    <div className="mt-5 space-y-5">
      <div className="border border-[hsl(var(--border))] bg-white">
        <div className="frame-header">
          <span>requested repair checks</span>
          <span className="text-[var(--brand)]">{result.expected_changes_passed}/{result.expected_changes_total}</span>
        </div>
        <div className="divide-y divide-[hsl(var(--border))] px-5">
          {result.expected_changes.map((check, index) => (
            <div key={`${check.part}-${check.attribute}-${index}`} className="py-4">
              <RepairCheck check={check} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <IssuePanel title="unexpected changes" items={result.unexpected_changed_parts} />
        <IssuePanel title="preservation failures" items={result.preservation_failures} />
      </div>

      <div className="border border-[hsl(var(--border))] bg-white">
        <div className="frame-header">
          <span>evaluator history</span>
          <span className="text-[hsl(var(--muted-foreground))]">{trace.evaluations.length} snapshot{trace.evaluations.length === 1 ? "" : "s"}</span>
        </div>
        <TraceText value={JSON.stringify(trace.evaluations, null, 2)} expanded={expanded} />
      </div>
    </div>
  );
}

function ArtifactView({ task, result, expanded }: { task: Task; result: TaskModelResult; expanded: boolean }) {
  const artifacts = [
    { label: "corrupted input", svg: task.initial_svg },
    { label: `${result.name} output`, svg: result.produced_svg },
    { label: "canonical target", svg: task.target_svg },
  ];
  return (
    <div className="mt-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {artifacts.map((artifact) => (
          <figure key={artifact.label} className="border border-[hsl(var(--border))] bg-white">
            <figcaption className="frame-header">{artifact.label}</figcaption>
            <div className="p-4">
              {artifact.svg ? (
                <img src={svgDataUri(artifact.svg)} alt={artifact.label} className="aspect-[4/3] w-full bg-white object-contain" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">No SVG</div>
              )}
            </div>
          </figure>
        ))}
      </div>
      <div className="mt-5 border border-[hsl(var(--border))] bg-white">
        <div className="frame-header"><span>raw model response</span><span>{result.finish_reason ?? "n/a"}</span></div>
        <TraceText value={formatResponseBody(result.raw_response ?? result.produced_svg)} expanded={expanded} dark />
      </div>
    </div>
  );
}

function GateRail({ result }: { result: TaskModelResult }) {
  const gates = [
    { label: "repair gate", value: formatPct(result.repair_progress), passed: result.repair_pass },
    { label: "preservation", value: formatPct(result.preservation), passed: result.preservation_pass },
    { label: "valid SVG", value: result.validity_pass ? "yes" : "no", passed: result.validity_pass },
    { label: "valid-output UCR", value: result.validity_pass ? formatPct(result.unintended_change_rate) : "n/a", passed: result.validity_pass && result.unintended_change_rate === 0 },
  ];
  return (
    <aside className="space-y-4 xl:sticky xl:top-24">
      <div className="mono-label px-1">Gate metrics</div>
      {gates.map((gate) => (
        <div key={gate.label} className="border border-[hsl(var(--border))] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{gate.label}</span>
            {gate.passed ? <Check className="h-4 w-4 text-emerald-700" /> : <CircleX className="h-4 w-4 text-rose-700" />}
          </div>
          <div className="mt-3 font-mono text-2xl">{gate.value}</div>
        </div>
      ))}
      <div className="border border-[hsl(var(--border))] bg-white p-4">
        <div className="mono-label">failure reasons</div>
        <div className="mt-3 space-y-2">
          {result.failure_reasons.length === 0 ? (
            <span className="text-sm text-emerald-700">None</span>
          ) : result.failure_reasons.map((reason) => (
            <div key={reason} className="break-words font-mono text-[10px] text-rose-700">{reason.replaceAll("_", " ")}</div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function TraceText({ value, expanded, dark = false }: { value: string; expanded: boolean; dark?: boolean }) {
  return (
    <pre className={`${expanded ? "max-h-none" : "max-h-80"} overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-relaxed ${dark ? "bg-zinc-950 text-zinc-200" : "bg-zinc-50 text-zinc-700"}`}>
      {value}
    </pre>
  );
}

function RepairCheck({ check }: { check: ModelExpectedChange }) {
  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-all font-mono text-sm">{check.part}.{check.attribute}</span>
        <span className={check.passed ? "text-emerald-700" : "text-rose-700"}>{check.passed ? "passed" : "missed"}</span>
      </div>
      <div className="mt-2 grid gap-2 text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
        <span className="break-all">expected {formatValue(check.expected_after)}</span>
        <span className="break-all">produced {formatValue(check.produced)}</span>
      </div>
      <div className="mt-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{formatComparison(check)}</div>
      <div className="mt-3 h-1.5 bg-zinc-100">
        <div className={"h-full " + (check.passed ? "bg-emerald-600" : "bg-[var(--brand)]")} style={{ width: `${Math.max(1, (check.progress ?? 0) * 100)}%` }} />
      </div>
    </div>
  );
}

function IssuePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-[hsl(var(--border))] bg-white p-5">
      <div className="mono-label">{title}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length === 0 ? <span className="text-sm text-emerald-700">None</span> : items.map((item) => (
          <span key={item} className="max-w-full break-all border border-[hsl(var(--border))] px-2 py-1 font-mono text-[10px]">{item}</span>
        ))}
      </div>
    </div>
  );
}

function OutcomeLine({ label, passed, value }: { label: string; passed: boolean; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {passed ? <Check className="h-4 w-4 text-emerald-700" /> : <CircleX className="h-4 w-4 text-rose-700" />}
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="ml-auto font-mono text-xs">{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm ${active ? "border-[var(--brand)] text-[hsl(var(--foreground))]" : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
    >
      {icon}{children}
    </button>
  );
}

function Definition({ term, value, breakAll = false }: { term: string; value: string; breakAll?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <dt className="uppercase text-[hsl(var(--muted-foreground))]">{term}</dt>
      <dd className={`text-right ${breakAll ? "break-all" : "truncate"}`}>{value}</dd>
    </div>
  );
}

function EventIcon({ kind }: { kind: TimelineEvent["kind"] }) {
  if (kind === "error") return <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />;
  if (kind === "verify" || kind === "end") return <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />;
  if (kind === "provider") return <Code2 className="h-4 w-4 shrink-0 text-[var(--brand)]" />;
  if (kind === "extract") return <FileDiff className="h-4 w-4 shrink-0 text-[var(--brand)]" />;
  if (kind === "start") return <Clock3 className="h-4 w-4 shrink-0 text-[var(--brand)]" />;
  return <Hash className="h-4 w-4 shrink-0 text-zinc-500" />;
}

function fallbackTrace(task: Task, result: TaskModelResult): BenchmarkTrace {
  return {
    schema_version: "legacy.viewer.v1",
    trace_id: `legacy:${result.model}:${task.task_id}`,
    retention: "legacy_final_record",
    limitations: ["structured attempt envelopes are unavailable for this legacy result"],
    request: {
      model: result.model,
      messages: [
        { role: "user", content: `Repair request:\n${task.instruction}\n\nCorrupted SVG:\n${task.initial_svg}` },
      ],
      max_output_tokens: result.max_output_tokens,
      temperature: "provider_default",
    },
    attempts: [
      {
        attempt: 1,
        elapsed_ms: result.elapsed_ms,
        response: result.error ? null : { id: result.response_id, model: result.resolved_model, content: result.raw_response ?? result.produced_svg },
        error: result.error,
        legacy_reconstruction: true,
      },
    ],
    extraction: {
      raw_response: result.raw_response ?? result.produced_svg,
      raw_response_source: result.raw_response ? "recorded" : "reconstructed_from_extracted_svg",
      produced_svg: result.produced_svg,
    },
    evaluations: [],
  };
}

function resolveMessage(message: TraceMessage, task: Task) {
  if (message.content !== null) return message.content;
  if (message.content_ref === "task.prompt") {
    return `Repair request:\n${task.instruction}\n\nCorrupted SVG:\n${task.initial_svg}`;
  }
  return `Referenced content: ${message.content_ref ?? "unavailable"}`;
}

function resolveRawResponse(trace: BenchmarkTrace, result: TaskModelResult) {
  if (trace.extraction.raw_response !== null && trace.extraction.raw_response !== undefined) {
    return formatResponseBody(trace.extraction.raw_response);
  }
  if (trace.extraction.raw_response_ref === "result.raw_response" && result.raw_response !== null) {
    return formatResponseBody(result.raw_response);
  }
  if (trace.extraction.raw_response_ref === "result.produced_svg" && result.produced_svg !== null) {
    return formatResponseBody(result.produced_svg);
  }
  return formatResponseBody(result.raw_response ?? result.produced_svg);
}

function formatResponseBody(value: string | null | undefined) {
  if (value === "") return "[empty response body]";
  return value ?? "[response body unavailable]";
}

function formatComparison(check: ModelExpectedChange) {
  if (check.distance !== null && check.tolerance !== null) {
    return `${check.comparison}: ${formatNumber(check.distance)} <= ${formatNumber(check.tolerance)} ${check.unit ?? ""} · ${formatPct(check.progress ?? 0)} repaired`.trim();
  }
  return check.detail ?? check.comparison;
}

function eventBorder(kind: TimelineEvent["kind"]) {
  if (kind === "error") return "border-rose-200";
  if (kind === "verify" || kind === "end") return "border-emerald-200";
  return "border-[hsl(var(--border))]";
}

function outcomeColor(status: TaskModelResult["status"]) {
  if (status === "PASS") return "text-emerald-700";
  if (status === "INVALID" || status === "ERR") return "text-rose-700";
  return "text-[var(--brand)]";
}

function formatStatus(status: string) { return status.replaceAll("_", " ").toLowerCase(); }
function formatPct(value: number) { return `${(value * 100).toFixed(1)}%`; }
function formatElapsed(ms: number) { return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`; }
function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }
function formatValue(value: unknown) {
  if (value === null || value === undefined) return "none";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}
function svgDataUri(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
