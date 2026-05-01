import { NextResponse } from "next/server"
import { joinSession } from "@/lib/session-store"
import type { Role } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_ROLES: Role[] = ["it_manager", "soc_analyst", "ciso", "head_of_comms", "legal", "ceo", "cfo"]

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; joinCode?: string; role?: string }
  const role = body.role && VALID_ROLES.includes(body.role as Role) ? (body.role as Role) : undefined
  const result = await joinSession({ name: body.name ?? "", joinCode: body.joinCode ?? "", role })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
