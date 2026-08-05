import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const FilingBody = z.object({
  participantId: z.string().min(1).max(100),
  milestoneId: z.string().min(1).max(100),
  freeText: z.string().max(4000).optional(),
  keyPoints: z.string().max(4000).optional(),
})

// POST /api/session/regulatory-filing — file a regulatory obligation.
// Any staffed role can call. Records who filed, in which round, and whether
// on-time vs late per the regime's milestone deadline.
export async function POST(req: Request) {
  const parsed = await safeJson(req, FilingBody)
  if (!parsed.ok) return parsed.response

  const { fileRegulatoryObligation } = await import("@/lib/session-store")
  const result = await fileRegulatoryObligation(parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, obligation: result.obligation })
}
