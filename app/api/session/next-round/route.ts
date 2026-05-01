import { NextResponse } from "next/server"
import { goToNextRound } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST() {
  const result = await goToNextRound()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
