import { NextResponse } from "next/server"
import { facilitatorSkipDecision } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const result = await facilitatorSkipDecision()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
