import { NextResponse } from "next/server"
import { pushInject } from "@/lib/session-store"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = (await req.json()) as { roundIndex?: number; injectId?: string }
  if (typeof body.roundIndex !== "number" || typeof body.injectId !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const result = await pushInject({ roundIndex: body.roundIndex, injectId: body.injectId })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
