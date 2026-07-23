import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getIcon } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { path: string[] };

export default async function IconDetail({ params }: { params: Promise<Params> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  const icon = await getIcon(rel);
  if (!icon) notFound();

  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <Link href="/icons" className="mb-6 inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ArrowLeft className="h-4 w-4" />
          Icon catalog
        </Link>
        <p className="eyebrow">source asset</p>
        <h1 className="mt-4 font-mono text-3xl font-semibold">{icon.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="tag-orange">{icon.source}</span>
          <span className="tag-orange">{icon.style}</span>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">License: {icon.license}</span>
          <a href={icon.upstream} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--brand-strong)]">
            Upstream <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="bench-frame overflow-hidden">
            <div className="frame-header"><span>rendered icon</span><span>{icon.style}</span></div>
            <div className="flex aspect-square items-center justify-center bg-white p-12 text-[#222]" dangerouslySetInnerHTML={{ __html: icon.svg }} />
          </div>
          <div className="code-panel">
            <div className="code-head"><span>svg source</span><span className="code-head-accent">read only</span></div>
            <pre><code>{icon.svg}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
