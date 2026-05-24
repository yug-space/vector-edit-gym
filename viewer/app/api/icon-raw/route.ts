// Serves raw SVG bytes for one icon, looked up by its catalog `path`.
//
// We don't expose data/icons as a static directory (it lives outside the
// viewer's public/), so this route reads off disk after validating that the
// requested path is in the index.

import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listIcons } from "@/lib/data";

const ICONS_DIR = path.resolve(process.cwd(), "..", "data", "icons");

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return new Response("missing path", { status: 400 });

  const icons = await listIcons();
  if (!icons.some((i) => i.path === rel)) {
    return new Response("not found", { status: 404 });
  }

  const abs = path.join(ICONS_DIR, rel);
  const svg = await fs.readFile(abs, "utf-8");
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
