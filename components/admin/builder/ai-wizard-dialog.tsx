"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Sparkles } from "lucide-react"
import type { ScenarioGraph } from "@/lib/graph/types"
import {
  defaultWizardConfig,
  WIZARD_LIMITS,
  ALL_WIZARD_ROLES,
  SPECIAL_CONDITIONS,
  type WizardConfig,
  type CompanySize,
} from "@/lib/wizard/config"
import type { Role } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { REGULATORY_REGIMES } from "@/lib/regulatory/regimes"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (graph: ScenarioGraph, meta: { seed: string; repairLog: RepairLogEntry[] }) => void
  // Optionele voor-invulling — bijv. vanuit /admin/quality met ?clientId=… naar de builder.
  // Wordt toegepast bij elke open-transition (false→true), overschrijft user-edits pas
  // bij volgende opening.
  initialConfig?: Partial<WizardConfig>
}

interface RepairLogEntry {
  attempt: number
  ruleId: string
  violation: string
}

const COMPANY_SIZES: Array<{ id: CompanySize; label: string }> = [
  { id: 'small',      label: 'Klein (< 50 medewerkers)' },
  { id: 'mkbplus',    label: 'MKB+ (50 – 500)' },
  { id: 'enterprise', label: 'Enterprise (500+)' },
]

