import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"
import { completeSpecial } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const body = await req.json() as { specialId?: string }
  if (!body.specialId) return NextResponse.json({ error: "Missing specialId" }, { status: 400 })

  const result = await completeSpecial(body.specialId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
