import { NextResponse } from "next/server";
import { getOptions } from "@/lib/author";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getOptions();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
