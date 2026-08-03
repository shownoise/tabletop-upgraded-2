import { NextResponse } from "next/server"
import type { ZodType } from "zod"

type SafeJsonOk<T> = { ok: true; data: T }
type SafeJsonErr = { ok: false; response: NextResponse }

export async function safeJson<T>(req: Request, schema: ZodType<T>): Promise<SafeJsonOk<T> | SafeJsonErr> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid request body", issues: parsed.error.flatten() }, { status: 422 }),
    }
  }
  return { ok: true, data: parsed.data }
}
