import { NextResponse } from "next/server"
import { removeAnnotation } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; annotationId?: string }
  if (typeof body.participantId !== "string" || typeof body.annotationId !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const result = await removeAnnotation({
    participantId: body.participantId,
    annotationId: body.annotationId,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
