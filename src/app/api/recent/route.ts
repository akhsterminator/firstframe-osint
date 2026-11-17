import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const recent = await getStore().listRecent(12).catch(() => []);
  return NextResponse.json({ recent });
}
