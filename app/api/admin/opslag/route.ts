import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { dbStorageStatus } from "@/lib/db"
import { migreerVanKv } from "@/lib/store/migratie"
import { heeftKv } from "@/lib/store/backend"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const status = await dbStorageStatus()
  return NextResponse.json({ ok: true, status, oudeKvAanwezig: heeftKv() })
}

// Kopieert KV naar de huidige achterkant. Eenmalig bedoeld, maar herhaalbaar:
// wat al in de bestemming staat blijft staan tenzij overschrijven: true.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { overschrijven?: boolean }
  const uitslag = await migreerVanKv({ overschrijven: body.overschrijven === true })
  return NextResponse.json({ ok: true, uitslag })
}
