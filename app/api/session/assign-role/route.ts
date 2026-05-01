import { NextResponse } from "next/server"
import type { Role } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_ROLES: Role[] = ["it_manager", "ciso", "head_of_comms", "legal", "ceo", "cfo", "system_admin", "hr_lead", "ops_manager", "ir_retainer", "ext_it", "negotiator"]

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; role?: string }
  if (!body.participantId || !body.role || !VALID_ROLES.includes(body.role as Role)) {
    return NextResponse.json({ ok: false, error: "Invalid participantId or role." }, { status: 400 })
  }
  const { assignRole } = await import("@/lib/session-store")
  const result = await assignRole({ participantId: body.participantId, role: body.role as Role })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
