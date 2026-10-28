import { NextResponse } from "next/server"
import { startSession, getSession } from "@/lib/session-store"
import { requireFacilitator } from "@/lib/auth-guard"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => ({})) as { force?: boolean }

  // B4: soft gate — facilitator must acknowledge unready participants via { force: true }.
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session." }, { status: 400 })
  if (!body.force) {
    const notReady = session.participants.filter(p => !p.readyAt)
    if (notReady.length > 0) {
      // Geen API-instructie in de tekst: dit komt in het facilitatorscherm
      // terecht en werd gelezen door iemand die geen developer is. De
      // aanroeper ziet de 409 en het `notReady`-veld, en vraagt zelf of er
      // toch gestart moet worden.
      const namen = notReady.map(p => p.name).join(", ")
      return NextResponse.json({
        error: notReady.length === 1
          ? `${namen} staat nog niet op klaar.`
          : `${notReady.length} deelnemers staan nog niet op klaar: ${namen}.`,
        notReady: notReady.map(p => ({ id: p.id, name: p.name })),
      }, { status: 409 })
    }
  }

  const result = await startSession()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
