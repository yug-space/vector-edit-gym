"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleX, ListTree } from "lucide-react";
import type { TaskModelResult } from "@/lib/data";

export function ModelOutputExplorer({ results }: { results: TaskModelResult[] }) {
  const defaultModel = useMemo(
    () => [...results].sort((left, right) =>
      right.reward - left.reward
      || Number(right.near_pass) - Number(left.near_pass)
      || Number(right.repair_pass) - Number(left.repair_pass)
      || right.repair_progress - left.repair_progress,
    )[0]?.model,
    [results],
  );
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const selected = results.find((result) => result.model === selectedModel) ?? results[0];
  if (!selected) return null;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">published model outputs</p>
          <h2 className="mt-3 text-2xl font-semibold">What each model produced.</h2>
        </div>
        <span className="mono-label text-[var(--brand)]">{results.length} endpoints</span>
      </div>

      <div className="theta-frame overflow-hidden">
        <div className="frame-header">
          <span>model result explorer</span>
          <span className="text-[var(--brand)]">{selected.name}</span>
        </div>
        <div className="grid min-h-[680px] lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="max-h-[320px] overflow-y-auto border-b border-[hsl(var(--border))] bg-white/55 lg:max-h-[680px] lg:border-b-0 lg:border-r">
            {results.map((result) => (
                <button
                  key={result.model}
                  type="button"
                  aria-pressed={selected.model === result.model}
                  onClick={() => setSelectedModel(result.model)}
                className={
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[hsl(var(--border))] px-4 py-3 text-left transition-colors last:border-b-0 " +
                  (selected.model === result.model ? "bg-[hsl(var(--foreground))] text-white" : "hover:bg-white")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{result.name}</span>
                  <span className={"mt-1 block truncate font-mono text-[10px] " + (selected.model === result.model ? "text-white/60" : "text-[hsl(var(--muted-foreground))]")}>{result.provider}</span>
                </span>
                <span className="text-right font-mono text-[10px] leading-5">
                  <span className={selected.model === result.model ? "text-white" : statusText(result.status)}>{formatStatus(result.status)}</span>
                  <span className={"block " + (selected.model === result.model ? "text-white/60" : "text-[hsl(var(--muted-foreground))]")}>progress {(result.repair_progress * 100).toFixed(0)}%</span>
                </span>
              </button>
            ))}
          </div>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <StatusIcon status={selected.status} />
                  <h3 className="text-xl font-semibold">{selected.name}</h3>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{selected.model}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/traces/run?task=${encodeURIComponent(selected.task_id)}&model=${encodeURIComponent(selected.model)}`}
                  className="theta-button min-h-8 px-2.5 py-1 font-mono text-[10px] uppercase"
                >
                  <ListTree className="h-3.5 w-3.5" />
                  Trace
                </Link>
                <span className={"rounded border px-2 py-1 font-mono text-xs " + statusBadge(selected.status)}>{formatStatus(selected.status)}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 border-l border-t border-[hsl(var(--border))] xl:grid-cols-5">
              <Gate
                label="requested repairs"
                passed={selected.repair_pass}
                value={`${selected.expected_changes_passed}/${selected.expected_changes_total}`}
              />
              <Gate
                label="semantic preservation"
                passed={selected.preservation_pass}
                value={selected.preservation_pass ? "clean" : "changed"}
              />
              <Gate
                label="SVG validity"
                passed={selected.validity_pass}
                value={selected.validity_pass ? "valid" : "invalid"}
              />
              <Gate
                label="source fidelity"
                passed={selected.source_preservation_pass}
                value="unchanged"
                diagnostic
              />
              <Gate
                label="target match"
                passed={selected.structural}
                value="match"
                diagnostic
              />
            </div>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Full pass requires the first three gates. Source fidelity and canonical target match are diagnostics only.
            </p>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(340px,1.1fr)]">
              <div>
                {selected.error ? (
                  <div className="flex min-h-[320px] items-center justify-center border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
                    <div>
                      <div className="font-mono text-xs uppercase">{selected.error.code}</div>
                      <p className="mt-2">{selected.error.message}</p>
                    </div>
                  </div>
                ) : selected.produced_parse_ok && selected.produced_svg ? (
                  <img
                    alt={`${selected.name} output`}
                    src={svgDataUri(selected.produced_svg)}
                    className="aspect-[4/3] w-full border border-[hsl(var(--border))] bg-white object-contain p-2"
                  />
                ) : selected.raw_response ? (
                  <pre className="min-h-[320px] max-h-[420px] overflow-auto whitespace-pre-wrap break-all border border-[hsl(var(--border))] bg-white p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {selected.raw_response}
                  </pre>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center border border-[hsl(var(--border))] bg-white text-sm text-[hsl(var(--muted-foreground))]">No SVG output</div>
                )}

                <div className="mt-4 grid grid-cols-2 border-l border-t border-[hsl(var(--border))] sm:grid-cols-3">
                  <Metric label="outcome" value={formatOutcome(selected.status)} />
                  <Metric label="progress" value={fmtPct(selected.repair_progress)} />
                  <Metric
                    label="UCR"
                    value={selected.validity_pass ? fmtPct(selected.unintended_change_rate) : "n/a"}
                  />
                  <Metric label="preserve" value={fmtPct(selected.preservation)} />
                  <Metric label="elapsed" value={fmtElapsed(selected.elapsed_ms)} />
                  <Metric label="cost" value={`$${selected.cost_usd.toFixed(4)}`} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-2">
                  <span className="mono-label">requested repairs</span>
                  <span className="font-mono text-xs text-[var(--brand)]">{selected.expected_changes_passed}/{selected.expected_changes_total}</span>
                </div>
                <div className="divide-y divide-[hsl(var(--border))]">
                  {selected.expected_changes.map((check, index) => (
                    <div key={`${check.part}-${check.attribute}-${index}`} className="py-3 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-all font-mono">{check.part}.{check.attribute}</span>
                        <span className={check.passed ? "text-emerald-700" : "text-rose-700"}>{check.passed ? "passed" : "missed"}</span>
                      </div>
                      <div className="mt-1 break-all text-[hsl(var(--muted-foreground))]">expected {formatValue(check.expected_after)} / produced {formatValue(check.produced)}</div>
                      <div className="mt-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                        {formatComparison(check)}
                      </div>
                      {check.progress !== null && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-100" aria-label={`Repair progress ${fmtPct(check.progress)}`}>
                          <div
                            className={"h-full " + (check.passed ? "bg-emerald-600" : "bg-[var(--brand)]")}
                            style={{ width: `${Math.max(2, check.progress * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selected.specification_pass ? (
                  <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
                    <div className="mono-label">Specification outcome</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
                      <Check className="h-4 w-4" />
                      All required gates passed.
                    </div>
                  </div>
                ) : (
                  <IssueList title="Why it did not pass" items={selected.failure_reasons.map(formatFailureReason)} />
                )}
                <IssueList title="Unexpected changes" items={selected.unexpected_changed_parts} />
                <IssueList title="Semantic preservation failures" items={selected.preservation_failures} />
                <IssueList title="Source fidelity diagnostics" items={selected.source_preservation_failures} />

                <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-[hsl(var(--border))] pt-4 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  <span>prompt {selected.prompt_tokens.toLocaleString()} tok</span>
                  <span>output {selected.completion_tokens.toLocaleString()} tok</span>
                  <span>reasoning {selected.reasoning_tokens.toLocaleString()} tok</span>
                  <span>ceiling {selected.max_output_tokens.toLocaleString()} tok</span>
                  <span>finish {selected.finish_reason ?? "n/a"}</span>
                  <span>{selected.group.replace("-", " ")}</span>
                </div>
                <div className="mt-3 space-y-1 border-t border-[hsl(var(--border))] pt-3 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  <p className="break-all">resolved {selected.resolved_model ?? "n/a"}</p>
                  <p className="break-all">response {selected.response_id ?? "n/a"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TaskModelResult["status"] }) {
  if (status === "PASS") return <Check className="h-5 w-5 text-emerald-700" />;
  if (status === "ERR" || status === "INVALID") return <CircleX className="h-5 w-5 text-rose-700" />;
  return <AlertTriangle className="h-5 w-5 text-[var(--brand)]" />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-r border-[hsl(var(--border))] bg-white px-3 py-2.5">
      <div className="mono-label">{label}</div>
      <div className="mt-1 truncate font-mono text-sm">{value}</div>
    </div>
  );
}

function Gate({
  label,
  passed,
  value,
  diagnostic = false,
}: {
  label: string;
  passed: boolean;
  value: string;
  diagnostic?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-r border-[hsl(var(--border))] bg-white px-3 py-3">
      <div className="flex items-center gap-2">
        {passed ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-700" />
        ) : (
          <CircleX className={"h-4 w-4 shrink-0 " + (diagnostic ? "text-zinc-400" : "text-rose-700")} />
        )}
        <span className="truncate font-mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{label}</span>
      </div>
      <div className={"mt-1 pl-6 font-mono text-xs " + (passed ? "text-emerald-700" : diagnostic ? "text-zinc-500" : "text-rose-700")}>
        {passed ? value : diagnostic ? "different" : value}
      </div>
    </div>
  );
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
      <div className="mono-label">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">None</span>
        ) : items.map((item) => (
          <span key={item} className="max-w-full break-all rounded border border-[hsl(var(--border))] bg-white px-2 py-1 font-mono text-[10px]">{item}</span>
        ))}
      </div>
    </div>
  );
}

