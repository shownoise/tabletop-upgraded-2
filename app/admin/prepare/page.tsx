"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useEffect } from "react"
import { ArrowLeft } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import { SetupForm } from "@/components/admin/setup-form"

// ─── Page ────────────────────────────────────────────────────

export default function PreparePage() {
  const router = useRouter()
  const { state } = useSessionStream()
  const session = state.session
  // Consolidated: /admin/dashboard is the canonical live facilitator view.
  const targetView = "/admin/dashboard"

  // Zodra er een sessie is, hoort de facilitator op het live dashboard. Hier
  // stond eerder een apart "Briefing vooraf"-scherm tussen het aanmaken en de
  // live view: een extra klik, en in de praktijk een scherm waar niets stond
  // dat het dashboard niet ook toont. Doel en facilitatorhandleiding staan nu
  // op de lobby-stap (components/admin/facilitator/facilitator-guide.tsx), de
  // join-code staat in de commandobalk. Deze pagina is daarmee alleen nog de
  // setup-form voor een nieuwe sessie.
  useEffect(() => {
    if (session) router.replace(targetView)
  }, [session, router, targetView])


  if (!session) {
    // Geen actieve sessie → toon de setup-form zodat de facilitator er één
    // kan aanmaken. Na SetupForm's POST /api/session/create leidt die zelf
    // opnieuw naar /admin/prepare, waar de stream de nieuwe sessie oppikt
    // en de brief hieronder verschijnt.
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3 md:px-8">
            <Link href="/admin" className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Nieuwe sessie</span>
              <span className="font-mono text-sm text-foreground">Configureer scenario en start</span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-5 py-8 md:px-8">
          <div className="rounded-lg border border-border bg-card p-6 md:p-8">
            <Suspense fallback={<div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Laden…</div>}>
              <SetupForm />
            </Suspense>
          </div>
        </main>
      </div>
    )
  }

  // Er is een sessie: de effect hierboven stuurt door naar het dashboard. Hier
  // stond het briefingscherm; dat is vervangen door de lobby-stap. Eén regel
  // in plaats van een scherm dat toch meteen wegvalt.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Naar het live dashboard…
      </p>
    </div>
  )
}
