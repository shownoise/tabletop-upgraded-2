import { NextResponse } from "next/server"
import type { RoundPhase } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PHASES: RoundPhase[] = ["inject", "discussion", "decision", "lock", "review"]
const PHASE_ORDER: Record<RoundPhase, number> = { inject: 0, discussion: 1, decision: 2, lock: 3, review: 4 }

export async function POST(req: Request) {
  const body = (await req.json()) as { phase?: string; force?: boolean }
  if (!body.phase || !PHASES.includes(body.phase as RoundPhase)) {
    return NextResponse.json({ ok: false, error: "Invalid phase." }, { status: 400 })
  }
  const next = body.phase as RoundPhase

  const { getSession, setPhase } = await import("@/lib/session-store")
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "No active session." }, { status: 400 })

  const current = session.roundPhase
  // Forward-skip guard: cannot land on 'review' from 'inject' or 'discussion'
  // without passing through 'decision'. Backward navigation and same-phase are always allowed.
  // Facilitator can override with { force: true } for edge cases.
  if (!body.force && current && PHASE_ORDER[next] > PHASE_ORDER[current] + 1) {
    return NextResponse.json({
      ok: false,
      error: `Kan niet direct van '${current}' naar '${next}'. Doorloop de tussenfases (of stuur force:true).`,
    }, { status: 400 })
  }

  const result = await setPhase(next)
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
