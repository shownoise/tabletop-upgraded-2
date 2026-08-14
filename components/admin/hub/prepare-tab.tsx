"use client"

import { Suspense } from "react"
import { SetupForm } from "@/components/admin/setup-form"

export function PrepareTab() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Sessie starten</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Kies scenario, modus en rondeduur. De modus staat vast na start; overweeg dus of dit
          een training-sessie (één rol per device) of een event-sessie (notulist per team op één iPad) wordt.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <Suspense fallback={<div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Laden…</div>}>
          <SetupForm />
        </Suspense>
      </div>
    </section>
  )
}
