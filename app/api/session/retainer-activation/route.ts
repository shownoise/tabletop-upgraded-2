import { NextResponse } from "next/server"
import { updateRetainerActivation } from "@/lib/session-store"
import type { RetainerActivationState } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; patch?: Partial<RetainerActivationState> }
  if (!body.participantId || !body.patch) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const result = await updateRetainerActivation({ participantId: body.participantId, patch: body.patch })
  return NextResponse.json(result)
}
