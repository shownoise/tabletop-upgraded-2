import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { dbGetUsers, dbSaveUser, type StoredUser } from "@/lib/db"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const users = await dbGetUsers()
  return NextResponse.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
  await dbSaveUser(user)
  return NextResponse.json({ ok: true, id: user.id })
}
