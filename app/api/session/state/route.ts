import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getState, settleAndGetState, toParticipantState } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  const session = await auth()
  const isAdmin = !!session?.user
  // Settle: tick round-phase auto-advance in case a boundary crossed between mutations.
  // Without this, phases only advance on user actions — fase-timers zouden dood zijn.
  const state = await settleAndGetState().catch(() => getState())

  if (!isAdmin && state.session) {
    // Phase 6 — pass participantId so the projection narrows participantViewState.
    const url = new URL(req.url)
    const participantId = url.searchParams.get("participantId") ?? undefined
    return NextResponse.json({ session: toParticipantState(state.session, participantId) })
  }

  return NextResponse.json(state)
}
