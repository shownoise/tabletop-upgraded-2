import { NextResponse } from "next/server"
import { tagInject } from "@/lib/session-store"
import type { FactCheckTag } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TAGS: FactCheckTag[] = ["fact", "assumption"]

export async function POST(req: Request) {
  const body = (await req.json()) as { participantId?: string; injectId?: string; tag?: string }
  if (
    typeof body.participantId !== "string" ||
    typeof body.injectId !== "string" ||
    !body.tag || !TAGS.includes(body.tag as FactCheckTag)
  ) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
  }
  const result = await tagInject({
    participantId: body.participantId,
    injectId: body.injectId,
    tag: body.tag as FactCheckTag,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
