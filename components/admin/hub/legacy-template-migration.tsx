"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, FileInput, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ScenarioGraph } from "@/lib/graph/types"
import {
  LEGACY_TEMPLATE_LIBRARY_KEY,
  isBuiltinTemplate,
  legacyTemplateGraphId,
  legacyTemplateToScenarioGraph,
  type LegacyTemplateSource,
} from "@/lib/graph/legacy-template-migration"
import type { ScenarioTemplate, TemplateLibrary } from "@/lib/template-types"

type MigrationItem = {
  source: LegacyTemplateSource
  template: ScenarioTemplate
}

function itemKey(item: MigrationItem): string {
  return `${item.source}:${item.template.id}`
}

function sourceLabel(source: LegacyTemplateSource): string {
  return source === "browser" ? "Deze browser" : "Oude gedeelde bibliotheek"
}

function readBrowserTemplates(): ScenarioTemplate[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_TEMPLATE_LIBRARY_KEY)
    if (!raw) return []
    const library = JSON.parse(raw) as Partial<TemplateLibrary>
    return Array.isArray(library.templates)
      ? library.templates.filter(template => !isBuiltinTemplate(template))
      : []
  } catch {
    return []
  }
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null
  return body?.error ?? `HTTP ${response.status}`
}

export function LegacyTemplateMigration() {
  const [items, setItems] = useState<MigrationItem[]>([])
  const [existingGraphIds, setExistingGraphIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const browserItems = readBrowserTemplates().map(template => ({ source: "browser" as const, template }))

    void (async () => {
      try {
        const [templatesResponse, graphsResponse] = await Promise.all([
          fetch("/api/templates"),
          fetch("/api/scenario-graph"),
        ])
        if (!templatesResponse.ok) throw new Error(`Oude gedeelde templates laden mislukt: ${await responseError(templatesResponse)}`)
        if (!graphsResponse.ok) throw new Error(`Bestaande scenario's laden mislukt: ${await responseError(graphsResponse)}`)

        const templatesData = await templatesResponse.json() as ScenarioTemplate[]
        const graphsData = await graphsResponse.json() as { graphs?: ScenarioGraph[] }
        const serverItems = templatesData
          .filter(template => !isBuiltinTemplate(template))
          .map(template => ({ source: "server" as const, template }))

        if (cancelled) return
        setItems([...browserItems, ...serverItems])
        setExistingGraphIds(new Set((graphsData.graphs ?? []).map(graph => graph.id)))
      } catch (error) {
        if (!cancelled) setLoadingError(error instanceof Error ? error.message : "De oude templates konden niet worden geladen.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const pending = items.filter(item => {
    return !existingGraphIds.has(legacyTemplateGraphId(item.source, item.template.id))
  })

  async function importTemplate(item: MigrationItem) {
    const key = itemKey(item)
    setBusy(key)
    setActionError(null)
    try {
      const graph = legacyTemplateToScenarioGraph(item.template, item.source)
      if (existingGraphIds.has(graph.id)) return

      const response = await fetch("/api/scenario-graph", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph),
      })
      if (!response.ok) throw new Error(await responseError(response))
      setExistingGraphIds(previous => new Set(previous).add(graph.id))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Importeren mislukt.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <h3 className="text-base font-semibold">Oude templates migreren</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Importeer alleen je eigen oude templates als conceptscenario. De bron blijft ongewijzigd; controleer het concept daarna in de builder.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p>Oude AI- of HTML-invulling wordt omgezet naar gewone scenario-inhoud. Scoring, meldplicht en betrouwbaarheid blijven uit totdat je ze bewust inschakelt.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Oude templates controleren…</p>}
      {loadingError && <p className="text-sm text-destructive">{loadingError}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {!loading && !loadingError && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Geen eigen oude templates gevonden. De standaardtemplates hoeven niet te worden gemigreerd.
        </div>
      )}

      {!loading && !loadingError && items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          {items.map((item, index) => {
            const graphId = legacyTemplateGraphId(item.source, item.template.id)
            const imported = existingGraphIds.has(graphId)
            const key = itemKey(item)
            return (
              <div key={key} className={index > 0 ? "border-t border-border" : ""}>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{item.template.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {sourceLabel(item.source)} · {item.template.rounds.length} rondes · wordt een concept
                    </p>
                  </div>
                  {imported ? (
                    <Link href={`/admin/builder?id=${encodeURIComponent(graphId)}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Check className="size-3.5" /> Geïmporteerd
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" onClick={() => void importTemplate(item)} disabled={busy !== null} className="gap-1.5">
                      {busy === key ? <Loader2 className="size-3.5 animate-spin" /> : <FileInput className="size-3.5" />}
                      Importeren
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && !loadingError && pending.length > 0 && (
        <p className="text-xs text-muted-foreground">{pending.length} template{pending.length === 1 ? "" : "s"} wacht{pending.length === 1 ? "" : "en"} nog op import.</p>
      )}
    </section>
  )
}
