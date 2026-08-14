import { NextResponse } from "next/server"
import { requireFacilitator } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/set-mode { mode: 'event' | 'training' }
// Facilitator-only. Sinds 2026-08-14: modus is een keuze bij het AANMAKEN
// van een sessie. Na het starten kan hij niet meer wijzigen — anders krijgt
// een deelnemer plotseling een team-picker of verliest z'n rol-assignment.
// Alleen tijdens LOBBY-status (nog niet gestart) accepteren we een wijziging.
export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const body = (await req.json()) as { mode?: string }
  if (body.mode !== "event" && body.mode !== "training") {
    return NextResponse.json({ ok: false, error: "mode must be 'event' or 'training'" }, { status: 400 })
  }

  const { setMode, getSession } = await import("@/lib/session-store")
  const session = await getSession()
  if (session && session.status !== "lobby") {
    return NextResponse.json({
      ok: false,
      error: "Modus kan alleen tijdens lobby-status gewijzigd worden. Sessie is al gestart — maak een nieuwe sessie aan om te wisselen.",
    }, { status: 409 })
  }

  const result = await setMode(body.mode)
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
