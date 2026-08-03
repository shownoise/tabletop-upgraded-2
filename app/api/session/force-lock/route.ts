import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/force-lock — facilitator-only. Forceert LOCK-fase,
// produceert impliciete "geen besluit"-events voor beslispunten zonder
// inzending. Deel B §4.3.
export async function POST() {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const { forceLock } = await import("@/lib/session-store")
  const result = await forceLock()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
