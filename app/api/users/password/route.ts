import { NextResponse } from "next/server"
import { compare, hash } from "bcryptjs"
import { requireFacilitator } from "@/lib/auth-guard"
import { dbGetUsers, dbSaveUser } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { wachtwoordFout } from "@/lib/wachtwoord"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Wachtwoord wijzigen. Dit bestond niet — er was alleen gebruiker-aanmaken,
 * dus een wachtwoord was alleen te veranderen door in de opslag te schrijven.
 *
 * Twee gevallen:
 *  - Je eigen wachtwoord: je moet je huidige meesturen. Dat is wat voorkomt dat
 *    een overgenomen sessie het account definitief kan afpakken.
 *  - Dat van iemand anders: alleen een admin, en zonder het oude wachtwoord —
 *    dat is het punt van een reset. Wordt gelogd.
 */
export async function POST(req: Request) {
  const gate = await requireFacilitator()
  if (!gate.ok) return gate.response

  const ikId = (gate.session.user as { id?: string } | undefined)?.id
  const ikEmail = gate.session.user?.email ?? null
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string
    currentPassword?: string
    newPassword?: string
  }

  const nieuw = body.newPassword ?? ""
  const lengteFout = wachtwoordFout(nieuw)
  if (lengteFout) return NextResponse.json({ error: lengteFout }, { status: 400 })

  const gebruikers = await dbGetUsers()
  const ik = gebruikers.find(u => u.id === ikId)
    ?? (ikEmail ? gebruikers.find(u => u.email.toLowerCase() === ikEmail.toLowerCase()) : undefined)
  if (!ik) {
    // De JWT leeft acht uur; het account kan in de tussentijd verdwenen zijn.
    return NextResponse.json({ error: "Je account bestaat niet meer." }, { status: 401 })
  }

  const doelId = body.userId ?? ik.id
  const zelf = doelId === ik.id
  const doel = gebruikers.find(u => u.id === doelId)
  if (!doel) return NextResponse.json({ error: "Onbekende gebruiker." }, { status: 404 })

  if (zelf) {
    // Rate limit op het huidige wachtwoord: zonder dit is dit endpoint een
    // orakel om het wachtwoord van de ingelogde gebruiker te raden.
    const rl = await rateLimit(`pwchange:${ik.id}`, 5, 300)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Te veel pogingen. Wacht een paar minuten." },
        { status: 429 },
      )
    }
    const huidig = body.currentPassword ?? ""
    if (!huidig || !(await compare(huidig, doel.passwordHash))) {
      return NextResponse.json({ error: "Je huidige wachtwoord klopt niet." }, { status: 403 })
    }
  } else if (gate.role !== "admin") {
    return NextResponse.json(
      { error: "Alleen een admin kan het wachtwoord van iemand anders zetten." },
      { status: 403 },
    )
  }

  if (await compare(nieuw, doel.passwordHash)) {
    return NextResponse.json(
      { error: "Dat is het wachtwoord dat er al op staat." },
      { status: 400 },
    )
  }

  await dbSaveUser({ ...doel, passwordHash: await hash(nieuw, 12) })
  console.log(
    zelf
      ? `[ctt] ${doel.email} heeft zijn eigen wachtwoord gewijzigd.`
      : `[ctt] ${ik.email} heeft het wachtwoord van ${doel.email} gereset.`,
  )
  return NextResponse.json({ ok: true, zelf })
}
