// Scrape real-world SVG icons from open-source libraries.
//
// Sources:
//   - Heroicons (MIT, tailwindlabs/heroicons) — 24x24 outline + solid
//   - Feather   (MIT, feathericons/feather)   — 24x24 outline
//   - Iconify   (various FOSS licenses)        — selected utility sets
//
// We fetch GitHub's git tree API to list files, then fetch the raw SVGs.
// All icons land in data/icons/<source>/ with a sibling _index.json carrying
// provenance metadata.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(__dirname, "..", "data", "icons");

const UA = { "User-Agent": "VectorEditGym/0.1" };

// -- Heroicons --------------------------------------------------------------

const HEROICONS_REPO = "tailwindlabs/heroicons";
const HEROICONS_REF = "master";
const HEROICONS_PATHS = [
  "optimized/24/outline",
  "optimized/24/solid",
];

// -- Feather ----------------------------------------------------------------

const FEATHER_REPO = "feathericons/feather";
const FEATHER_REF = "main";
const FEATHER_PATH = "icons";

// -- Iconify ----------------------------------------------------------------
// Pull a small, hand-picked set of common icons that have semantically
// meaningful parts (house, door, etc.) — these are useful for harder tasks
// later. We use the Iconify public API (api.iconify.design).

const ICONIFY_PICKS = [
  // material symbols outlined
  "material-symbols:home-outline",
  "material-symbols:door-front-outline",
  "material-symbols:window-outline",
  "material-symbols:traffic-outline",
  "material-symbols:directions-car-outline",
  "material-symbols:flag-outline",
  "material-symbols:location-on-outline",
  "material-symbols:settings-outline",
  "material-symbols:shopping-cart-outline",
  "material-symbols:calendar-month-outline",
  // mdi
  "mdi:robot-outline",
  "mdi:emoticon-happy-outline",
  "mdi:tree-outline",
  "mdi:flower-outline",
  "mdi:car",
  "mdi:bus",
  "mdi:bicycle",
  // tabler
  "tabler:home",
  "tabler:tree",
  "tabler:flag",
];

// ---------------------------------------------------------------------------

const fetchJson = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const fetchText = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

const listGithubDir = async (repo, ref, path) => {
  // https://docs.github.com/en/rest/repos/contents
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`;
  const data = await fetchJson(url);
  return data.filter((d) => d.type === "file" && d.name.endsWith(".svg"));
};

const writeIcon = (dir, name, svg, meta) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.svg`), svg);
  return meta;
};

const scrapeHeroicons = async () => {
  const out = [];
  for (const sub of HEROICONS_PATHS) {
    const style = sub.split("/").pop(); // outline / solid
    const files = await listGithubDir(HEROICONS_REPO, HEROICONS_REF, sub);
    const dir = join(OUT_ROOT, "heroicons", style);
    for (const f of files) {
      const svg = await fetchText(f.download_url);
      const name = f.name.replace(/\.svg$/, "");
      writeIcon(dir, name, svg, null);
      out.push({
        source: "heroicons",
        style,
        name,
        path: `heroicons/${style}/${name}.svg`,
        license: "MIT",
        upstream: f.html_url,
      });
    }
    console.log(`heroicons/${style}: ${files.length} icons`);
  }
  return out;
};

const scrapeFeather = async () => {
  const files = await listGithubDir(FEATHER_REPO, FEATHER_REF, FEATHER_PATH);
  const dir = join(OUT_ROOT, "feather");
  const out = [];
  for (const f of files) {
    const svg = await fetchText(f.download_url);
    const name = f.name.replace(/\.svg$/, "");
    writeIcon(dir, name, svg, null);
    out.push({
      source: "feather",
      style: "outline",
      name,
      path: `feather/${name}.svg`,
      license: "MIT",
      upstream: f.html_url,
    });
  }
  console.log(`feather: ${files.length} icons`);
  return out;
};

const scrapeIconify = async () => {
  // Iconify API: GET /<prefix>/<name>.svg
  const dir = join(OUT_ROOT, "iconify");
  const out = [];
  for (const id of ICONIFY_PICKS) {
    const [prefix, name] = id.split(":");
    const url = `https://api.iconify.design/${prefix}/${name}.svg`;
    try {
      const svg = await fetchText(url);
      const safe = `${prefix}__${name}`.replace(/[^a-z0-9._-]/gi, "_");
      writeIcon(dir, safe, svg, null);
      out.push({
        source: "iconify",
        style: prefix,
        name,
        path: `iconify/${safe}.svg`,
        license: "see iconify.design",
        upstream: `https://icon-sets.iconify.design/${prefix}/${name}/`,
      });
    } catch (e) {
      console.warn(`iconify ${id}: ${e.message}`);
    }
  }
  console.log(`iconify: ${out.length} icons`);
  return out;
};

// ---------------------------------------------------------------------------

const main = async () => {
  if (!existsSync(OUT_ROOT)) mkdirSync(OUT_ROOT, { recursive: true });
  const all = [];
  // run sources in sequence so logs are readable and we don't hammer the
  // GitHub anonymous rate limit too hard.
  for (const fn of [scrapeHeroicons, scrapeFeather, scrapeIconify]) {
    try {
      const items = await fn();
      all.push(...items);
    } catch (e) {
      console.error(`source failed: ${e.message}`);
    }
  }
  const index = {
    scraped_at: new Date().toISOString(),
    count: all.length,
    by_source: all.reduce((acc, it) => {
      acc[it.source] = (acc[it.source] ?? 0) + 1;
      return acc;
    }, {}),
    icons: all,
  };
  writeFileSync(join(OUT_ROOT, "_index.json"), JSON.stringify(index, null, 2));
  console.log(`\nwrote ${all.length} icons. index at ${join(OUT_ROOT, "_index.json")}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
