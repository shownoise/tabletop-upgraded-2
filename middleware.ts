import { auth } from "@/auth"
import { NextResponse } from "next/server"

const PROTECTED_PREFIXES = ["/admin", "/templates"]

// Participant-callable API endpoints — safe to hit without a facilitator session.
// Route handlers must still validate the request body / participant identity (see lib/api-validation.ts).
const PUBLIC_API_ROUTES = new Set<string>([
  "/api/events",
  "/api/session/join",
  "/api/session/state",
  "/api/session/ready",
  "/api/session/submit-decision",
  "/api/session/assign-role",
  "/api/session/group/create",
  "/api/session/group/join",
  "/api/session/tag-inject",
  "/api/session/annotate-inject",
  "/api/session/annotate-inject/remove",
  "/api/session/notifications",
  "/api/session/meldplicht-prompt/dismiss",
  "/api/session/special/message",
  "/api/session/special/form",
])

function isPublicApi(path: string): boolean {
  if (path.startsWith("/api/auth")) return true
  return PUBLIC_API_ROUTES.has(path)
}

// CSRF defense: for state-changing requests to /api/**, block cross-origin browser
// requests. NextAuth's own /api/auth/* handles CSRF internally with its own token.
// Non-browser clients (curl, mobile SDKs) typically omit Origin/Sec-Fetch-Site,
// which we allow — the route-level auth guards remain the primary defense.
function isForbiddenCrossOriginWrite(req: Request, hostOrigin: string): boolean {
  const method = req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false

  const origin = req.headers.get("origin")
  if (origin && origin !== hostOrigin) return true

  const secFetchSite = req.headers.get("sec-fetch-site")
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") return true

  return false
}

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const path = nextUrl.pathname

  if (path.startsWith("/api/")) {
    if (path.startsWith("/api/auth")) return NextResponse.next()
    if (isForbiddenCrossOriginWrite(req, nextUrl.origin)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 })
    }
    if (isPublicApi(path)) return NextResponse.next()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (PROTECTED_PREFIXES.some(p => path.startsWith(p))) {
    if (!session) {
      const loginUrl = new URL("/login", nextUrl.origin)
      loginUrl.searchParams.set("callbackUrl", path)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
