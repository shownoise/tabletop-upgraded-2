import { NextResponse } from "next/server"
import { joinSession } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; joinCode?: string }
  const result = await joinSession({ name: body.name ?? "", joinCode: body.joinCode ?? "" })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
