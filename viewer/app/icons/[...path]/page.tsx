import Link from "next/link";
import { notFound } from "next/navigation";
import { getIcon } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { path: string[] };

export default async function IconDetail({ params }: { params: Promise<Params> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  const icon = await getIcon(rel);
  if (!icon) notFound();

  return (
    <>
      <Link href="/icons" className="back-link">← Icon catalog</Link>
      <h1>
        {icon.name}{" "}
        <span className="tag">{icon.source}</span>{" "}
        <span className="tag">{icon.style}</span>
      </h1>
      <p className="muted">
        License: {icon.license} · <a href={icon.upstream} target="_blank" rel="noreferrer">upstream</a>
      </p>

      <div className="detail-grid">
        <div className="panel">
          <div className="panel-title">Rendered</div>
          <div className="panel-svg" dangerouslySetInnerHTML={{ __html: icon.svg }} />
        </div>
        <div className="panel">
          <div className="panel-title">Source</div>
          <pre className="code">{icon.svg}</pre>
        </div>
      </div>
    </>
  );
}
