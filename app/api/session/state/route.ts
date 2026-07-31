import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getState, settleAndGetState, toParticipantState } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  const isAdmin = !!session?.user
  // Settle: tick round-phase auto-advance in case a boundary crossed between mutations.
  // Without this, phases only advance on user actions — fase-timers zouden dood zijn.
  const state = await settleAndGetState().catch(() => getState())

  if (!isAdmin && state.session) {
    return NextResponse.json({ session: toParticipantState(state.session) })
  }

  return NextResponse.json(state)
}
