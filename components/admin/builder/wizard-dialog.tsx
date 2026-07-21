"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ScenarioGraph } from "@/lib/graph/types"

const SECTORS = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Manufacturing",
  "Retail & E-commerce", "Public Sector", "Technology / SaaS", "Transportation",
]
const SIZES = ["100–250", "250–500", "500–1,500", "1,500+"]
const ATTACK_TYPES = [
  "Ransomware double extortion",
  "Supply chain compromise",
  "Insider threat",
  "Business Email Compromise",
  "Data exfiltration",
  "DDoS + extortion",
  "Cloud account takeover",
]
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onGraphGenerated: (graph: ScenarioGraph) => void
}

export function WizardDialog({ open, onOpenChange, onGraphGenerated }: Props) {
  const [sector, setSector] = useState<string>(SECTORS[0])
  const [companySize, setCompanySize] = useState<string>(SIZES[1])
  const [attackType, setAttackType] = useState<string>(ATTACK_TYPES[0])
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("intermediate")
  const [roundCount, setRoundCount] = useState<number>(4)
  const [crownJewels, setCrownJewels] = useState<string>("")
  const [criticalSystems, setCriticalSystems] = useState<string>("")
  const [freeText, setFreeText] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/scenario-graph/ai-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector, companySize, attackType, difficulty, roundCount,
          crownJewels, criticalSystems, freeText,
        }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.graph) {
        throw new Error(payload.error ?? "Wizard failed")
      }
      onGraphGenerated(payload.graph)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI scenario wizard
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Vul de basis in — de AI genereert een compleet scenario met rondes, injects, decisions en outcomes. Je kunt daarna alles verder aanpassen in de builder.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sector</Label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Bedrijfsgrootte</Label>
              <select
                value={companySize}
                onChange={e => setCompanySize(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Aanvalstype</Label>
              <select
                value={attackType}
                onChange={e => setAttackType(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {ATTACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Moeilijkheid</Label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as typeof DIFFICULTIES[number])}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Aantal rondes (3-6)</Label>
              <Input
                type="number"
                min={3}
                max={6}
                value={roundCount}
                onChange={e => setRoundCount(Math.max(3, Math.min(6, Number(e.target.value) || 4)))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Crown jewels</Label>
            <Input
              value={crownJewels}
              onChange={e => setCrownJewels(e.target.value)}
              placeholder="Bijv. klant-PII, financiële records, EPD"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Kritieke systemen</Label>
            <Input
              value={criticalSystems}
              onChange={e => setCriticalSystems(e.target.value)}
              placeholder="Bijv. ERP, klantenportaal, identity provider"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Vrije context (optioneel)
            </Label>
            <Textarea
              rows={4}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Bijzondere details, gewenste verhaallijn, focus-modules, red flags om te testen..."
            />
          </div>

          {error && (
            <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {busy ? "Genereren…" : "Genereer scenario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
