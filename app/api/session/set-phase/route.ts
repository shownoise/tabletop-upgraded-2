import { NextResponse } from "next/server"
import type { RoundPhase } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PHASES: RoundPhase[] = ["inject", "discussion", "decision", "review"]

export async function POST(req: Request) {
  const body = (await req.json()) as { phase?: string }
  if (!body.phase || !PHASES.includes(body.phase as RoundPhase)) {
    return NextResponse.json({ ok: false, error: "Invalid phase." }, { status: 400 })
  }
  const { setPhase } = await import("@/lib/session-store")
  const result = await setPhase(body.phase as RoundPhase)
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
