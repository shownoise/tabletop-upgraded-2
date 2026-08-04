import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MeldingBody = z.object({
  participantId: z.string().min(1).max(100),
  momentId: z.string().min(1).max(100),
  typeId: z.string().min(1).max(100),
  freeText: z.string().max(1000).optional(),
})

export async function POST(req: Request) {
  const parsed = await safeJson(req, MeldingBody)
  if (!parsed.ok) return parsed.response

  const { fileMelding } = await import("@/lib/session-store")
  const result = await fileMelding(parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, melding: result.melding })
}
