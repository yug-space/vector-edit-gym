"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
      <div className="filters">
        <button
          className="chip"
          data-active={source === null}
          onClick={() => setSource(null)}
          type="button"
        >
          source: all
        </button>
        {sources.map((s) => (
          <button
            key={s}
            className="chip"
            data-active={source === s}
            onClick={() => setSource(s)}
            type="button"
          >
            {s}
          </button>
        ))}
        <input
          className="chip"
          style={{ minWidth: 200 }}
          placeholder="search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted" style={{ alignSelf: "center" }}>
          {filtered.length} shown
        </span>
      </div>

      <div className="grid">
        {filtered.slice(0, 600).map((i) => (
          <Link
            key={i.path}
            href={`/icons/${encodeURIComponent(i.path)}`}
            className="card"
          >
            <div className="card-svg" style={{ padding: 12, color: "#222" }}>
              <IconThumb path={i.path} />
            </div>
            <div className="card-meta">
              <div className="card-id">{i.name}</div>
              <div className="card-tags">
                <span className="tag">{i.source}</span>
                <span className="tag">{i.style}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length > 600 && (
        <p className="muted" style={{ marginTop: 12 }}>
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
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}
