import { listIcons } from "@/lib/data";
import { IconBrowser } from "./IconBrowser";

export const dynamic = "force-dynamic";

export default async function IconsPage() {
  const icons = await listIcons();
  const sources = Array.from(new Set(icons.map((i) => i.source))).sort();
  return (
    <>
      <h1>Icon catalog <span className="muted">({icons.length})</span></h1>
      <p className="muted" style={{ marginTop: -4, marginBottom: 16 }}>
        Raw open-source icons scraped from Heroicons, Feather, and Iconify. These are the seed
        material for harder tasks that need real-world icons (house, door, window, …).
      </p>
      <IconBrowser icons={icons} sources={sources} />
    </>
  );
}
