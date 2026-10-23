"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Sparkles, Upload, X, FileText, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
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
import { ROLE_META, ROLE_ORDER } from "@/lib/types"
import type {
  ExerciseConfig, IrRetainerProfile, SimulationMode, AiIntensity, SpecialsMode,
  ITMaturity, SecurityCapability, TeamStructure,
  DifficultyLevel, Role, ScenarioType, ModuleId, GoalId,
} from "@/lib/types"
import { Input } from "@/components/ui/input"
import type { ScenarioGraph } from "@/lib/graph/types"
import { analyzeGraph, type GraphAnalysis } from "@/lib/graph/analyze"
import { findUsedTokens, TOKEN_CONFIG_LABEL } from "@/lib/graph/dynamic-fill"
import type { DynamicFillToken } from "@/lib/graph/types"
import type { TemplateModuleSlot } from "@/lib/types/scenario-instance"
import { DEFAULT_MODULE_SETS } from "@/lib/modules/defaults"
import { MODULE_DEFINITIONS } from "@/lib/modules/definitions"
import { getGoal } from "@/lib/goals/registry"
import type { AdminClient } from "@/lib/admin/clients"
import {
  COMPANY_SIZE_BUCKETS,
  organisationFromClient,
  resolveGraphGoalId,
} from "@/lib/admin/client-config"

// Mapping van UI-scenario-strings naar ScenarioType voor module-defaults
const SCENARIO_TYPE_MAP: Record<string, ScenarioType> = {
  "Ransomware":                   "ransomware_double_extortion",
  "Supply Chain Compromise":      "supply_chain_compromise",
  "Insider Threat":               "insider_threat",
  "Business Email Compromise":    "bec_cfo_fraud",
  "Data Exfiltration":            "ransomware_double_extortion",
  "DDoS / Extortion":             "ransomware_double_extortion",
  "Cloud Account Takeover":       "ransomware_double_extortion",
}

const MODULE_LABELS: Record<ModuleId, string> = {
  detection_sensemaking: "Detection & Sensemaking",
  triage_containment:    "Triage & Containment",
  business_continuity:   "Business Continuity",
  crisis_communication:  "Crisis Communication",
  legal_regulatory:      "Legal & Regulatory",
  ransom_negotiation:    "Ransom Negotiation",
  recovery_lessons:      "Recovery & Lessons Learned",
  insider_investigation: "Insider Investigation",
  supply_chain_response: "Supply Chain Response",
  forensic_attribution:  "Forensic & Attribution",
}

const ALL_MODULE_IDS = Object.keys(MODULE_LABELS) as ModuleId[]

const sectors = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Manufacturing",
  "Retail & E-commerce", "Public Sector", "Technology / SaaS", "Transportation",
]
const sizes: readonly string[] = COMPANY_SIZE_BUCKETS
const scenarios = [
  "Ransomware", "Data Exfiltration", "Insider Threat", "Business Email Compromise",
  "Supply Chain Compromise", "DDoS / Extortion", "Cloud Account Takeover",
]
const durations = ["60 minutes", "90 minutes", "2 hours", "Half day"]

// Smart defaults per total duration: [roundCount, timerPerRound]
const DURATION_DEFAULTS: Record<string, [number, number]> = {
  "60 minutes":  [3, 15],  // 45 min play + 15 min overhead
  "90 minutes":  [4, 15],  // 60 min play + 30 min overhead
  "2 hours":     [4, 20],  // 80 min play + 40 min overhead
  "Half day":    [5, 30],  // 150 min play + discussion time
}
const DURATION_MINUTES: Record<string, number> = {
  "60 minutes": 60,
  "90 minutes": 90,
  "2 hours":    120,
  "Half day":   240,
}

const ALL_ROLES: readonly Role[] = ROLE_ORDER
const CRISIS_ROLES: readonly Role[] = ALL_ROLES.filter(r => ROLE_META[r].team === "crisis_management")

// Reading a token's config value, so the warning below can compare what is set
// now against the default it shipped with.
const TOKEN_CONFIG_VALUE: Record<DynamicFillToken, (c: ExerciseConfig) => string | undefined> = {
  sector: c => c.sector,
  companySize: c => c.companySize,
  crownJewels: c => c.crownJewels,
  criticalSystems: c => c.criticalSystems,
  irRetainerName: c => c.irRetainerName,
}

