"use client"

import Link from "next/link"
import { ArrowRight, ShieldAlert, Library } from "lucide-react"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"

export default function LandingPage() {
  const [lang, setLang] = useLang()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-25" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
            <ShieldAlert className="size-4 text-primary" />
          </div>
          <span className="font-mono text-sm tracking-wider text-foreground">CYBER_TABLETOP</span>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} setLang={setLang} />
          <Link href="/templates" className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            <Library className="size-3.5" /> Templates
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 md:px-10">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "tagline")}</span>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {tr(lang, "selectRole")}
            </h1>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/admin" className="flex h-16 items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-6 font-mono text-sm uppercase tracking-wider text-foreground transition-all hover:bg-primary/20 hover:border-primary/60">
              <span>{tr(lang, "facilitator")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">CONSOLE ACCESS</span>
                <ArrowRight className="size-4" />
              </div>
            </Link>
            <Link href="/join" className="flex h-16 items-center justify-between rounded-xl border border-border bg-card px-6 font-mono text-sm uppercase tracking-wider text-foreground transition-all hover:bg-accent">
              <span>{tr(lang, "participant")}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">JOIN WITH CODE</span>
                <ArrowRight className="size-4" />
              </div>
            </Link>
            <Link href="/templates" className="flex h-12 items-center justify-between rounded-xl border border-border bg-background px-6 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-all hover:text-foreground hover:border-border/80">
              <span className="flex items-center gap-2"><Library className="size-3.5" /> Template library</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-6 md:px-10">
        <div className="border-t border-border pt-4 font-mono text-xs text-muted-foreground flex items-center justify-between">
          <span>SESSION = in-memory · single active · ephemeral</span>
          <span>2 builtin templates · v3.0</span>
        </div>
      </footer>
    </div>
  )
}
