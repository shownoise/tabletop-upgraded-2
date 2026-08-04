import { NextResponse } from "next/server"
import { joinSession } from "@/lib/session-store"
import type { Role } from "@/lib/types"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"
import { rateLimit } from "@/lib/rate-limit"
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_ROLES = ["it_manager", "ciso", "head_of_comms", "legal", "ceo", "cfo", "it_manager", "hr_lead", "ops_manager"] as const

const JoinBody = z.object({
  name: z.string().min(1).max(80),
  joinCode: z.string().min(1).max(16),
  role: z.enum(VALID_ROLES).optional(),
  existingParticipantId: z.string().min(1).max(64).optional(),
})

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

export async function POST(req: Request) {
  // Brute-force protection on the join code — 6-char codes are guessable at scale
  // without a per-IP throttle.
  const ip = clientIp(req)
  const rl = await rateLimit(`join:${ip}`, 20, 60)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many join attempts. Please wait a minute." }, {
      status: 429,
      headers: { "Retry-After": String(rl.resetSeconds) },
    })
  }

  const parsed = await safeJson(req, JoinBody)
  if (!parsed.ok) return parsed.response
  const { name, joinCode, role, existingParticipantId } = parsed.data
  const result = await joinSession({ name, joinCode, role: role as Role | undefined, existingParticipantId })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
