"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FolderKanban, Play, Cog, Users, BarChart3 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { ScenariosTab } from "./scenarios-tab"
import { PrepareTab } from "./prepare-tab"
import { ConfigTab } from "./config-tab"
import { RolesTab } from "./roles-tab"
import { ScoringTab } from "./scoring-tab"

type TabKey = "scenarios" | "prepare" | "config" | "roles" | "scoring"

const TABS: Array<{ key: TabKey; label: string; icon: typeof FolderKanban; hint: string }> = [
  { key: "scenarios", label: "Scenario's",   icon: FolderKanban, hint: "Bibliotheek + bouwen" },
  { key: "prepare",   label: "Sessie starten", icon: Play,       hint: "Kies scenario, modus, start" },
  { key: "config",    label: "Teksten",       icon: Cog,          hint: "Labels + guides + errors" },
  { key: "roles",     label: "Rollen",        icon: Users,        hint: "Briefings + authorities" },
  { key: "scoring",   label: "Scoring",       icon: BarChart3,    hint: "Vectors per antwoord" },
]

function readInitialTab(): TabKey {
  if (typeof window === "undefined") return "scenarios"
  const params = new URLSearchParams(window.location.search)
  const t = params.get("tab") as TabKey | null
  if (t && TABS.some(x => x.key === t)) return t
  return "scenarios"
}

export function AdminHub() {
  const [tab, setTab] = useState<TabKey>("scenarios")

  useEffect(() => {
    setTab(readInitialTab())
    const onPop = () => setTab(readInitialTab())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  function switchTab(next: TabKey) {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    window.history.pushState({}, "", url.toString())
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 md:px-10">
          <Link href="/" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Admin</span>
          <ThemeToggle />
        </div>
        <nav className="mx-auto max-w-7xl px-6 md:px-10 flex gap-1 overflow-x-auto pb-2">
          {TABS.map(t => {
            const active = t.key === tab
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition-colors whitespace-nowrap ${
                  active
                    ? "border-b-2 border-primary text-foreground font-medium"
                    : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{t.label}</span>
                <span className="hidden md:inline font-mono text-[10px] text-muted-foreground/70">— {t.hint}</span>
              </button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 md:px-10 md:py-8">
        {tab === "scenarios" && <ScenariosTab />}
        {tab === "prepare" && <PrepareTab />}
        {tab === "config" && <ConfigTab />}
        {tab === "roles" && <RolesTab />}
        {tab === "scoring" && <ScoringTab />}
      </main>
    </div>
  )
}