// AI wizard for creating a client-tailored starting scenario. The full
// WizardConfig is exposed here — every field steers both the generation
// prompt and the framework validation. The wizard always writes drafts.
export function AiWizardDialog({ open, onOpenChange, onGenerated, initialConfig }: Props) {
  const [config, setConfig] = useState<WizardConfig>(() => ({ ...defaultWizardConfig(), ...initialConfig }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastLog, setLastLog] = useState<{ seed: string; repairLog: RepairLogEntry[] } | null>(null)

  // Reset config bij open-transition zodat een nieuwe klant of nieuwe prefill
  // niet blijft hangen op de vorige state. User-edits binnen de dialoog blijven
  // behouden zolang die open blijft.
  useEffect(() => {
    if (open) setConfig({ ...defaultWizardConfig(), ...initialConfig })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const update = <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const toggleRole = (role: Role) => {
    setConfig(prev => {
      const has = prev.rolesIncluded.includes(role)
      return {
        ...prev,
        rolesIncluded: has ? prev.rolesIncluded.filter(r => r !== role) : [...prev.rolesIncluded, role],
      }
    })
  }
  const toggleSpecial = (id: string) => {
    setConfig(prev => {
      const has = prev.specialConditions.includes(id)
      return {
        ...prev,
        specialConditions: has ? prev.specialConditions.filter(s => s !== id) : [...prev.specialConditions, id],
      }
    })
  }

  const canSubmit = useMemo(() => (
    !loading &&
    config.clientName.trim().length > 0 &&
    config.sector.trim().length > 0 &&
    config.rolesIncluded.length > 0
  ), [loading, config])

  async function submit() {
    setLoading(true)
    setError(null)
    setLastLog(null)
    try {
      const res = await fetch("/api/scenario-graph/ai-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      // Bij platform-fouten (504 gateway timeout, 500 zonder body, edge-error)
      // komt hier HTML terug in plaats van JSON. res.json() gooit dan een
      // JSON.parse-fout die de gebruiker niet snapt. Check content-type + status.
      const contentType = res.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        if (res.status === 504) {
          setError("Wizard nam te lang (5 min timeout). Probeer opnieuw of vereenvoudig de config (minder rondes/rollen).")
        } else if (res.status === 401) {
          setError("Sessie verlopen. Log opnieuw in.")
        } else if (res.status >= 500) {
          setError(`Server-fout (HTTP ${res.status}). Probeer opnieuw. Als het blijft: check Vercel logs.`)
        } else {
          setError(`Onverwacht antwoord van de server (HTTP ${res.status}, geen JSON).`)
        }
        return
      }
      const data = await res.json() as {
        ok?: true
        graph?: ScenarioGraph
        seed?: string
        repairLog?: RepairLogEntry[]
        error?: string
        failures?: Array<{ ruleId: string; violation: string; hint: string }>
      }
      if (!res.ok || !data.ok || !data.graph) {
        const failMsg = data.failures?.map(f => `[${f.ruleId}] ${f.violation}`).join("; ")
        setError(failMsg ? `${data.error ?? "Wizard fout"} — ${failMsg}` : (data.error ?? `HTTP ${res.status}`))
        if (data.seed && data.repairLog) setLastLog({ seed: data.seed, repairLog: data.repairLog })
        return
      }
      setLastLog({ seed: data.seed ?? "", repairLog: data.repairLog ?? [] })
      onGenerated(data.graph, { seed: data.seed ?? "", repairLog: data.repairLog ?? [] })
      onOpenChange(false)
    } catch (err) {
      // Netwerk-fout, client cancel, of onverwachte parse. Log naar console
      // zodat je in devtools de exacte oorzaak ziet.
      console.error("Wizard submit failed:", err)
      setError(err instanceof Error
        ? `Netwerkfout: ${err.message}. Check je verbinding en probeer opnieuw.`
        : "Onbekende fout — check browser-console."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI-wizard — startpunt genereren (draft)
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Vul de klantcontext in — AI produceert een compleet draft-scenario dat het framework valideert. Neemt ~1–3 minuten.
        </p>

        {/* ── Verhaal ── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verhaal</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wz-client">Klantnaam <span className="text-destructive">*</span></Label>
              <Input id="wz-client" value={config.clientName} onChange={e => update('clientName', e.target.value)} placeholder="Bakker & Zonen Logistics" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wz-sector">Sector <span className="text-destructive">*</span></Label>
              <Input id="wz-sector" value={config.sector} onChange={e => update('sector', e.target.value)} placeholder="onderwijs — middelbare scholen" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Bedrijfsgrootte</Label>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZES.map(s => (
                  <label key={s.id} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer ${config.companySize === s.id ? 'border-primary bg-primary/5' : 'border-input'}`}>
                    <input
                      type="radio"
                      name="wz-company-size"
                      value={s.id}
                      checked={config.companySize === s.id}
                      onChange={() => update('companySize', s.id)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="wz-it">IT-inrichting</Label>
              <Input id="wz-it" value={config.itArrangement} onChange={e => update('itArrangement', e.target.value)} placeholder="ICT deels uitbesteed aan regionale MSP" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="wz-context">Extra context (optioneel)</Label>
              <Textarea
                id="wz-context"
                rows={2}
                value={config.importantContext ?? ""}
                onChange={e => update('importantContext', e.target.value)}
                placeholder="Speciale wensen, verzoeken van het board, gevoelige punten…"
              />
            </div>
          </div>
        </section>

        {/* ── Structuur ── */}
        <section className="space-y-3 pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Structuur</h3>
          <SliderRow
            label={`Aantal rondes: ${config.rounds}`}
            min={WIZARD_LIMITS.rounds.min}
            max={WIZARD_LIMITS.rounds.max}
            step={1}
            value={config.rounds}
            onChange={v => update('rounds', v)}
          />
          <SliderRow
            label={`Injects per ronde: ${config.injectsPerRound}`}
            min={WIZARD_LIMITS.injectsPerRound.min}
            max={WIZARD_LIMITS.injectsPerRound.max}
            step={1}
            value={config.injectsPerRound}
            onChange={v => update('injectsPerRound', v)}
          />
          <SliderRow
            label={`Opties per rol per decision: ${config.optionsPerRolePerRound}`}
            min={WIZARD_LIMITS.optionsPerRolePerRound.min}
            max={WIZARD_LIMITS.optionsPerRolePerRound.max}
            step={1}
            value={config.optionsPerRolePerRound}
            onChange={v => update('optionsPerRolePerRound', v)}
          />
          <SliderRow
            label={`Ruis ← ${config.factsNoiseRatio.toFixed(2)} → Feit`}
            min={0}
            max={1}
            step={0.05}
            value={config.factsNoiseRatio}
            onChange={v => update('factsNoiseRatio', v)}
          />
        </section>

        {/* ── Rollen ── */}
        <section className="space-y-3 pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rollen</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ALL_WIZARD_ROLES.map(r => {
              const checked = config.rolesIncluded.includes(r)
              return (
                <label key={r} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggleRole(r)} />
                  <span>{ROLE_META[r].label}</span>
                </label>
              )
            })}
          </div>
        </section>

        {/* ── Regelgeving ── */}
        <section className="space-y-3 pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regelgeving</h3>
          <select
            value={config.regulatoryRegimeId}
            onChange={e => update('regulatoryRegimeId', e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-auto"
          >
            {Object.values(REGULATORY_REGIMES).map(r => (
              <option key={r.id} value={r.id}>{r.authorityLabel}</option>
            ))}
          </select>
        </section>

        {/* ── Bijzondere omstandigheden ── */}
        <section className="space-y-3 pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bijzondere omstandigheden</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SPECIAL_CONDITIONS.map(sc => {
              const checked = config.specialConditions.includes(sc.id)
              return (
                <label key={sc.id} className="flex items-start gap-2 text-xs cursor-pointer rounded-md border border-input px-2 py-1.5 hover:bg-muted/50">
                  <Checkbox checked={checked} onCheckedChange={() => toggleSpecial(sc.id)} />
                  <span>
                    <span className="font-medium">{sc.label}</span>
                    <span className="block text-muted-foreground">{sc.narrativePrompt}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        {/* ── Geavanceerd ── */}
        <section className="space-y-3 pt-3 border-t">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geavanceerd</h3>
          <div className="flex flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="wz-seed">Seed (optioneel — voor reproduceerbare generatie)</Label>
            <Input id="wz-seed" value={config.seed ?? ""} onChange={e => update('seed', e.target.value || undefined)} placeholder="willekeurig — laat leeg voor automatisch" />
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
            {error}
          </div>
        )}

        {lastLog && (
          <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-xs">
            <div className="font-semibold">Wizard-log</div>
            <div className="text-muted-foreground">seed: <span className="font-mono">{lastLog.seed || "—"}</span></div>
            {lastLog.repairLog.length > 0 ? (
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {lastLog.repairLog.map((r, i) => (
                  <li key={i}>attempt {r.attempt}: {r.ruleId} — {r.violation}</li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">geen repair-passes nodig</div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Het framework wordt strikt afgedwongen — bij overtredingen probeert de wizard automatisch tot 3× te repareren.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Annuleren</Button>
            <Button type="button" onClick={submit} disabled={!canSubmit} className="gap-2">
              {loading ? <><Loader2 className="size-3.5 animate-spin" /> Genereren…</> : <><Sparkles className="size-3.5" /> Genereer</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SliderRow({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={vals => { if (vals[0] !== undefined) onChange(vals[0]) }}
      />
    </div>
  )
}
