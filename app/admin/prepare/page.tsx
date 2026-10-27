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
  // Alleen doorsturen voor een sessie die nog leeft. Een afgeronde sessie
  // stuurde je hiervoor óók naar het dashboard, dus wie een nieuwe oefening
  // wilde starten belandde op de dode afronding van de vorige en moest die
  // eerst verwijderen. De store houdt er maar één, dus een nieuwe vervangt de
  // oude — maar dat mag je zelf doen, vanaf het formulier.
  const blocking = session?.status === "lobby" || session?.status === "active"

  useEffect(() => {
    if (blocking) router.replace(targetView)
  }, [blocking, router, targetView])


  if (!blocking) {
    // Geen lopende sessie, of de vorige is afgerond: toon de setup-form. Na
    // SetupForm's POST /api/session/create stuurt de effect hierboven door naar
    // het dashboard, want dan leeft er weer een sessie.
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
        <main className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-8 md:px-8">
          {/* Er staat nog een afgeronde sessie in de opslag. Die wordt vervangen
              zodra je hier start, en de opslag houdt er maar één. Dus zeggen we
              het, met de weg naar het rapport ernaast. */}
          {session?.status === "ended" && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-xs text-foreground">
              <span className="flex-1">
                De vorige oefening is afgerond. Als je hier een nieuwe start, vervangt die de oude —
                haal het rapport eerst op als je het nog nodig hebt.
              </span>
              <Link
                href="/admin/report/current"
                className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Rapport vorige sessie
              </Link>
            </div>
          )}
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
