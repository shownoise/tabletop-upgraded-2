"use client"

import Link from "next/link"
import { ArrowRight, Library, ShieldAlert } from "lucide-react"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { LangToggle } from "@/components/lang-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

const META = [
  { label: "SCENARIO TYPES", value: "4" },
  { label: "ROLES",          value: "9" },
  { label: "AI MODE",        value: "SONNET" },
  { label: "INJECT CHANNELS", value: "8+" },
] as const

export default function LandingPage() {
  const [lang, setLang] = useLang()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0f0f]">
      {/* Grid background */}
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between border-b border-[#2a3030] px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-4 text-[#e8ff40]" />
          <span className="font-mono text-sm tracking-widest text-[#f0fafa]">CYBER_TABLETOP</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#7a9090] hover:text-[#f0fafa] transition-colors"
          >
            <Library className="size-3" /> Templates
          </Link>
          <LangToggle lang={lang} setLang={setLang} />
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 md:px-10">
        <div className="flex w-full max-w-2xl flex-col gap-10">

          {/* Operation header */}
          <div className="flex flex-col gap-4">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#7a9090]">
              {tr(lang, "tagline")}
            </span>
            <h1 className="font-mono text-5xl md:text-6xl font-bold tracking-tight leading-none text-[#e8ff40]">
              INCIDENT<br />RESPONSE
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#7a9090]">
              AI-GENERATED · REAL-TIME · ROLE-BASED CRISIS EXERCISE
            </p>
          </div>

          {/* Role selector cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/admin"
              className="group flex flex-col gap-3 border border-[#2a3030] bg-[#111618] px-6 py-5 transition-colors hover:border-[#e8ff40]/40"
              style={{ borderLeft: "3px solid #e8ff40" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#e8ff40]">
                  {tr(lang, "facilitator")}
                </span>
                <ArrowRight className="size-3.5 text-[#7a9090] transition-colors group-hover:text-[#e8ff40]" />
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-[#7a9090]">
                Configure scenario · Push injects · Control timeline
              </p>
              <span className="font-mono text-[9px] tracking-widest text-[#7a9090]">CONSOLE ACCESS</span>
            </Link>

            <Link
              href="/join"
              className="group flex flex-col gap-3 border border-[#2a3030] bg-[#111618] px-6 py-5 transition-colors hover:border-[#40c4ff]/40"
              style={{ borderLeft: "3px solid #40c4ff" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#40c4ff]">
                  {tr(lang, "participant")}
                </span>
                <ArrowRight className="size-3.5 text-[#7a9090] transition-colors group-hover:text-[#40c4ff]" />
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-[#7a9090]">
                Join active exercise · Receive injects · Submit decisions
              </p>
              <span className="font-mono text-[9px] tracking-widest text-[#7a9090]">JOIN WITH CODE</span>
            </Link>
          </div>

          {/* Meta-grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#2a3030]">
            {META.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 bg-[#111618] px-4 py-3">
                <span className="font-mono text-[8px] uppercase tracking-widest text-[#7a9090]">{label}</span>
                <span className="font-mono text-xl text-[#f0fafa]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#2a3030] px-6 py-3 md:px-10">
        <div className="flex items-center justify-between font-mono text-[9px] text-[#7a9090]">
          <span>SESSION = ephemeral · in-memory · Vercel KV</span>
          <span>v3.0 · 2 built-in templates</span>
        </div>
      </footer>
    </div>
  )
}
