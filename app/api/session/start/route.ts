import { NextResponse } from "next/server"
import { startSession, getSession } from "@/lib/session-store"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { force?: boolean }

  // B4: soft gate — facilitator must acknowledge unready participants via { force: true }.
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session." }, { status: 400 })
  if (!body.force) {
    const notReady = session.participants.filter(p => !p.readyAt)
    if (notReady.length > 0) {
      return NextResponse.json({
        error: `${notReady.length} deelnemer(s) hebben nog niet op 'Ready' geklikt: ${notReady.map(p => p.name).join(", ")}. Stuur { force: true } om alsnog te starten.`,
        notReady: notReady.map(p => ({ id: p.id, name: p.name })),
      }, { status: 409 })
    }
  }

  const result = await startSession()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
