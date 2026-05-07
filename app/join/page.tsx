import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { JoinForm } from "@/components/participant/join-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function JoinPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      <header className="relative z-10 border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-mono text-sm tracking-wider">PARTICIPANT_JOIN</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-col gap-3 text-center">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Join exercise</span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight">Enter your call sign</h1>
          <p className="text-pretty text-muted-foreground">
            Use the join code shared by your facilitator. You will see the live exercise immediately after joining.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <JoinForm />
        </div>
      </main>
    </div>
  )
}
