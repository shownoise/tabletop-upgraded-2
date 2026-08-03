import { NextResponse } from "next/server"
import { goToPrevRound } from "@/lib/session-store"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST() {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const result = await goToPrevRound()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
