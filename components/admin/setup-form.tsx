"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ExerciseConfig, SimulationMode, AiIntensity } from "@/lib/types"

const sectors = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Manufacturing",
  "Retail & E-commerce", "Public Sector", "Technology / SaaS", "Transportation",
]
const sizes = ["< 100 staff", "100 - 1,000", "1,000 - 10,000", "10,000+"]
const maturities = ["Initial", "Developing", "Defined", "Managed", "Optimizing"]
const scenarios = [
  "Ransomware", "Data Exfiltration", "Insider Threat", "Business Email Compromise",
  "Supply Chain Compromise", "DDoS / Extortion", "Cloud Account Takeover",
]
const durations = ["60 minutes", "90 minutes", "2 hours", "Half day"]

const defaults: ExerciseConfig = {
  sector: "Financial Services",
  companySize: "1,000 - 10,000",
  criticalSystems: "Core banking, customer portal, identity provider",
  crownJewels: "Customer PII, payment data, trading systems",
  irMaturity: "Developing",
  scenarioType: "Ransomware",
  duration: "90 minutes",
  teams: "SOC, Legal, Communications, Executives",
}

export function SetupForm() {
  const router = useRouter()
  const [config, setConfig] = useState<ExerciseConfig>(defaults)
  const [mode, setMode] = useState<SimulationMode>("training")
  const [aiIntensity, setAiIntensity] = useState<AiIntensity>("lean")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [irFileName, setIrFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof ExerciseConfig>(key: K, value: ExerciseConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIrFileName(file.name)
    const text = await file.text()
    update("irTemplateText", text.slice(0, 12000))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, mode, aiIntensity }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to create session")
      router.push("/admin/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Simulation mode selector */}
      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Simulation mode</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["training", "event"] as SimulationMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-left transition-all ${
                mode === m
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className={`font-mono text-sm font-medium ${mode === m ? "text-primary" : "text-foreground"}`}>
                {m === "training" ? "Training" : "Event"}
              </span>
              <span className="text-xs text-muted-foreground">
                {m === "training"
                  ? "NIS2-focused training with IR plan adherence and process deviation tracking."
                  : "Multi-team event mode with team-based grouping and leaderboard scoring."}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FieldRow label="Sector" hint="Industry vertical of the simulated organization">
          <Select value={config.sector} onValueChange={(v) => update("sector", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Company size" hint="Headcount band">
          <Select value={config.companySize} onValueChange={(v) => update("companySize", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="IR maturity" hint="Self-assessed incident response capability">
          <Select value={config.irMaturity} onValueChange={(v) => update("irMaturity", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{maturities.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Scenario type" hint="The primary attack pattern to simulate">
          <Select value={config.scenarioType} onValueChange={(v) => update("scenarioType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{scenarios.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Duration" hint="Total exercise duration target">
          <Select value={config.duration} onValueChange={(v) => update("duration", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{durations.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Teams" hint="Comma-separated participating teams">
          <Input value={config.teams} onChange={(e) => update("teams", e.target.value)} placeholder="SOC, Legal, Communications, Executives" />
        </FieldRow>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FieldRow label="Critical systems" hint="Systems whose disruption would materially affect operations">
          <Textarea value={config.criticalSystems} onChange={(e) => update("criticalSystems", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
        </FieldRow>
        <FieldRow label="Crown jewels" hint="Most sensitive data or assets to protect">
          <Textarea value={config.crownJewels} onChange={(e) => update("crownJewels", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
        </FieldRow>
      </div>

      {/* AI Generation */}
      <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">AI scenario generation</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "off",  label: "Template",  cost: "Free",    model: "",               desc: "Pre-built scenario, no API call." },
            { id: "lean", label: "Smart",     cost: "~€0.002", model: "Haiku",          desc: "AI tailors titles & narrative. Injects from template." },
            { id: "full", label: "Full",      cost: "~€0.05",  model: "Sonnet",         desc: "AI writes everything from scratch." },
          ] as { id: AiIntensity; label: string; cost: string; model: string; desc: string }[]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAiIntensity(opt.id)}
              className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                aiIntensity === opt.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`font-mono text-sm font-medium ${aiIntensity === opt.id ? "text-primary" : "text-foreground"}`}>
                  {opt.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{opt.cost}</span>
              </div>
              {opt.model && (
                <span className="font-mono text-[10px] text-primary/70">{opt.model}</span>
              )}
              <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>
            </button>
          ))}
        </div>

        {aiIntensity !== "off" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Optionally upload the client's IR plan to tailor the scenario to their specific gaps and procedures.
            </p>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".txt,.md,.csv" onChange={handleFileUpload} className="hidden" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="gap-2 font-mono uppercase tracking-wider"
              >
                <Upload className="size-3.5" />
                Upload IR plan
              </Button>
              {irFileName && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                  <FileText className="size-3.5 text-primary" />
                  <span className="font-mono text-xs">{irFileName}</span>
                  <button
                    type="button"
                    onClick={() => { setIrFileName(null); update("irTemplateText", undefined); if (fileRef.current) fileRef.current.value = "" }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {aiIntensity === "off" ? "Template mode — no AI, no API cost." : aiIntensity === "lean" ? `Smart mode (Haiku) — ~€0.002/session${config.irTemplateText ? " · IR plan loaded" : ""}` : `Full mode (Sonnet) — ~€0.05/session${config.irTemplateText ? " · IR plan loaded" : ""}`}
        </p>
        <Button type="submit" size="lg" disabled={submitting} className="gap-2 font-mono uppercase tracking-wider">
          {submitting ? (
            <><Loader2 className="size-4 animate-spin" />Generating</>
          ) : (
            <><Sparkles className="size-4" />Generate exercise</>
          )}
        </Button>
      </div>
    </form>
  )
}

function FieldRow(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{props.label}</Label>
      {props.children}
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  )
}
