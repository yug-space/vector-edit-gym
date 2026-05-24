import { NextRequest, NextResponse } from "next/server";
import { nextTaskId } from "@/lib/author";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const diff = req.nextUrl.searchParams.get("difficulty");
  if (!diff) return NextResponse.json({ error: "missing difficulty" }, { status: 400 });
  try {
    const id = await nextTaskId(diff);
    return NextResponse.json({ task_id: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
