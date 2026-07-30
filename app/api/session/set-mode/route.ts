import { NextResponse } from "next/server"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/set-mode { mode: 'event' | 'training' }
// Facilitator-only. Wisselt SimulationMode op de actieve sessie.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  const body = (await req.json()) as { mode?: string }
  if (body.mode !== "event" && body.mode !== "training") {
    return NextResponse.json({ ok: false, error: "mode must be 'event' or 'training'" }, { status: 400 })
  }

  const { setMode } = await import("@/lib/session-store")
  const result = await setMode(body.mode)
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