// De vier organisatievelden starten LEEG en niet op een voorbeeldorganisatie.
// Deze waarden komen in de teksten die deelnemers lezen (play-view toont ze,
// {{token}}-scenario's vullen ze in, document-generator gebruikt ze). Stond
// hier "Financial Services" voorgevuld, dan kreeg een onderwijsscenario zonder
// klant stilzwijgend een bank als organisatie mee en las de deelnemer onware
// feiten (issue #105). Leeg is zichtbaar fout; fout voorgevuld is onzichtbaar
// fout. Hangt het scenario onder een klant, dan vult het klantdossier ze.
const defaults: ExerciseConfig = {
  sector: "",
  companySize: "",
  criticalSystems: "",
  crownJewels: "",
  scenarioType: "Ransomware",
  duration: "90 minutes",
  itMaturity: "medium",
  securityCapability: "small_it",
  exerciseGoal: "ransomware_tabletop",
  teamStructure: "crisis_only",
  roundCount: 4,
  timerPerRound: 15,
  difficulty: "intermediate",
  existingPlans: [],
  selectedRoles: [...CRISIS_ROLES],
  goalId: "decision_making",
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
  const searchParams = useSearchParams()
  const graphIdFromUrl = searchParams.get("graphId") ?? undefined
  const [graphIdOverride, setGraphIdOverride] = useState<string | undefined>(undefined)
  const graphId = graphIdOverride === "" ? undefined : (graphIdOverride ?? graphIdFromUrl)
  const [config, setConfig] = useState<ExerciseConfig>(defaults)
  const [graphName, setGraphName] = useState<string | null>(null)
  const [graphAnalysis, setGraphAnalysis] = useState<GraphAnalysis | null>(null)
  const [loadedGraph, setLoadedGraph] = useState<ScenarioGraph | null>(null)
  const [graphLoadError, setGraphLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<SimulationMode>("training")
  const [aiIntensity, setAiIntensity] = useState<AiIntensity>(graphId ? "off" : "lean")
  const [specialsMode, setSpecialsMode] = useState<SpecialsMode>("static")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null)
  const [irFileName, setIrFileName] = useState<string | null>(null)
  const [irTruncated, setIrTruncated] = useState<{ original: number; kept: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // De klant van de graph. Zolang die er is zijn de organisatievelden een
  // gegeven; zonder klant blijft de facilitator ze zelf invullen.
  const [client, setClient] = useState<AdminClient | null>(null)
  const [clientLoadError, setClientLoadError] = useState<string | null>(null)
  // Welke configvelden de facilitator in deze sessie zelf heeft aangeraakt.
  // Die overschrijven we niet stil als er daarna nog een klant binnenkomt.
  const [touched, setTouched] = useState<ReadonlySet<keyof ExerciseConfig>>(() => new Set())

  // Validation flags — surfaced to the submit button so invalid configs cannot POST.
  const rounds = config.roundCount ?? 4
  const timer = config.timerPerRound ?? 15
  const totalMin = DURATION_MINUTES[config.duration] ?? 90
  const durationInvalid = rounds * timer > totalMin
  const rolesInvalid = (config.selectedRoles?.length ?? 0) === 0
  const graphMissing = !graphIdOverride && !graphIdFromUrl // resolved below via loadedGraph
  // We only know if a graph is actually loaded after fetchOrCacheGraph runs. Use loadedGraph
  // presence as the definitive check.
  const submitBlocked = durationInvalid || rolesInvalid

  const [moduleSlots, setModuleSlots] = useState<TemplateModuleSlot[]>(() => {
    const type = SCENARIO_TYPE_MAP[defaults.scenarioType] ?? "ransomware_double_extortion"
    return DEFAULT_MODULE_SETS[type] ?? []
  })
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [showAddModule, setShowAddModule] = useState(false)

  function update<K extends keyof ExerciseConfig>(key: K, value: ExerciseConfig[K]) {
    setTouched(prev => prev.has(key) ? prev : new Set(prev).add(key))
    setConfig((c) => ({ ...c, [key]: value }))
  }

  useEffect(() => {
    if (!graphId) {
      setGraphName(null)
      setGraphAnalysis(null)
      setLoadedGraph(null)
      setGraphLoadError(null)
      return
    }
    let cancelled = false
    setGraphLoadError(null)

    function applyGraph(g: ScenarioGraph) {
      setLoadedGraph(g)
      setGraphName(g.name)
      const analysis = analyzeGraph(g)
      setGraphAnalysis(analysis)
      setConfig(c => ({
        ...c,
        selectedRoles: analysis.requiredRoles.length > 0 ? analysis.requiredRoles : c.selectedRoles,
        specialsMode: analysis.suggestedSpecialsMode,
        // Het doel hoort bij het scenario. Een graph zonder doel valt terug op
        // decision_making; dat schrijven we niet terug naar de graph.
        goalId: resolveGraphGoalId(g),
      }))
      setSpecialsMode(analysis.suggestedSpecialsMode)
    }

    // Try localStorage first (works even if the server routes to a fresh instance)
    try {
      const cached = window.localStorage.getItem(`scenario-graph:${graphId}`)
      if (cached) {
        const g = JSON.parse(cached) as ScenarioGraph
        if (g?.id === graphId) applyGraph(g)
      }
    } catch { /* ignore */ }

    fetch("/api/scenario-graph")
      .then(r => r.ok ? r.json() : null)
      .then((data: { graphs?: ScenarioGraph[] }) => {
        if (cancelled) return
        const g = data?.graphs?.find(x => x.id === graphId)
        if (g) {
          applyGraph(g)
        } else {
          // Not on the server — but maybe we already loaded from localStorage above
          // If we still have nothing loaded, show the error.
          setLoadedGraph(prev => {
            if (!prev) setGraphLoadError(`Graph "${graphId}" niet gevonden. Ga terug naar de builder en klik Save.`)
            return prev
          })
        }
      })
      .catch(() => {
        if (!cancelled) setGraphLoadError("Kon graph niet ophalen van de server.")
      })
    return () => { cancelled = true }
  }, [graphId])

  // Klant van de graph ophalen. Geen clientId (of een graph die is losgekoppeld)
  // → geen klant, en de organisatievelden blijven handmatig.
  const clientId = loadedGraph?.clientId
  useEffect(() => {
    if (!clientId) {
      setClient(null)
      setClientLoadError(null)
      return
    }
    let cancelled = false
    setClientLoadError(null)
    fetch("/api/admin/clients")
      .then(r => r.ok ? r.json() : null)
      .then((data: { clients?: AdminClient[] } | null) => {
        if (cancelled) return
        const found = data?.clients?.find(c => c.id === clientId) ?? null
        setClient(found)
        if (!found) setClientLoadError("De klant van dit scenario bestaat niet meer — vul de organisatie hieronder zelf in.")
      })
      .catch(() => {
        if (!cancelled) setClientLoadError("Kon de klantgegevens niet ophalen — vul de organisatie hieronder zelf in.")
      })
    return () => { cancelled = true }
  }, [clientId])

  const clientOrg = useMemo(() => client ? organisationFromClient(client) : null, [client])

  // De klant is het gegeven, maar niet met terugwerkende kracht: een veld dat de
  // facilitator in deze sessie zelf heeft aangepast houdt zijn waarde, en krijgt
  // een notitie dat het afwijkt van de klant.
  useEffect(() => {
    if (!clientOrg) return
    setConfig(c => {
      const next = { ...c }
      if (!touched.has("sector")) next.sector = clientOrg.sector
      if (!touched.has("companySize")) next.companySize = clientOrg.companySize
      if (!touched.has("criticalSystems")) next.criticalSystems = clientOrg.criticalSystems
      if (!touched.has("crownJewels")) next.crownJewels = clientOrg.crownJewels
      if (clientOrg.selectedRoles && !touched.has("selectedRoles")) {
        next.selectedRoles = clientOrg.selectedRoles
      }
      return next
    })
  }, [clientOrg, touched])

  function clientOverrideNote(key: "sector" | "companySize" | "criticalSystems" | "crownJewels"): string | undefined {
    if (!clientOrg) return undefined
    if (!touched.has(key)) return undefined
    if (config[key] === clientOrg[key]) return undefined
    return `Handmatig aangepast voor deze sessie — bij de klant staat: ${clientOrg[key] || "leeg"}`
  }

  const goal = (() => { try { return getGoal(config.goalId ?? resolveGraphGoalId(loadedGraph)) } catch { return null } })()
  const clientRoles = clientOrg?.selectedRoles
  const rolesMissingAtClient = clientRoles
    ? (graphAnalysis?.requiredRoles ?? []).filter(r => !clientRoles.includes(r))
    : []

  function handleDurationChange(dur: string) {
    const [rounds, timer] = DURATION_DEFAULTS[dur] ?? [4, 15]
    setConfig(c => ({ ...c, duration: dur, roundCount: rounds, timerPerRound: timer }))
  }

  function handleTeamStructureChange(ts: TeamStructure) {
    update("teamStructure", ts)
    if (ts === "crisis_only") update("selectedRoles", [...CRISIS_ROLES])
    else if (ts === "it_only") update("selectedRoles", ALL_ROLES.filter(r => ROLE_META[r].team === "technical_it"))
    else update("selectedRoles", [...ALL_ROLES])
  }

  function toggleRole(role: Role) {
    const current = config.selectedRoles ?? []
    if (current.includes(role)) {
      update("selectedRoles", current.filter(r => r !== role))
    } else {
      update("selectedRoles", [...current, role])
    }
  }

  function togglePlan(planId: string) {
    const current = config.existingPlans ?? []
    if (current.includes(planId)) {
      update("existingPlans", current.filter(p => p !== planId))
    } else {
      update("existingPlans", [...current, planId])
    }
  }

  function handleScenarioTypeChange(v: string) {
    update("scenarioType", v)
    const type = SCENARIO_TYPE_MAP[v] ?? "ransomware_double_extortion"
    setModuleSlots(DEFAULT_MODULE_SETS[type] ?? [])
    setExpandedModule(null)
  }

  function moveModule(index: number, dir: -1 | 1) {
    const next = [...moduleSlots]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setModuleSlots(next)
  }

  function removeModule(index: number) {
    if (moduleSlots.length <= 1) return
    setModuleSlots(moduleSlots.filter((_, i) => i !== index))
    setExpandedModule(null)
  }

  function addModule(moduleId: ModuleId) {
    setModuleSlots([...moduleSlots, { module_id: moduleId }])
    setShowAddModule(false)
  }

  function updateModuleSlot(index: number, patch: Partial<TemplateModuleSlot>) {
    const next = [...moduleSlots]
    next[index] = { ...next[index], ...patch }
    setModuleSlots(next)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIrFileName(file.name)
    const text = await file.text()
    const kept = text.slice(0, 12000)
    setIrTruncated(text.length > 12000 ? { original: text.length, kept: 12000 } : null)
    update("irTemplateText", kept)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (durationInvalid) {
      setError(`Rondes × timer (${rounds * timer}m) overschrijdt totale duur (${totalMin}m). Verlaag rondes of timer.`)
      return
    }
    if (rolesInvalid) {
      setError("Selecteer minimaal één rol voordat je de oefening genereert.")
      return
    }
    if (!graphId && !loadedGraph) {
      setError("Deze omgeving werkt alleen met scenario-graphs. Open de Scenario builder, kies of maak een graph, en start van daaruit.")
      return
    }
    setSubmitting(true)
    setError(null)
    setProgress(null)
    try {
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          mode,
          aiIntensity: graphId ? "off" : aiIntensity,
          specialsMode,
          moduleSlots,
          graphId,
          // Send full graph inline as fallback — avoids cross-instance lookup issues
          graph: loadedGraph ?? undefined,
        }),
      })
      if (!res.body) throw new Error("Geen response stream ontvangen")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const event = JSON.parse(line.slice(6)) as { stage: string; pct?: number; label?: string; message?: string }
          if (event.stage === "error") throw new Error(event.message ?? "Aanmaken mislukt")
          if (event.stage === "done") {
            router.push("/admin/prepare")
            return
          }
          if (event.pct !== undefined && event.label) {
            setProgress({ pct: event.pct, label: event.label })
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aanmaken mislukt")
      setSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {graphId && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Sparkles className="size-4 text-primary shrink-0" />
              <p className="font-mono text-xs text-primary">
                Using scenario graph: <span className="font-bold">{graphName ?? graphId}</span> — velden die door de graph worden bepaald zijn grijs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!confirm("Graph loskoppelen? Dan wordt de setup weer een gewone AI-oefening en verlies je de graph-koppeling.")) return
                setGraphIdOverride("")
                setLoadedGraph(null)
                setGraphAnalysis(null)
                setGraphName(null)
              }}
              className="rounded border border-primary/40 bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10"
            >
              Remove graph
            </button>
          </div>
          {graphLoadError && (
            <p className="font-mono text-[11px] text-destructive">{graphLoadError}</p>
          )}
          {graphAnalysis && (
            <div className="flex flex-col gap-1.5 border-t border-primary/20 pt-2 mt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
                  {graphAnalysis.roundCount} round(s)
                </span>
                {graphAnalysis.hasDecisions && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
                    · branching
                  </span>
                )}
                {graphAnalysis.hasOutcomes && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
                    · outcome-driven
                  </span>
                )}
                {graphAnalysis.specialTypes.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
                    · specials: {graphAnalysis.specialTypes.join(", ")}
                  </span>
                )}
              </div>
              {graphAnalysis.requiredRoles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">Required roles:</span>
                  {graphAnalysis.requiredRoles.map(r => (
                    <span key={r} className="rounded border border-primary/40 bg-background px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {ROLE_META[r].label}
                    </span>
                  ))}
                </div>
              )}
              {graphAnalysis.unmatchedDecisionOptions.length > 0 && (
                <p className="font-mono text-[10px] text-yellow-600 dark:text-yellow-400">
                  ⚠ {graphAnalysis.unmatchedDecisionOptions.length} decision option(s) reference an unknown roleAction id — branching may not work automatically.
                </p>
              )}
              {/* These values are substituted into inject and round text, so a
                  default left untouched puts the wrong client in front of the
                  participants — and an empty one leaves a literal {{token}}. */}
              {loadedGraph && (() => {
                const used = findUsedTokens(loadedGraph)
                if (used.length === 0) return null
                const empty = used.filter(t => !TOKEN_CONFIG_VALUE[t](config))
                // Met een klant komen deze waarden uit het klantdossier, dus dan
                // is "nog de standaardwaarde" niet meer het risico.
                const untouched = client ? [] : used.filter(t => {
                  const v = TOKEN_CONFIG_VALUE[t](config)
                  return !!v && v === TOKEN_CONFIG_VALUE[t](defaults)
                })
                if (empty.length === 0 && untouched.length === 0) return null
                return (
                  <div className="flex flex-col gap-1 rounded border border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Dit scenario vult klantgegevens in de teksten
                    </span>
                    {empty.length > 0 && (
                      <p className="font-mono text-[10px] text-destructive">
                        Leeg, deelnemers lezen dan letterlijk {"{{token}}"}: {empty.map(t => TOKEN_CONFIG_LABEL[t]).join(", ")}
                      </p>
                    )}
                    {untouched.length > 0 && (
                      <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
                        Nog de standaardwaarde: {untouched.map(t => `${TOKEN_CONFIG_LABEL[t]} ("${TOKEN_CONFIG_VALUE[t](config)}")`).join(", ")} — pas dit aan naar deze klant.
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Doel — vastgelegd in het scenario, hier alleen ter bevestiging. */}
      <div className="flex flex-col gap-4">
        <SectionHeader label="Doel van de oefening" />
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Uit het scenario</span>
          <span className="font-mono text-sm font-medium text-foreground">{goal?.name ?? "Onbekend doel"}</span>
          {goal?.description && (
            <span className="text-[11px] leading-relaxed text-muted-foreground">{goal.description}</span>
          )}
          {graphId && (
            <a
              href={`/admin/builder?id=${encodeURIComponent(graphId)}`}
              className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              Doel wijzigen in de scenariobuilder
            </a>
          )}
        </div>
      </div>

      {/* Simulation mode selector — one-time keuze bij aanmaken. Kan na start
          niet meer gewijzigd worden. */}
      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Modus (kies nu — vaststaand voor de hele sessie)</span>
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
              {m === "training" ? (
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Elke deelnemer één rol, één device</li>
                  <li>Injects verschijnen alleen bij de betreffende rol</li>
                  <li>Individuele beslissingen + IR-plan adherentie</li>
                </ul>
              ) : (
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Eén notulist per team, één iPad; publiek kijkt mee</li>
                  <li>Alle rollen op één device — switcher kiest actieve rol</li>
                  <li>Alle injects komen op dat device binnen</li>
                  <li>Teamnaam in lobby, leaderboard-scoring tussen teams</li>
                </ul>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1 — Organization profile. Hangt het scenario onder een klant,
          dan is dit een gegeven en geen keuze. */}
      <SectionHeader label="Organisatie" />
      {clientLoadError && (
        <p className="font-mono text-[11px] text-amber-700 dark:text-amber-400">{clientLoadError}</p>
      )}
      {client ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-medium text-foreground">{client.name}</span>
            <a
              href={`/admin/clients/${encodeURIComponent(client.id)}`}
              className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              Klantgegevens wijzigen
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FactRow label="Sector" value={config.sector} note={clientOverrideNote("sector")} />
            <FactRow label="Grootte" value={config.companySize} note={clientOverrideNote("companySize")} />
            <FactRow label="Kritieke systemen" value={config.criticalSystems} note={clientOverrideNote("criticalSystems")} />
            <FactRow label="Kroonjuwelen" value={config.crownJewels} note={clientOverrideNote("crownJewels")} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <FieldRow label="Sector" hint="Branche van de gesimuleerde organisatie">
            <Select value={config.sector} onValueChange={(v) => update("sector", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Grootte" hint="Aantal medewerkers">
            <Select value={config.companySize} onValueChange={(v) => update("companySize", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </FieldRow>
        </div>
      )}

      {/* Section 2 — Exercise setup */}
      <SectionHeader label="Instellingen" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FieldRow label={`Scenario type${graphId ? " (uit graph)" : ""}`} hint={graphId ? "Wordt bepaald door de scenario graph" : "The primary attack pattern to simulate"}>
        <div className={graphId ? "opacity-40 pointer-events-none select-none" : ""}>
          <Select value={config.scenarioType} onValueChange={handleScenarioTypeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{scenarios.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        </FieldRow>

      </div>

      {/* Section 3 — Rollen & tijd */}
      <SectionHeader label="Rollen & tijd" />
      {clientRoles ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Deelnemende rollen — crisisteam van {client?.name}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(config.selectedRoles ?? []).map(r => (
              <span key={r} className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground">
                {ROLE_META[r].label}
              </span>
            ))}
          </div>
          {rolesMissingAtClient.length > 0 && (
            <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
              Dit scenario rekent ook op {rolesMissingAtClient.map(r => ROLE_META[r].label).join(", ")} — die rol staat niet in het crisisteam van deze klant. Vul het crisisteam aan bij de klant of pas het scenario aan.
            </p>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-5">
        <FieldRow label="Deelnemende rollen" hint="Welke rollen doen mee in deze oefening">
          <div className="flex flex-col gap-3">
            {(["crisis_management", "technical_it"] as const).map(team => {
              const teamRoles = ALL_ROLES.filter(r => ROLE_META[r].team === team)
              const teamDisabled = config.teamStructure === "crisis_only" && team === "technical_it"
              return (
                <div key={team} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {team === "crisis_management" ? "Crisis management" : "IT / Technical"}
                    {teamDisabled && <span className="ml-2 opacity-50">(inactive)</span>}
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {teamRoles.map(role => {
                      const meta = ROLE_META[role]
                      const checked = (config.selectedRoles ?? []).includes(role)
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => !teamDisabled && toggleRole(role)}
                          disabled={teamDisabled}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                            teamDisabled
                              ? "cursor-not-allowed border-border bg-card/30 text-muted-foreground/30 opacity-40"
                              : checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card hover:border-primary/40 text-foreground"
                          }`}
                        >
                          <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                            teamDisabled ? "border-border/30" : checked ? "border-primary bg-primary" : "border-border"
                          }`}>
                            {checked && !teamDisabled && <span className="text-primary-foreground text-[9px] font-bold">✓</span>}
                          </span>
                          <span className="font-mono text-xs truncate">{meta.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </FieldRow>

      </div>
      )}

      {/* Section 4 — Context van de organisatie. Met een klant staat dit al
          hierboven als gegeven; zonder klant vult de facilitator het zelf in. */}
      {!client && (
        <>
          <SectionHeader label="Context" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldRow label="Kritieke systemen" hint="Systemen wier uitval materiële impact heeft op de operatie">
              <Textarea value={config.criticalSystems} onChange={(e) => update("criticalSystems", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
            </FieldRow>
            <FieldRow label="Kroonjuwelen" hint="Meest gevoelige data of assets om te beschermen">
              <Textarea value={config.crownJewels} onChange={(e) => update("crownJewels", e.target.value)} rows={3} className="resize-none font-mono text-sm" />
            </FieldRow>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {loadedGraph
            ? `Scenario-graph geladen · ${loadedGraph.name}`
            : (
              <>
                Geen graph geladen — open eerst de{" "}
                <a href="/admin/builder" className="underline text-primary hover:text-primary/80">Scenario builder</a>
                {" "}om er één te maken of te kiezen.
              </>
            )
          }
        </p>
        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={submitting || submitBlocked || !loadedGraph} className="gap-2 font-mono uppercase tracking-wider">
            {submitting ? (
              <><Loader2 className="size-4 animate-spin" />Genereren…</>
            ) : (
              <><Sparkles className="size-4" />Sessie starten</>
            )}
          </Button>
          {submitting && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {progress?.label ?? "Verbinden..."}
                </span>
                <span className="font-mono text-[10px] text-primary">{progress?.pct ?? 0}%</span>
              </div>
              <div className="h-1 w-full bg-border overflow-hidden rounded-full">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${progress?.pct ?? 0}%` }}
                />
              </div>
              {(progress?.pct ?? 0) >= 30 && (progress?.pct ?? 0) < 75 && (
                <p className="font-mono text-[9px] text-muted-foreground">
                  Dit duurt 20-40 seconden bij smart model. Sluit dit venster niet.
                </p>
              )}
            </div>
          )}
        </div>
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

function FactRow(props: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{props.label}</span>
      <span className="font-mono text-sm text-foreground">{props.value || "—"}</span>
      {props.note && (
        <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">{props.note}</span>
      )}
    </div>
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

function IrRetainerProfileEditor({
  value,
  onChange,
}: {
  value: IrRetainerProfile | undefined
  onChange: (v: IrRetainerProfile | undefined) => void
}) {
  const p: IrRetainerProfile = value ?? {
    name: "",
    activationNumber: "",
    scopeIncludes: [],
    scopeExcludes: [],
  }
  function patch(next: Partial<IrRetainerProfile>) {
    onChange({ ...p, ...next })
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <FieldRow label="Naam retainer-partij">
        <Input value={p.name} onChange={e => patch({ name: e.target.value })} />
      </FieldRow>
      <FieldRow label="24/7 nummer">
        <Input value={p.activationNumber} onChange={e => patch({ activationNumber: e.target.value })} placeholder="+31 ..." />
      </FieldRow>
      <FieldRow label="E-mail (optioneel)">
        <Input value={p.activationEmail ?? ""} onChange={e => patch({ activationEmail: e.target.value || undefined })} />
      </FieldRow>
      <FieldRow label="Scope includes (één per regel)">
        <Textarea rows={2} value={p.scopeIncludes.join("\n")} onChange={e => patch({ scopeIncludes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} />
      </FieldRow>
      <FieldRow label="Scope excludes (één per regel)">
        <Textarea rows={2} value={p.scopeExcludes.join("\n")} onChange={e => patch({ scopeExcludes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} />
      </FieldRow>
    </div>
  )
}
