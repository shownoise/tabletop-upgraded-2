import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { loadPromptOverride, savePromptOverride, type WizardPromptOverride } from "@/lib/admin/wizard-prompt"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const override = await loadPromptOverride()
  return NextResponse.json({ ok: true, override })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json()) as WizardPromptOverride
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  await savePromptOverride(body)
  return NextResponse.json({ ok: true })
}
