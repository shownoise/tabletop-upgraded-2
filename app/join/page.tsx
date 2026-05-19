import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { JoinForm } from "@/components/participant/join-form"
import { ThemeToggle } from "@/components/theme-toggle"

export default function JoinPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0f0f]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20" aria-hidden />

      <header className="relative z-10 border-b border-[#2a3030]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#7a9090] hover:text-[#f0fafa] transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ShieldAlert className="size-4 text-[#e8ff40]" />
            <span className="font-mono text-sm tracking-widest text-[#f0fafa]">PARTICIPANT_JOIN</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col gap-8 px-6 py-16 md:py-24">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">Join exercise</span>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-[#e8ff40]">ENTER CALL SIGN</h1>
          <p className="font-mono text-xs text-[#7a9090] leading-relaxed">
            Use the join code shared by your facilitator. You will see the live exercise immediately after joining.
          </p>
        </div>

        <div className="border border-[#2a3030] bg-[#111618] p-6 md:p-8" style={{ borderLeft: "3px solid #40c4ff" }}>
          <JoinForm />
        </div>
      </main>
    </div>
  )
}
