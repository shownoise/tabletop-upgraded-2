import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listSnapshots, getSnapshot, deleteSnapshot } from "@/lib/admin/sessions-archive"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (id) {
    const snap = await getSnapshot(id)
    if (!snap) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json({ ok: true, snapshot: snap })
  }
  const list = await listSnapshots()
  // Metadata-only lijst — de volledige snapshot is groot, sla het snapshot-veld over.
  const summary = list.map(s => ({ ...s, snapshot: undefined }))
  return NextResponse.json({ ok: true, snapshots: summary })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await deleteSnapshot(id)
  return NextResponse.json({ ok: true })
}
