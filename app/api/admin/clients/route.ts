import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listClients, saveClient, deleteClient, seedClients, type AdminClient } from "@/lib/admin/clients"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const clients = await listClients()
  return NextResponse.json({ ok: true, clients })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json()) as { client?: AdminClient; seed?: AdminClient[] }
  if (body.seed) {
    const result = await seedClients(body.seed)
    return NextResponse.json({ ok: true, ...result })
  }
  if (!body.client || !body.client.id || !body.client.name) {
    return NextResponse.json({ error: "client { id, name, ... } vereist" }, { status: 400 })
  }
  await saveClient(body.client)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await deleteClient(id)
  return NextResponse.json({ ok: true })
}
