import { NextResponse } from "next/server"
import { getSession, updateSupervisionReportEdits } from "@/lib/session-store"
import { computeSupervisionReport } from "@/lib/engine/supervision"
import type { SupervisionReportEdits } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "No active session" }, { status: 404 })
  const report = computeSupervisionReport(session)
  return NextResponse.json({ report })
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { edits?: SupervisionReportEdits }
  if (!body.edits) return NextResponse.json({ ok: false, error: "Missing edits" }, { status: 400 })
  const result = await updateSupervisionReportEdits(body.edits)
  return NextResponse.json(result)
}
