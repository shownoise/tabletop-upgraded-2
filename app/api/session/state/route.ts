import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getState, toParticipantState } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  const isAdmin = !!session?.user
  const state = await getState()

  if (!isAdmin && state.session) {
    return NextResponse.json({ session: toParticipantState(state.session) })
  }

  return NextResponse.json(state)
}
