import { auth } from "@/auth"
import { NextResponse } from "next/server"

// Routes that require authentication
const PROTECTED_PREFIXES = ["/admin", "/templates"]
// Routes that are always public
const PUBLIC_ROUTES = ["/login", "/join", "/play", "/api/session/join", "/api/events", "/api/session/state"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const path = nextUrl.pathname

  // Always allow public routes
  if (PUBLIC_ROUTES.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  // Protect admin and template routes
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
