import { NextRequest, NextResponse } from "next/server";
import { buildPreview, type Draft } from "@/lib/author";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let draft: Draft;
  try {
    draft = (await req.json()) as Draft;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const preview = await buildPreview(draft);
    return NextResponse.json(preview);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
