import { NextResponse } from "next/server"
import { getState } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function GET() {
  return NextResponse.json(await getState())
}
