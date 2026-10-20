import { describe, it, expect, vi } from "vitest"

// auth() normally wraps the handler with session resolution; here it passes the
// handler through so the routing policy can be driven with an explicit session.
vi.mock("@/auth", () => ({
  auth: (handler: unknown) => handler,
}))

const HOST = "https://app.test"

type Session = { user: { id: string; role: string } } | null

type RunOptions = {
  method?: string
  session?: Session
  origin?: string
  secFetchSite?: string
}

type ProxyResult = {
  status: number
  headers: { get(name: string): string | null }
}

async function run(path: string, opts: RunOptions = {}): Promise<ProxyResult> {
  const mod = await import("../../proxy")
  const handler = mod.default as unknown as (req: unknown) => ProxyResult

  const headers = new Headers()
  if (opts.origin) headers.set("origin", opts.origin)
  if (opts.secFetchSite) headers.set("sec-fetch-site", opts.secFetchSite)

  return handler({
    nextUrl: new URL(path, HOST),
    auth: opts.session ?? null,
    method: opts.method ?? "GET",
    headers,
  })
}

const FACILITATOR: Session = { user: { id: "u1", role: "facilitator" } }

function isPassThrough(res: ProxyResult): boolean {
  return res.status === 200 && res.headers.get("x-middleware-next") === "1"
}

describe("proxy routing — public pages", () => {
  it("lets the landing page through without a session", async () => {
    expect(isPassThrough(await run("/"))).toBe(true)
  })

  it("lets the login page through without a session", async () => {
    expect(isPassThrough(await run("/login"))).toBe(true)
  })
})

describe("proxy routing — participant access", () => {
  it("lets /join through without a session", async () => {
    expect(isPassThrough(await run("/join"))).toBe(true)
  })

  it("lets participant-callable API routes through without a session", async () => {
    const participantRoutes = [
      "/api/session/join",
      "/api/session/state",
      "/api/session/ready",
      "/api/session/submit-decision",
      "/api/session/assign-role",
      "/api/session/group/create",
      "/api/session/group/join",
      "/api/events",
    ]

    for (const path of participantRoutes) {
      const res = await run(path, { method: "POST", origin: HOST })
      expect(isPassThrough(res), `${path} should be reachable by participants`).toBe(true)
    }
  })
})

describe("proxy routing — facilitator protection", () => {
  it("redirects /admin to /login when unauthenticated", async () => {
    const res = await run("/admin")
    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toBe(`${HOST}/login?callbackUrl=%2Fadmin`)
  })

  it("preserves the originally requested admin path as callbackUrl", async () => {
    const res = await run("/admin/dashboard")
    expect(res.headers.get("location")).toBe(`${HOST}/login?callbackUrl=%2Fadmin%2Fdashboard`)
  })

  it("protects /templates as well", async () => {
    expect((await run("/templates")).status).toBe(307)
  })

  // /observe projects the join code, participant names and submitted choices.
  it("protects /observe, which projects the join code and participant names", async () => {
    expect((await run("/observe")).status).toBe(307)
  })

  it("admits an authenticated facilitator to /observe", async () => {
    expect(isPassThrough(await run("/observe", { session: FACILITATOR }))).toBe(true)
  })

  it("admits an authenticated facilitator to /admin", async () => {
    expect(isPassThrough(await run("/admin", { session: FACILITATOR }))).toBe(true)
  })

  it("rejects non-public API routes with 401 instead of a redirect", async () => {
    const res = await run("/api/session/create", { method: "POST", origin: HOST })
    expect(res.status).toBe(401)
  })

  it("admits an authenticated facilitator to non-public API routes", async () => {
    const res = await run("/api/session/create", {
      method: "POST",
      origin: HOST,
      session: FACILITATOR,
    })
    expect(isPassThrough(res)).toBe(true)
  })
})

describe("proxy routing — cross-origin writes", () => {
  it("blocks a cross-origin POST to a participant route", async () => {
    const res = await run("/api/session/submit-decision", {
      method: "POST",
      origin: "https://evil.test",
    })
    expect(res.status).toBe(403)
  })

  it("blocks a POST marked cross-site by the browser", async () => {
    const res = await run("/api/session/submit-decision", {
      method: "POST",
      secFetchSite: "cross-site",
    })
    expect(res.status).toBe(403)
  })

  it("allows a same-origin POST", async () => {
    const res = await run("/api/session/submit-decision", {
      method: "POST",
      origin: HOST,
      secFetchSite: "same-origin",
    })
    expect(isPassThrough(res)).toBe(true)
  })

  it("allows a cross-origin GET, since it is not a write", async () => {
    const res = await run("/api/session/state", {
      method: "GET",
      origin: "https://evil.test",
    })
    expect(isPassThrough(res)).toBe(true)
  })

  it("leaves NextAuth's own routes to NextAuth, even cross-origin", async () => {
    const res = await run("/api/auth/callback/credentials", {
      method: "POST",
      origin: "https://evil.test",
    })
    expect(isPassThrough(res)).toBe(true)
  })
})
