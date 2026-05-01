import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { dbGetTemplates, dbSaveTemplate, dbDeleteTemplate } from "@/lib/db"
import { BUILTIN_TEMPLATES } from "@/lib/builtin-templates"
import type { ScenarioTemplate } from "@/lib/template-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  // Templates API is public-readable (facilitators need it)
  const custom = await dbGetTemplates()
  const customIds = new Set(custom.map(t => t.id))
  const all = [...BUILTIN_TEMPLATES.filter(b => !customIds.has(b.id)), ...custom]
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const template = await req.json() as ScenarioTemplate
  if (!template.id || !template.name) return NextResponse.json({ error: "Invalid template" }, { status: 400 })
  await dbSaveTemplate(template)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await req.json() as { id: string }
  await dbDeleteTemplate(id)
  return NextResponse.json({ ok: true })
}
