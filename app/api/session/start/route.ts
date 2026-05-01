import { NextResponse } from "next/server"
import { startSession } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST() {
  const result = await startSession()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
