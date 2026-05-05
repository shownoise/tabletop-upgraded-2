"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles, Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  ExerciseConfig, SimulationMode, AiIntensity, SpecialsMode,
  ITMaturity, SecurityCapability, TeamStructure,
  ExerciseGoal, DifficultyLevel,
} from "@/lib/types"

const sectors = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Manufacturing",
  "Retail & E-commerce", "Public Sector", "Technology / SaaS", "Transportation",
]
const sizes = ["100–250", "250–500", "500–1,500", "1,500+"]
const scenarios = [
  "Ransomware", "Data Exfiltration", "Insider Threat", "Business Email Compromise",
  "Supply Chain Compromise", "DDoS / Extortion", "Cloud Account Takeover",
]
const durations = ["60 minutes", "90 minutes", "2 hours", "Half day"]

const defaults: ExerciseConfig = {
  sector: "Financial Services",
  companySize: "250–500",
  criticalSystems: "ERP, customer portal, identity provider",
  crownJewels: "Customer PII, financial records",
  irMaturity: "Developing",
  scenarioType: "Ransomware",
  duration: "90 minutes",
  teams: "",
  itMaturity: "medium",
  securityCapability: "small_it",
  exerciseGoal: "ransomware_tabletop",
  teamStructure: "crisis_only",
  roundCount: 4,
  timerPerRound: 15,
  difficulty: "intermediate",
  existingPlans: [],
}

