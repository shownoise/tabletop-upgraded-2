"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Users } from "lucide-react"

export function AdminNav() {
  const router = useRouter()

  async function handleSignOut() {
    const { signOut } = await import("next-auth/react")
    await signOut({ redirect: false })
    router.push("/login")
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/admin/users"
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <Users className="size-3" /> Users
      </Link>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-destructive/70 hover:text-destructive transition-colors"
      >
        <LogOut className="size-3" /> Sign out
      </button>
    </div>
  )
}
