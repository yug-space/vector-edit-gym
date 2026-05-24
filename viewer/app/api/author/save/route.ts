import { NextRequest, NextResponse } from "next/server";
import { saveTask, type SaveInput, nextTaskId } from "@/lib/author";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: SaveInput;
  try {
    body = (await req.json()) as SaveInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.difficulty || !body.instruction || !body.category || !body.draft) {
    return NextResponse.json(
      { error: "missing required fields (difficulty, instruction, category, draft)" },
      { status: 400 },
    );
  }
  try {
    const out = await saveTask(body);
    const nextId = await nextTaskId(body.difficulty);
    return NextResponse.json({ ...out, next_id: nextId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