const IT_MATURITY_OPTIONS: { id: ITMaturity; label: string }[] = [
  { id: "low",    label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high",   label: "High" },
]

const DIFFICULTY_OPTIONS: { id: DifficultyLevel; label: string }[] = [
  { id: "beginner",     label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced",     label: "Advanced" },
]

const TEAM_STRUCTURE_OPTIONS: { id: TeamStructure; label: string; disabled?: boolean }[] = [
  { id: "crisis_only", label: "Crisis Team only" },
  { id: "it_only",     label: "IT Team only",              disabled: true },
  { id: "crisis_it",   label: "Crisis + IT",               disabled: true },
  { id: "full",        label: "Crisis + IT + Comms/Legal", disabled: true },
]

const PLAN_OPTIONS = [
  { id: "ir_plan",         label: "IR plan available" },
  { id: "crisis_comms_plan", label: "Crisis communication plan" },
  { id: "backup_procedure",  label: "Backup procedure" },
  { id: "nis2_process",      label: "NIS2 process documented" },
  { id: "none",              label: "No documented process" },
]

export function SetupForm() {
  const router = useRouter()
  const [config, setConfig] = useState<ExerciseConfig>(defaults)
  const [mode, setMode] = useState<SimulationMode>("training")
  const [aiIntensity, setAiIntensity] = useState<AiIntensity>("lean")
  const [specialsMode, setSpecialsMode] = useState<SpecialsMode>("static")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [irFileName, setIrFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof ExerciseConfig>(key: K, value: ExerciseConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  function togglePlan(planId: string) {
    const current = config.existingPlans ?? []
    if (current.includes(planId)) {
      update("existingPlans", current.filter(p => p !== planId))
    } else {
      update("existingPlans", [...current, planId])
    }
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
        body: JSON.stringify({ ...config, mode, aiIntensity, specialsMode }),
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
        <span className="font-mono text-xs uppercase tracking-wider text-primary">Simulation mode</span>
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

      {/* Section 1 — Organization profile */}
      <SectionHeader label="Organization profile" />
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

        <FieldRow label="IT maturity" hint="Self-assessed IT capability level">
          <div className="grid grid-cols-3 gap-2">
            {IT_MATURITY_OPTIONS.map(opt => (
              <ToggleButton
                key={opt.id}
                active={config.itMaturity === opt.id}
                onClick={() => update("itMaturity", opt.id)}
                label={opt.label}
              />
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Internal security capability" hint="Current security team setup">
          <Select value={config.securityCapability ?? ""} onValueChange={(v) => update("securityCapability", v as SecurityCapability)}>
            <SelectTrigger><SelectValue placeholder="Select capability…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no_soc">No internal SOC</SelectItem>
              <SelectItem value="small_it">Small IT team</SelectItem>
              <SelectItem value="outsourced_it">Outsourced IT</SelectItem>
              <SelectItem value="it_mssp">IT + MSSP</SelectItem>
              <SelectItem value="it_ir_retainer">IT + IR retainer</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      {/* Section 2 — Exercise setup */}
      <SectionHeader label="Exercise setup" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FieldRow label="Exercise goal" hint="Primary learning objective">
          <Select value={config.exerciseGoal ?? ""} onValueChange={(v) => update("exerciseGoal", v as ExerciseGoal)}>
            <SelectTrigger><SelectValue placeholder="Select goal…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nis2_readiness">NIS2 Readiness</SelectItem>
              <SelectItem value="board_decisions">Board Decision-Making</SelectItem>
              <SelectItem value="crisis_comms">Crisis Communication</SelectItem>
              <SelectItem value="ransomware_tabletop">Ransomware Tabletop</SelectItem>
              <SelectItem value="technical_containment">Technical Containment</SelectItem>
              <SelectItem value="supplier_incident">Supplier Incident</SelectItem>
              <SelectItem value="data_breach">Data Breach</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Scenario type" hint="The primary attack pattern to simulate">
          <Select value={config.scenarioType} onValueChange={(v) => update("scenarioType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{scenarios.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Difficulty" hint="Scenario complexity and decision pressure">
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <ToggleButton
                key={opt.id}
                active={config.difficulty === opt.id}
                onClick={() => update("difficulty", opt.id)}
                label={opt.label}
              />
            ))}
          </div>
        </FieldRow>
      </div>

      {/* Section 3 — Structure */}
      <SectionHeader label="Structure" />
      <div className="grid grid-cols-1 gap-5">
        <FieldRow label="Team structure" hint="Which teams participate in this exercise">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEAM_STRUCTURE_OPTIONS.map(opt => (
              <ToggleButton
                key={opt.id}
                active={config.teamStructure === opt.id}
                onClick={() => !opt.disabled && update("teamStructure", opt.id)}
                label={opt.label}
                disabled={opt.disabled}
              />
            ))}
          </div>
        </FieldRow>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <FieldRow label="Number of rounds" hint="Default is 4">
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5].map(n => (
                <ToggleButton
                  key={n}
                  active={config.roundCount === n}
                  onClick={() => update("roundCount", n)}
                  label={String(n)}
                />
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Timer per round" hint="Minutes per round">
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 30].map(n => (
                <ToggleButton
                  key={n}
                  active={config.timerPerRound === n}
                  onClick={() => update("timerPerRound", n)}
                  label={`${n}m`}
                />
              ))}
            </div>
          </FieldRow>

          <FieldRow label="Total duration" hint="Overall exercise duration target">
            <Select value={config.duration} onValueChange={(v) => update("duration", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{durations.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
        </div>
      </div>

      {/* Section 4 — Existing plans */}
      <SectionHeader label="Existing plans" />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Select all plans the organization currently has documented.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {PLAN_OPTIONS.map(plan => {
            const checked = (config.existingPlans ?? []).includes(plan.id)
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => togglePlan(plan.id)}
                className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left text-sm transition-all ${
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary/40 text-foreground"
                }`}
              >
                <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${checked ? "border-primary bg-primary" : "border-border"}`}>
                  {checked && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                </span>
                {plan.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 5 — Scenario context */}
      <SectionHeader label="Scenario context" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FieldRow label="Critical systems" hint="Systems whose disruption would materially affect operations">
          <Textarea value={config.criticalSystems} onChange={(e) => update("criticalSystems", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
        </FieldRow>
        <FieldRow label="Crown jewels" hint="Most sensitive data or assets to protect">
          <Textarea value={config.crownJewels} onChange={(e) => update("crownJewels", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
        </FieldRow>
      </div>

      {/* Section 6 — AI generation */}
      <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">AI scenario generation</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "off",  label: "Template",  cost: "Free",    model: "",       desc: "Pre-built scenario, no API call." },
            { id: "lean", label: "Smart",     cost: "~€0.002", model: "Haiku",  desc: "AI tailors titles & narrative. Injects from template." },
            { id: "full", label: "Full",      cost: "~€0.05",  model: "Sonnet", desc: "AI writes everything from scratch." },
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

      {/* Section 7 — Special events */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Special events</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Interactive crisis injects — ransomware negotiation chat, AP breach notification form, journalist Q&A. Triggered manually by the facilitator during the session.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "off",    label: "Disabled",  desc: "No special events." },
            { id: "static", label: "Scripted",  desc: "Pre-written scripts. Realistic, no API cost." },
            { id: "ai",     label: "AI-driven", desc: "Claude plays the counterpart. ~€0.01/exchange." },
          ] as { id: SpecialsMode; label: string; desc: string }[]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSpecialsMode(opt.id)}
              className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                specialsMode === opt.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <span className={`font-mono text-sm font-medium ${specialsMode === opt.id ? "text-primary" : "text-foreground"}`}>
                {opt.label}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</span>
            </button>
          ))}
        </div>
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs uppercase tracking-wider text-primary">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

function ToggleButton({ active, onClick, label, disabled }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-center font-mono text-sm transition-all ${
        disabled
          ? "cursor-not-allowed border-border bg-card/50 text-muted-foreground/40 opacity-50"
          : active
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card hover:border-primary/40 text-foreground"
      }`}
    >
      {label}
    </button>
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
