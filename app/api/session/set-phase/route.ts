import { NextResponse } from "next/server"
import type { RoundPhase } from "@/lib/types"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PHASES: RoundPhase[] = ["inject", "discussion", "decision", "review"]
const PHASE_ORDER: Record<RoundPhase, number> = { inject: 0, discussion: 1, decision: 2, review: 3 }

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = (await req.json()) as { phase?: string; force?: boolean; reason?: string }
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

  // `force` doorgeven, niet alleen gebruiken voor de sprong-check hierboven.
  // Hier ging hij verloren: setPhase() kent zelf een force-optie om de
  // beslisfase te verlaten terwijl er nog rollen open staan, en die werd nooit
  // gezet. Een aanroep met force:true kreeg dus alsnog "Nog wachten op 2
  // beslissingen" terug, met een melding die naar een knop verwijst die iets
  // anders doet (force-lock).
  const result = await setPhase(next, { force: body.force, reason: body.reason })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
