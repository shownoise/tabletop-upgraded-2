import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { JoinForm } from "@/components/participant/join-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function JoinPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-tt-bg">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20" aria-hidden />

      <header className="relative z-10 border-b border-tt-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-tt-dim hover:text-tt-bright transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ShieldAlert className="size-4 text-tt-accent" />
            <span className="font-mono text-sm tracking-widest text-tt-bright">PARTICIPANT_JOIN</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Join exercise</span>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-tt-accent">ENTER CALL SIGN</h1>
          <p className="font-mono text-xs text-tt-dim leading-relaxed">
            Use the join code shared by your facilitator. You will see the live exercise immediately after joining.
          </p>
        </div>

        <div className="border border-tt-border bg-tt-surface p-6 md:p-8" style={{ borderLeft: "3px solid var(--tt-blue)" }}>
          <JoinForm />
        </div>
      </main>
    </div>
  )
}
