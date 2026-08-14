import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { loadOverrides, saveOverrides, type AdminOverrides } from '@/lib/admin/overrides'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await loadOverrides()
  return NextResponse.json({ ok: true, overrides: data })
}

// PUT vervangt de volledige overrides-blob. Client stuurt de gemergde
// state terug — zo houdt de admin-UI het merge-model onder controle en
// hoeven we hier geen deep-merge te doen.
export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await req.json()) as AdminOverrides
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  await saveOverrides(body)
  return NextResponse.json({ ok: true })
}
