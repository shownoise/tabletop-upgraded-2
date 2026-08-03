import { NextResponse } from "next/server"
import { auth } from "@/auth"

type Role = "admin" | "facilitator"

export async function requireRole(...roles: Role[]) {
  const session = await auth()
  const role = (session?.user as any)?.role as string | undefined
  if (!session || !role || !roles.includes(role as Role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { ok: true as const, session, role: role as Role }
}

export async function requireFacilitator() {
  return requireRole("admin", "facilitator")
}

export async function requireAdmin() {
  return requireRole("admin")
}
