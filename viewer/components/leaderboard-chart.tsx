"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type Plugin,
  type TooltipItem,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import type { LeaderboardEntry } from "@/lib/data";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Headline pass plus continuous repair progress and semantic preservation.
const METRIC_COLOR = {
  reward:       { bg: "rgba(249, 156, 0, 0.92)", border: "rgba(176, 103, 0, 1)" },
  edit:         { bg: "rgba(31, 31, 28, 0.88)",  border: "rgba(18, 18, 16, 1)" },
  preservation: { bg: "rgba(139, 136, 127, 0.78)", border: "rgba(98, 95, 88, 1)" },
};

// Draws "12.3%" at the end of each bar so 0%-valued bars (which would
// otherwise be invisible in a horizontal chart) are still legible.
const valueLabelPlugin: Plugin<"bar"> = {
  id: "valueLabel",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    chart.data.datasets.forEach((ds, dsIdx) => {
      const meta = chart.getDatasetMeta(dsIdx);
      meta.data.forEach((bar, i) => {
        const v = ds.data[i] as number;
        const label = `${v.toFixed(1)}%`;
        const isZero = v < 0.01;
        // For horizontal bars: x is the end of the bar (or the axis when 0).
        const { x, y } = bar.tooltipPosition(true);
        if (x == null || y == null) return;
        // If the bar has visible width, place label just past its end; otherwise
        // place at the axis with a small offset so 0% labels are visible.
        const base = (bar as { base?: number | null }).base;
        const barEnd = isZero ? (base ?? x) + 4 : x + 4;
        const colorByDataset = ["rgb(176, 103, 0)", "rgb(31, 31, 28)", "rgb(98, 95, 88)"];
        ctx.fillStyle = isZero ? "rgb(161, 161, 170)" : colorByDataset[dsIdx] ?? "rgb(39, 39, 42)";
        ctx.textAlign = "left";
        ctx.fillText(label, barEnd, y);
      });
    });
    ctx.restore();
  },
};

export function LeaderboardChart({ entries }: { entries: LeaderboardEntry[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const topEntries = entries.slice(0, 10);
    const labels = topEntries.map((e) => e.name);
    return {
      labels,
      datasets: [
        {
          label: "Full pass",
          data: topEntries.map((e) => +(e.specification_pass * 100).toFixed(1)),
          backgroundColor: METRIC_COLOR.reward.bg,
          borderColor: METRIC_COLOR.reward.border,
          borderWidth: 1,
          borderRadius: 2,
          barPercentage: 0.92,
          categoryPercentage: 0.78,
        },
        {
          label: "Repair progress",
          data: topEntries.map((e) => +(e.repair_progress * 100).toFixed(1)),
          backgroundColor: METRIC_COLOR.edit.bg,
          borderColor: METRIC_COLOR.edit.border,
          borderWidth: 1,
          borderRadius: 2,
          barPercentage: 0.92,
          categoryPercentage: 0.78,
        },
        {
          label: "Clean preservation",
          data: topEntries.map((e) => +(e.preservation_pass * 100).toFixed(1)),
          backgroundColor: METRIC_COLOR.preservation.bg,
          borderColor: METRIC_COLOR.preservation.border,
          borderWidth: 1,
          borderRadius: 2,
          barPercentage: 0.92,
          categoryPercentage: 0.78,
        },
      ],
    };
  }, [entries]);

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      indexAxis: "y", // horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 56, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 16,
            color: "rgb(63, 63, 70)",
            font: { size: 11, family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
            usePointStyle: true,
            pointStyle: "rectRounded",
          },
        },
        tooltip: {
          backgroundColor: "rgba(24, 24, 27, 0.96)",
          titleColor: "rgba(244, 244, 245, 1)",
          bodyColor: "rgba(228, 228, 231, 1)",
          padding: 12,
          cornerRadius: 6,
          displayColors: true,
          boxPadding: 6,
          callbacks: {
            label: (ctx: TooltipItem<"bar">) =>
              `${ctx.dataset.label}: ${(ctx.parsed.x as number).toFixed(1)}%`,
            afterBody: (items) => {
              const i = items[0]?.dataIndex;
              if (i === undefined) return "";
              const e = entries.slice(0, 10)[i];
              const details = [
                `Provider: ${e.provider}`,
                `Tasks run: ${e.tasks_run}`,
                `Date: ${e.date}`,
              ];
              details.push(
                `Valid-output UCR: ${e.unintended_change_rate === null ? "n/a" : `${(e.unintended_change_rate * 100).toFixed(1)}%`}`,
              );
              if (e.error_rate !== undefined) {
                details.push(`Errors: ${(e.error_rate * 100).toFixed(1)}%`);
              }
              if (e.mean_elapsed_ms !== undefined) {
                details.push(`Mean elapsed: ${fmtElapsed(e.mean_elapsed_ms)}`);
              }
              return details;
            },
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 25,
            color: "rgb(113, 113, 122)",
            font: { size: 11, family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
            callback: (v) => `${v}%`,
          },
          grid: { color: "rgba(228, 228, 231, 0.5)" },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: "rgb(24, 24, 27)",
            font: { size: 12, weight: 600, family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
            padding: 6,
            crossAlign: "far",
          },
          border: { display: false },
        },
      },
    }),
    [entries],
  );

  if (!mounted) {
    return <div className="h-[320px] w-full animate-pulse rounded-lg bg-[hsl(var(--muted))]/50" />;
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        No submissions yet.
      </div>
    );
  }

  const shown = Math.min(entries.length, 10);
  const rowPx = 66;
  const minHeight = 220;
  const height = Math.max(minHeight, shown * rowPx + 56);

  return (
    <div style={{ height }} className="w-full">
      <Bar data={data} options={options} plugins={[valueLabelPlugin]} />
    </div>
  );
}

function fmtElapsed(ms: number) {
  if (ms <= 0) return "n/a";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
