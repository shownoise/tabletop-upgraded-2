"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Users } from "lucide-react"

// Deze component bestond al maar werd nérgens gemonteerd. Daardoor had de app
// geen enkele link naar /admin/users en geen uitlog-knop: beide waren alleen
// bereikbaar door de URL te typen. Hij hangt nu in de beheer-header.
export function AdminNav() {
  const router = useRouter()

  async function handleSignOut() {
    const { signOut } = await import("next-auth/react")
    await signOut({ redirect: false })
    router.push("/login")
  }

  return (
    <>
      <Link
        href="/admin/users"
        title="Facilitator-accounts en wachtwoorden"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Users className="size-3.5" />
        <span>Gebruikers</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        title="Uitloggen"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Uitloggen</span>
      </button>
    </>
  )
}
