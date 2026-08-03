import { NextResponse } from "next/server"
import type { Role } from "@/lib/types"
import { requireFacilitator } from "@/lib/auth-guard"
import { getSession, assignRole } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_ROLES: Role[] = ["it_manager", "ciso", "head_of_comms", "legal", "ceo", "cfo", "system_admin", "hr_lead", "ops_manager"]

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; role?: string; joinCode?: string }
  if (!body.participantId || !body.role || !VALID_ROLES.includes(body.role as Role)) {
    return NextResponse.json({ ok: false, error: "Invalid participantId or role." }, { status: 400 })
  }

  // Two entry points: participants prove identity with a joinCode; facilitators authenticate via NextAuth.
  if (body.joinCode) {
    const session = await getSession()
    if (!session) return NextResponse.json({ ok: false, error: "No active session." }, { status: 404 })
    if (session.joinCode.toUpperCase() !== body.joinCode.trim().toUpperCase()) {
      return NextResponse.json({ ok: false, error: "Invalid join code." }, { status: 401 })
    }
    const p = session.participants.find(pp => pp.id === body.participantId)
    if (!p) {
      return NextResponse.json({ ok: false, error: "Participant not in active session." }, { status: 401 })
    }
    const held = session.participants.find(pp => pp.role === body.role && pp.id !== body.participantId)
    if (held) {
      return NextResponse.json({ ok: false, error: "Role already held by another participant." }, { status: 400 })
    }
  } else {
    const gate = await requireFacilitator()
    if (!gate.ok) return gate.response
  }

  const result = await assignRole({ participantId: body.participantId, role: body.role as Role })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
