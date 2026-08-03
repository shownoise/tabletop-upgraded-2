import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = await req.json() as { paused: boolean }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused (boolean) is required" }, { status: 400 })
  }
  const { setPhaseAutoAdvancePaused } = await import("@/lib/session-store")
  const result = await setPhaseAutoAdvancePaused(body.paused)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
