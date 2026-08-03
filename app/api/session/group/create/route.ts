import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CreateGroupBody = z.object({
  name: z.string().min(1).max(50),
})

// Iedere geauthenticeerde participant (via joinCode-flow) mag een groep aanmaken.
// Facilitator-auth niet vereist — deelnemers formeren hun eigen teams.
export async function POST(req: Request) {
  const parsed = await safeJson(req, CreateGroupBody)
  if (!parsed.ok) return parsed.response
  const { createGroup } = await import("@/lib/session-store")
  const result = await createGroup({ name: parsed.data.name })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
