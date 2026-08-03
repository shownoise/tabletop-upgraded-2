import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { dbGetUsers, dbCreateUserIfEmailFree, type StoredUser } from "@/lib/db"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response
  const users = await dbGetUsers()
  return NextResponse.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })))
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response
  const body = await req.json() as { email?: string; password?: string; name?: string; role?: string }
  if (!body.email || !body.password || !body.name) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  const passwordHash = await hash(body.password, 12)
  const user: StoredUser = {
    id: `usr_${randomBytes(6).toString("hex")}`,
    email: body.email,
    passwordHash,
    name: body.name,
    role: (body.role === "admin" ? "admin" : "facilitator"),
    createdAt: Date.now(),
  }
  const result = await dbCreateUserIfEmailFree(user)
  if (!result.ok) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }
  return NextResponse.json({ ok: true, id: user.id })
}
