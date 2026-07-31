import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/force-lock — facilitator-only. Forceert LOCK-fase,
// produceert impliciete "geen besluit"-events voor beslispunten zonder
// inzending. Deel B §4.3.
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const { forceLock } = await import("@/lib/session-store")
  const result = await forceLock()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
