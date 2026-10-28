"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Database, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MigratieUitslag } from "@/lib/store/migratie"

interface OpslagStatus {
  backend: string
  duurzaam: boolean
  uitleg: string
}

const BACKEND_LABEL: Record<string, string> = {
  postgres: "Postgres (Neon)",
  kv: "Vercel KV",
  geheugen: "Geheugen van deze instantie",
}

export function OpslagTab() {
  const [status, setStatus] = useState<OpslagStatus | null>(null)
  const [oudeKvAanwezig, setOudeKvAanwezig] = useState(false)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [overschrijven, setOverschrijven] = useState(false)
  const [uitslag, setUitslag] = useState<MigratieUitslag | null>(null)

  const lees = useCallback(async () => {
    setLaden(true)
    setFout(null)
    try {
      const r = await fetch("/api/admin/opslag", { cache: "no-store" })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = (await r.json()) as { status: OpslagStatus; oudeKvAanwezig: boolean }
      setStatus(body.status)
      setOudeKvAanwezig(body.oudeKvAanwezig)
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekende fout")
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { void lees() }, [lees])

  async function migreer() {
    setBezig(true)
    setFout(null)
    setUitslag(null)
    try {
      const r = await fetch("/api/admin/opslag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overschrijven }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = (await r.json()) as { uitslag: MigratieUitslag }
      setUitslag(body.uitslag)
    } catch (e) {
      setFout(e instanceof Error ? e.message : "onbekende fout")
    } finally {
      setBezig(false)
    }
  }

  if (laden) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opslag uitlezen…
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {status && (
        <div className={`rounded-lg border px-4 py-3 ${
          status.duurzaam ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"
        }`}>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4" />
            {BACKEND_LABEL[status.backend] ?? status.backend}
            <span className={`font-mono text-[10px] uppercase ${status.duurzaam ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
              {status.duurzaam ? "duurzaam" : "niet duurzaam"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{status.uitleg}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Oude KV-gegevens overzetten</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Postgres krijgt voorrang zodra er een connectiestring is, en die database begint leeg. Alles wat
            in Vercel KV staat — de lopende sessie, klanten, het sessie-archief, scenario-grafen, instellingen —
            is dan nog wél aanwezig maar niet meer vindbaar voor de app. Deze knop kopieert het over. KV wordt
            niet leeggemaakt, en wat hier al staat blijft staan.
          </p>
        </div>

        {!oudeKvAanwezig && (
          <p className="text-sm text-muted-foreground">
            Er staan geen KV-envvars in deze omgeving, dus er is niets om over te zetten.
          </p>
        )}

        {/* Waarom deze optie er is: zodra je één keer inlogt op de nieuwe
            database staat daar al een gebruikerslijst, en dan slaat de
            migratie `ctt:users` over. Zonder deze schakelaar zijn je eigen
            gebruikers onbereikbaar terwijl ze in KV nog netjes staan. */}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={overschrijven}
            onChange={e => setOverschrijven(e.target.checked)}
            className="mt-0.5"
            disabled={bezig || !oudeKvAanwezig}
          />
          <span>
            Ook overschrijven wat hier al staat
            <span className="block text-xs text-muted-foreground">
              Nodig als de nieuwe opslag al gebruikt is — bijvoorbeeld de gebruikerslijst, die bij je eerste
              login wordt aangemaakt. KV is dan de waarheid.
            </span>
          </span>
        </label>

        <div>
          <Button type="button" onClick={() => void migreer()} disabled={bezig || !oudeKvAanwezig}>
            {bezig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Oude KV-gegevens kopiëren
          </Button>
        </div>

        {fout && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" /> {fout}
          </p>
        )}

        {uitslag && <Uitslag uitslag={uitslag} />}
      </div>
    </div>
  )
}

function Uitslag({ uitslag }: { uitslag: MigratieUitslag }) {
  if (uitslag.nietsTeDoen) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {uitslag.nietsTeDoen}
      </p>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Check className="h-4 w-4" />
        {uitslag.gekopieerd.length} gekopieerd, {uitslag.overgeslagen.length} overgeslagen
        {uitslag.gebeurtenissen > 0 ? `, ${uitslag.gebeurtenissen} gebeurtenissen` : ""}
        {uitslag.mislukt.length > 0 ? `, ${uitslag.mislukt.length} mislukt` : ""}
      </p>
      {uitslag.gekopieerd.length > 0 && (
        <Regel label="Gekopieerd" items={uitslag.gekopieerd} />
      )}
      {uitslag.overgeslagen.length > 0 && (
        <Regel label="Stond er al" items={uitslag.overgeslagen} />
      )}
      {uitslag.mislukt.length > 0 && (
        <Regel label="Mislukt" items={uitslag.mislukt.map(m => `${m.key} — ${m.fout}`)} />
      )}
    </div>
  )
}

function Regel({ label, items }: { label: string; items: string[] }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      <span className="font-mono uppercase">{label}:</span>{" "}
      <span className="font-mono">{items.join(", ")}</span>
    </p>
  )
}
