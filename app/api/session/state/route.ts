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

  if (isAdmin) return NextResponse.json(state)
  if (!state.session) return NextResponse.json({ session: null })

  // Phase 6 — pass participantId so the projection narrows participantViewState.
  const url = new URL(req.url)
  const participantId = url.searchParams.get("participantId") ?? undefined
  // The participant projection still carries the join code and the client's
  // context (sector, crown jewels, critical systems), so it may only go to
  // someone who actually joined. A participantId is only ever handed out in
  // exchange for the join code, which makes it proof of membership. 401 is what
  // useSessionStream turns into `expired`, so an unjoined visitor on /play is
  // bounced to /join rather than left staring at a dead screen.
  const isParticipant = !!participantId
    && state.session.participants.some(p => p.id === participantId)
  if (!isParticipant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({ session: toParticipantState(state.session, participantId) })
}
