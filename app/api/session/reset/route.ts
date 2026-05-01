import { NextResponse } from "next/server"
import { resetSession } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST() {
  await resetSession()
  return NextResponse.json({ ok: true })
}
