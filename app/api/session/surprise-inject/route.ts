import { NextResponse } from "next/server"
import { pushSurpriseInject } from "@/lib/session-store"
import type { InjectType, Urgency } from "@/lib/types"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string; content?: string; type?: InjectType; urgency?: Urgency }
  const result = await pushSurpriseInject({ title: body.title ?? "", content: body.content ?? "", type: body.type, urgency: body.urgency })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
