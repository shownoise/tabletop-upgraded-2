import { NextResponse } from "next/server"
import { submitApForm, getSession } from "@/lib/session-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json() as {
    specialId?: string
    participantId?: string
    formData?: Record<string, string>
  }
  const { specialId, participantId, formData } = body
  if (!specialId || !participantId || !formData) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session" }, { status: 400 })

  const special = (session.specialEvents ?? []).find(s => s.id === specialId)
  if (!special) return NextResponse.json({ error: "Special event not found" }, { status: 400 })
  if (special.assignedParticipantId !== participantId) {
    return NextResponse.json({ error: "Not assigned to this participant" }, { status: 403 })
  }

  const result = await submitApForm({ specialId, participantId, formData })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