function statusText(status: TaskModelResult["status"]) {
  if (status === "PASS") return "text-emerald-700";
  if (status === "ERR" || status === "INVALID") return "text-rose-700";
  if (status === "NEAR" || status === "PARTIAL" || status === "SIDE_EFFECTS") return "text-[var(--brand)]";
  return "text-[hsl(var(--muted-foreground))]";
}

function statusBadge(status: TaskModelResult["status"]) {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ERR" || status === "INVALID") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "NEAR" || status === "PARTIAL" || status === "SIDE_EFFECTS") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function fmtPct(value: number) { return `${(value * 100).toFixed(1)}%`; }
function fmtElapsed(ms: number) { return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`; }
function formatValue(value: unknown) {
  if (value === null || value === undefined) return "none";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
function formatStatus(status: TaskModelResult["status"]) {
  return status.replace("_", " ");
}
function formatOutcome(status: TaskModelResult["status"]) {
  return status === "ERR" ? "error" : formatStatus(status).toLowerCase();
}
function formatComparison(check: TaskModelResult["expected_changes"][number]) {
  if (check.distance !== null && check.tolerance !== null) {
    const progress = check.progress === null ? "" : ` / ${fmtPct(check.progress)} repaired`;
    return `${check.comparison}: ${formatNumber(check.distance)} <= ${formatNumber(check.tolerance)} ${check.unit ?? ""}${progress}`.trim();
  }
  return check.detail ?? check.comparison;
}
function formatFailureReason(reason: string) {
  const labels: Record<string, string> = {
    invalid_svg: "invalid SVG",
    requested_repairs_incomplete: "requested repairs incomplete",
    unintended_document_changes: "unintended document changes",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}
function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
function svgDataUri(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
