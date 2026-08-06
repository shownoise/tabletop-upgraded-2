import { NextResponse } from "next/server"
import { pushSurpriseInject } from "@/lib/session-store"
import type { InjectChannel, InjectType, Role, Urgency } from "@/lib/types"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = (await req.json()) as {
    title?: string
    content?: string
    type?: InjectType
    urgency?: Urgency
    // Phase 5 — optional library-inject metadata. Backwards compatible.
    channel?: InjectChannel
    senderName?: string
    targetRoles?: Role[]
    classification?: 'feit' | 'aanname' | 'fabel'
    libraryId?: string
  }
  const result = await pushSurpriseInject({
    title: body.title ?? "",
    content: body.content ?? "",
    type: body.type,
    urgency: body.urgency,
    channel: body.channel,
    senderName: body.senderName,
    targetRoles: body.targetRoles,
    classification: body.classification,
    libraryId: body.libraryId,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
