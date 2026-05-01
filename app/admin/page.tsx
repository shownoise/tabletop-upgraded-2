import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { SetupForm } from "@/components/admin/setup-form"

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
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-mono text-sm tracking-wider">FACILITATOR_SETUP</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10 md:px-10 md:py-14">
        <section className="flex flex-col gap-4">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">01 / Configure</span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Configure the exercise
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            These inputs shape the AI-generated scenario. You will get a structured incident with rounds, situation
            updates, and pre-staged injects you can push to participants live.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 md:p-8">
          <SetupForm />
        </section>
      </main>
    </div>
  )
}
