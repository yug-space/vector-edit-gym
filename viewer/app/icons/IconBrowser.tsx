"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { IconEntry } from "@/lib/data";

export function IconBrowser({ icons, sources }: { icons: IconEntry[]; sources: string[] }) {
  const [source, setSource] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return icons.filter((i) => {
      if (source && i.source !== source) return false;
      if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [icons, source, q]);

  return (
    <>
      <div className="theta-frame overflow-hidden">
        <div className="frame-header">
          <span>catalog filters</span>
          <span className="text-[var(--brand-strong)]">{filtered.length} shown</span>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search icons</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              className="h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]"
              placeholder="Search by icon name"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Icon source">
          <button
            className={source === null ? "theta-button theta-button-primary" : "theta-button"}
            onClick={() => setSource(null)}
            type="button"
          >
            All sources
          </button>
          {sources.map((item) => (
            <button
              key={item}
              className={source === item ? "theta-button theta-button-primary" : "theta-button"}
              onClick={() => setSource(item)}
              type="button"
            >
              {item}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.slice(0, 600).map((i) => (
          <Link
            key={i.path}
            href={`/icons/${encodeURIComponent(i.path)}`}
            className="svg-preview-tile group block"
          >
            <div className="flex aspect-square items-center justify-center bg-white p-4 text-[#222]">
              <IconThumb path={i.path} />
            </div>
            <div className="border-t border-[hsl(var(--border))] p-3">
              <div className="truncate font-mono text-xs font-medium">{i.name}</div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>{i.source}</span>
                <span aria-hidden="true">/</span>
                <span>{i.style}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length > 600 && (
        <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
          Showing first 600 of {filtered.length}. Narrow with filters above.
        </p>
      )}
    </>
  );
}

function IconThumb({ path }: { path: string }) {
  return (
    <img
      src={`/api/icon-raw?path=${encodeURIComponent(path)}`}
      alt={path}
      className="h-full w-full object-contain"
    />
  );
}
