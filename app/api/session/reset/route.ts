import { NextResponse } from "next/server"
import { resetSession } from "@/lib/session-store"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST() {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  await resetSession()
  return NextResponse.json({ ok: true })
}
