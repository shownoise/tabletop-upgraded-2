"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Save, RotateCcw, Sparkles, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "./toast"
import type { WizardPromptOverride } from "@/lib/admin/wizard-prompt"

// De actuele prompt-defaults zijn te lang om als codesnippet in de UI te tonen —
// verwijs naar de bron.
const DEFAULT_PROMPT_LOCATION = "lib/wizard/pipeline.ts::buildSystemPrompt"

// De 12 huidige framework-regels (bron: lib/wizard/framework.ts::RULES).
// Read-only weergave — regels toevoegen/verwijderen vereist code.
const FRAMEWORK_RULES: Array<{ id: string; description: string }> = [
  { id: "rule1_setup_inject",           description: "Elke decision heeft een setup-inject in dezelfde of vorige ronde." },
  { id: "rule2_options_per_role",       description: "Per decision: exact `optionsPerRolePerRound` opties per rol." },
  { id: "rule3_no_dominant",            description: "Geen enkele optie domineert een andere op alle 6 outcome-assen." },
  { id: "rule4_noise_not_only_path",    description: "Geen decision op alleen misleidende setup-injects (reliability=misleading)." },
  { id: "rule5_cross_round_lesson",     description: "Ronde N≥2 verwijst zichtbaar naar keuze/les uit N-1." },
  { id: "rule6_dimension_mapped",       description: "Elke optie beweegt minstens één as van CONT/FOR/BC/JUR/VER/KOS." },
  { id: "rule7_classification_ratio",   description: "Feit-ratio ≈ factsNoiseRatio (±0.15)." },
  { id: "rule8_special_conditions",     description: "Elke geselecteerde special condition verschijnt in het vereiste aantal rondes." },
  { id: "rule9_regulatory_window",      description: "Minstens één inject met triggersRegulatoryNotification=true en verwijzing naar toezichthouder." },
  { id: "rule10_facilitator_guidance",  description: "Elke ronde heeft facilitatorNotes.discussionGoal; feiten/namen matchen de ronde-inhoud." },
  { id: "rule11_hidden_weakness",       description: "Minstens één rol heeft roleBriefings.<role>.playbookGaps non-empty." },
  { id: "rule12_language_consistency",  description: "Geen typische Engelse UI-woorden in NL-vrije-teksten." },
]

async function fetchOverride(): Promise<WizardPromptOverride | null> {
  const res = await fetch("/api/admin/wizard-prompt")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json() as { override: WizardPromptOverride | null }
  return data.override
}
async function saveOverride(o: WizardPromptOverride): Promise<void> {
  const res = await fetch("/api/admin/wizard-prompt", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(o),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export function WizardPromptTab() {
  const [override, setOverride] = useState<WizardPromptOverride | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const toast = useToast()

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const o = await fetchOverride()
      setOverride(o)
      setDirty(false)
    } catch (e) {
      toast.push("error", `Laden mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void reload() }, [reload])

  async function save() {
    setSaving(true)
    try {
      const next: WizardPromptOverride = {
        systemPromptTemplate: override?.systemPromptTemplate,
        ruleAdditions: override?.ruleAdditions,
        version: override?.version ?? "v0",
        updatedAt: Date.now(),
      }
      await saveOverride(next)
      toast.push("success", "Prompt-override opgeslagen")
      setDirty(false)
    } catch (e) {
      toast.push("error", `Opslaan mislukt: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof WizardPromptOverride>(key: K, value: WizardPromptOverride[K]) {
    setOverride(prev => ({ ...(prev ?? { version: "v0", updatedAt: Date.now() }), [key]: value }))
    setDirty(true)
  }

  function revertAll() {
    setOverride({ version: "v0", updatedAt: Date.now() })
    setDirty(true)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Laden…</p>

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">AI-wizard — prompt + regels</h3>
        <p className="text-sm text-muted-foreground mt-1">
          De volledige system-prompt zit in <code className="font-mono text-xs">{DEFAULT_PROMPT_LOCATION}</code>.
          Hier kun je extra regels toevoegen of de complete prompt overschrijven. De versie-string wordt bij elke
          rubric-score meegeslagen, zodat je verbetering over tijd kunt volgen.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
          Deze override is opgeslagen; runtime-consumptie door de wizard-pipeline is een <em>developer follow-up</em> — de wizard
          leest hem nog niet automatisch. Genereren + scoren doe je via <Link href="/admin/quality" className="text-primary hover:underline">Kwaliteit</Link>.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Prompt-versie</label>
          <Input
            value={override?.version ?? "v0"}
            onChange={e => update("version", e.target.value)}
            placeholder="Bijv. v1.2 of git-sha"
            className="mt-1 max-w-xs"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Rubric-scores bewaren deze string. Bump 'm elke keer dat je de prompt verandert zodat je kan tracen wat wat scoorde.
          </p>
        </div>

        <div>
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Extra regels (toegevoegd aan de 12 kern-regels)</label>
          <Textarea
            rows={6}
            value={override?.ruleAdditions ?? ""}
            onChange={e => update("ruleAdditions", e.target.value)}
            placeholder="Bijv.:&#10;13. Elke ronde noemt minimaal één financiële afweging.&#10;14. …"
            className="mt-1 font-mono text-xs"
          />
        </div>

        <details className="rounded border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">Volledige system-prompt overschrijven (geavanceerd)</summary>
          <p className="text-[11px] text-muted-foreground mt-2 mb-2">
            Alleen doen als je precies weet wat je vervangt. Placeholders zoals <code className="font-mono">${"{"}config.clientName{"}"}</code> etc. blijven werken.
          </p>
          <Textarea
            rows={10}
            value={override?.systemPromptTemplate ?? ""}
            onChange={e => update("systemPromptTemplate", e.target.value)}
            placeholder="(leeg = gebruik default uit buildSystemPrompt)"
            className="font-mono text-xs"
          />
        </details>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={revertAll} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="size-3.5" /> Alle overrides wissen
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {dirty ? "Niet-opgeslagen wijzigingen" : override ? "Opgeslagen" : "Geen override"}
            </span>
            <Button size="sm" onClick={save} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Opslaan
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h4 className="font-medium text-sm mb-3">Framework-regels (12) — read-only</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Deze regels worden door de code getoetst na generatie. Rules toevoegen/verwijderen vereist een code-wijziging in <code className="font-mono text-xs">lib/wizard/framework.ts</code>.
        </p>
        <ul className="flex flex-col gap-1.5 text-xs">
          {FRAMEWORK_RULES.map(r => (
            <li key={r.id} className="flex items-start gap-3">
              <code className="font-mono text-[10px] shrink-0 text-primary">{r.id}</code>
              <span className="text-muted-foreground">{r.description}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Testscenario genereren
          </h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Genereer + scoor via <Link href="/admin/quality" className="text-primary hover:underline inline-flex items-center gap-1">Kwaliteit <ExternalLink className="size-3" /></Link> — daar kies je een testklant, laat je de wizard draaien en scoort tegen de 10-punts rubric. Rubric-scores bewaren de prompt-versie hierboven.
        </p>
      </div>
    </section>
  )
}
