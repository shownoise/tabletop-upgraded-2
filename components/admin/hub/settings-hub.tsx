"use client"

import { useEffect, useState } from "react"
import { ConfigTab } from "./config-tab"
import { RolesTab } from "./roles-tab"
import { RegimesTab } from "./regimes-tab"
import { WizardPromptTab } from "./wizard-prompt-tab"

type Tab = "texts" | "roles" | "regimes" | "wizard"
const TABS: Array<{ key: Tab; label: string; hint: string }> = [
  { key: "texts",   label: "Teksten",   hint: "Labels, foutmeldingen, guides" },
  { key: "roles",   label: "Rollen",    hint: "Standaard rollenset + briefings" },
  { key: "regimes", label: "Regimes",   hint: "Meldplicht-regimes en autoriteiten" },
  { key: "wizard",  label: "AI-wizard", hint: "Prompt + generatieregels" },
]

function readInitial(): Tab {
  if (typeof window === "undefined") return "texts"
  const p = new URLSearchParams(window.location.search).get("t") as Tab | null
  if (p && TABS.some(x => x.key === p)) return p
  return "texts"
}

export function SettingsHub() {
  const [tab, setTab] = useState<Tab>("texts")

  useEffect(() => {
    setTab(readInitial())
    const on = () => setTab(readInitial())
    window.addEventListener("popstate", on)
    return () => window.removeEventListener("popstate", on)
  }, [])

  function switchTo(next: Tab) {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set("t", next)
    window.history.pushState({}, "", url.toString())
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Instellingen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Standaard-waardes zitten in code. Wijzigingen worden als override in KV bewaard; elk veld heeft een "terug naar standaard".
        </p>
      </div>

      <div className="border-b border-border flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTo(t.key)}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                active ? "border-b-2 border-primary text-foreground font-medium" : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="hidden md:inline font-mono text-[10px] text-muted-foreground/70 ml-2">— {t.hint}</span>
            </button>
          )
        })}
      </div>

      {tab === "texts" && <ConfigTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "regimes" && <RegimesTab />}
      {tab === "wizard" && <WizardPromptTab />}
    </section>
  )
}
