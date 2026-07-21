import { NextResponse } from "next/server"
import { triggerMeldplichtManual } from "@/lib/session-store"
import type { NotificationType } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TYPES: NotificationType[] = ["ncsc_24h", "ncsc_72h", "ncsc_final", "ap_72h"]

export async function POST(req: Request) {
  const body = (await req.json()) as { type?: string; summary?: string }
  if (!body.type || !TYPES.includes(body.type as NotificationType)) {
    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 })
  }
  const result = await triggerMeldplichtManual({ type: body.type as NotificationType, summary: body.summary })
  return NextResponse.json(result)
}
