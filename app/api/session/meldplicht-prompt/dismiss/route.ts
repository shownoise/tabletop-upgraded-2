import { NextResponse } from "next/server"
import { dismissMeldplichtPrompt } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = (await req.json()) as { promptId?: string }
  if (!body.promptId) return NextResponse.json({ ok: false, error: "Missing promptId" }, { status: 400 })
  const result = await dismissMeldplichtPrompt({ promptId: body.promptId })
  return NextResponse.json(result)
}
