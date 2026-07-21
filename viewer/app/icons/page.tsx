import { listIcons } from "@/lib/data";
import { IconBrowser } from "./IconBrowser";

export const dynamic = "force-dynamic";

export default async function IconsPage() {
  const icons = await listIcons();
  const sources = Array.from(new Set(icons.map((i) => i.source))).sort();
  return (
    <section className="section-pad screen-line-after">
      <div className="page-shell">
        <div className="section-intro">
          <p className="eyebrow eyebrow-centered">Source material</p>
          <h1 className="subheading mt-5">Open vector icon catalog.</h1>
          <p className="section-copy mt-5">
            {icons.length.toLocaleString()} source icons from Heroicons, Feather, and Iconify used
            to construct recognizable benchmark scenes and repair targets.
          </p>
        </div>
        <div className="mt-10">
          <IconBrowser icons={icons} sources={sources} />
        </div>
      </div>
    </section>
  );
}
