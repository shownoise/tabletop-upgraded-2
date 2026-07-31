import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/session/group/create { name: string }
// Iedere geauthenticeerde participant (via joinCode-flow) mag een groep aanmaken.
// Facilitator-auth niet vereist — deelnemers formeren hun eigen teams.
export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string }
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 })
  }
  const { createGroup } = await import("@/lib/session-store")
  const result = await createGroup({ name: body.name.slice(0, 50) })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
