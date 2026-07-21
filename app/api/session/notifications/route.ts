import { NextResponse } from "next/server"
import { getSession, submitNotification, upsertNotificationDraft } from "@/lib/session-store"
import type { NotificationDraft, NotificationType } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TYPES: NotificationType[] = ["ncsc_24h", "ncsc_72h", "ncsc_final", "ap_72h"]

export async function GET() {
  const session = await getSession()
  return NextResponse.json({ notifications: session?.notifications ?? [] })
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    participantId?: string
    type?: string
    draftId?: string
    content?: NotificationDraft["content"]
    submit?: boolean
  }
  if (!body.participantId || !body.type || !TYPES.includes(body.type as NotificationType)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const upserted = await upsertNotificationDraft({
    participantId: body.participantId,
    type: body.type as NotificationType,
    draftId: body.draftId,
    content: body.content ?? {},
  })
  if (!upserted.ok || !upserted.draftId) return NextResponse.json(upserted, { status: 400 })
  if (body.submit) {
    const submitted = await submitNotification({ participantId: body.participantId, draftId: upserted.draftId })
    return NextResponse.json({ ...submitted, draftId: upserted.draftId })
  }
  return NextResponse.json(upserted)
}
