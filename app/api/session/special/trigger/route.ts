import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { triggerSpecial } from "@/lib/session-store"
import type { SpecialType } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { type?: SpecialType }
  const { type } = body
  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 })

  const result = await triggerSpecial(type)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, special: result.special })
}
