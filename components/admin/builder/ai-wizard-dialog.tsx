"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import type { ScenarioGraph } from "@/lib/graph/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (graph: ScenarioGraph) => void
}

// AI wizard for creating a client-tailored starting scenario. Facilitator fills
// in a few fields; AI returns a full ScenarioGraph the facilitator can then
// tweak in the canvas. Meant for kicking off new client engagements — not a
// replacement for hand-tuning.
export function AiWizardDialog({ open, onOpenChange, onGenerated }: Props) {
  const [clientName, setClientName] = useState("")
  const [sector, setSector] = useState("")
  const [companySize, setCompanySize] = useState("")
  const [attackType, setAttackType] = useState<"ransomware_double_extortion" | "insider_threat" | "bec_cfo_fraud" | "supply_chain_compromise">("ransomware_double_extortion")
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate")
  const [roundCount, setRoundCount] = useState(5)
  const [crownJewels, setCrownJewels] = useState("")
  const [criticalSystems, setCriticalSystems] = useState("")
  const [freeText, setFreeText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/scenario-graph/ai-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName, sector, companySize, attackType, difficulty,
          roundCount, crownJewels, criticalSystems, freeText,
        }),
      })
      const data = await res.json() as { ok?: true; graph?: ScenarioGraph; error?: string }
      if (!res.ok || !data.ok || !data.graph) {
        setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      onGenerated(data.graph)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && clientName.trim().length > 0 && sector.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI-wizard — startpunt genereren
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Vul de klantcontext in — AI produceert een compleet startscenario dat je daarna kunt tweaken. Neemt ~30–60 seconden.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-client">Klantnaam <span className="text-destructive">*</span></Label>
            <Input id="ai-client" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Bakker & Zonen Logistics" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-sector">Sector <span className="text-destructive">*</span></Label>
            <Input id="ai-sector" value={sector} onChange={e => setSector(e.target.value)} placeholder="Logistiek, MKB+" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-size">Bedrijfsgrootte</Label>
            <Input id="ai-size" value={companySize} onChange={e => setCompanySize(e.target.value)} placeholder="250 medewerkers" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-attack">Aanvalstype</Label>
            <select
              id="ai-attack"
              value={attackType}
              onChange={e => setAttackType(e.target.value as typeof attackType)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ransomware_double_extortion">Ransomware + data-exfil</option>
              <option value="insider_threat">Insider threat</option>
              <option value="bec_cfo_fraud">BEC / CFO fraude</option>
              <option value="supply_chain_compromise">Supply chain compromise</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-difficulty">Moeilijkheid</Label>
            <select
              id="ai-difficulty"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as typeof difficulty)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-rounds">Aantal rondes</Label>
            <Input
              id="ai-rounds"
              type="number"
              min={3}
              max={6}
              value={roundCount}
              onChange={e => setRoundCount(Math.max(3, Math.min(6, Number(e.target.value) || 5)))}
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="ai-crown">Kroonjuwelen</Label>
            <Input
              id="ai-crown"
              value={crownJewels}
              onChange={e => setCrownJewels(e.target.value)}
              placeholder="Klant-orderdatabase, financiële administratie, contracten"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="ai-systems">Kritieke systemen</Label>
            <Input
              id="ai-systems"
              value={criticalSystems}
              onChange={e => setCriticalSystems(e.target.value)}
              placeholder="ERP-Navision, WMS, e-mailomgeving Microsoft 365"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="ai-free">Extra context (optioneel)</Label>
            <Textarea
              id="ai-free"
              rows={3}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="IT is uitbesteed aan MSP X. Klant heeft geen SOC. NIS2 = essential entity. Board vraagt specifiek om nachtelijke exfil-scenario."
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            De wizard maakt een startpunt. Je kunt daarna alles bewerken in het canvas.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Annuleren</Button>
            <Button type="button" onClick={submit} disabled={!canSubmit} className="gap-2">
              {loading ? <><Loader2 className="size-3.5 animate-spin" /> Genereren...</> : <><Sparkles className="size-3.5" /> Genereer</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
