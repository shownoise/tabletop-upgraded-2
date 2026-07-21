import { NextResponse } from "next/server"
import { replotInjectRoutes } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const result = await replotInjectRoutes()
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
