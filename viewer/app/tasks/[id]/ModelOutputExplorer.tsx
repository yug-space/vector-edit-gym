"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CircleX } from "lucide-react";
import type { TaskModelResult } from "@/lib/data";

export function ModelOutputExplorer({ results }: { results: TaskModelResult[] }) {
  const defaultModel = useMemo(
    () => [...results].sort((left, right) => right.reward - left.reward || right.edit_completion - left.edit_completion)[0]?.model,
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
                  <span className={selected.model === result.model ? "text-white" : statusText(result.status)}>{result.status}</span>
                  <span className={"block " + (selected.model === result.model ? "text-white/60" : "text-[hsl(var(--muted-foreground))]")}>edit {(result.edit_completion * 100).toFixed(0)}%</span>
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
              <span className={"rounded border px-2 py-1 font-mono text-xs " + statusBadge(selected.status)}>{selected.status}</span>
            </div>

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
                  <Metric label="reward" value={String(selected.reward)} />
                  <Metric label="edit" value={fmtPct(selected.edit_completion)} />
                  <Metric label="UCR" value={fmtPct(selected.unintended_change_rate)} />
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
                    </div>
                  ))}
                </div>

                <IssueList title="Unexpected changes" items={selected.unexpected_changed_parts} />
                <IssueList title="Preservation failures" items={selected.preservation_failures} />

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
  if (status === "ERR") return <CircleX className="h-5 w-5 text-rose-700" />;
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
  if (status === "ERR") return "text-rose-700";
  if (status === "PARTIAL") return "text-[var(--brand)]";
  return "text-[hsl(var(--muted-foreground))]";
}

function statusBadge(status: TaskModelResult["status"]) {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ERR") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "PARTIAL") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function fmtPct(value: number) { return `${(value * 100).toFixed(1)}%`; }
function fmtElapsed(ms: number) { return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`; }
function formatValue(value: unknown) {
  if (value === null || value === undefined) return "none";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
function svgDataUri(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
