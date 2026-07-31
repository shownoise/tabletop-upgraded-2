import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft, Workflow } from "lucide-react"
import { SetupForm } from "@/components/admin/setup-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AdminSetupPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/builder"
              className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Workflow className="size-3.5" />
              Scenario builder
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
        <section className="flex flex-col gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Voorbereiden</span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Sessie voorbereiden
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Vul de context in — sector, kroonjuwelen, kritische systemen. Kies een scenario uit de bibliotheek
            of bouw er zelf één met de Scenario builder, en druk op Start.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Suspense fallback={<div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Laden…</div>}>
            <SetupForm />
          </Suspense>
        </section>
      </main>
    </div>
  )
}
