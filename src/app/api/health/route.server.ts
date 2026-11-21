import { NextResponse } from "next/server";
import { capabilities } from "@/lib/server/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, capabilities: await capabilities() });
}
