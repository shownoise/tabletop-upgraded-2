import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"
import { requireFacilitator } from "@/lib/auth-guard"
import { endSessionForced } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// `confirm` is required by endSessionForced's contract: ending is distinct from
// destroying, but it is still irreversible for the participants in the room, so
// the UI must have asked first.
const EndBody = z.object({
  confirm: z.literal(true),
  reason: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const parsed = await safeJson(req, EndBody)
  if (!parsed.ok) return parsed.response

  const result = await endSessionForced({ reason: parsed.data.reason })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
