import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listRubricScores, saveRubricScore, type RubricScoreEntry } from "@/lib/admin/rubric-scores"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const scores = await listRubricScores()
  return NextResponse.json({ ok: true, scores })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const entry = (await req.json()) as RubricScoreEntry
  if (!entry || !entry.id || !entry.clientId || !entry.scores?.length) {
    return NextResponse.json({ error: "id, clientId, scores vereist" }, { status: 400 })
  }
  await saveRubricScore(entry)
  return NextResponse.json({ ok: true })
}
