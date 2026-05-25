// Serves raw SVG bytes for one icon, looked up by its catalog `path`.
//
// We don't expose data/icons as a static directory (it lives outside the
// viewer's public/), so this route reads off disk after validating that the
// requested path is in the index.

import { NextRequest } from "next/server";
import { getIcon } from "@/lib/data";

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return new Response("missing path", { status: 400 });

  const icon = await getIcon(rel);
  if (!icon) {
    return new Response("not found", { status: 404 });
  }

  return new Response(icon.svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
