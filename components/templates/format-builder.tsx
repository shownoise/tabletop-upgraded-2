"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Save, Eye, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import type { ScenarioTemplate, RoundTemplate, InjectTemplate, DecisionPoint } from "@/lib/template-types"
import { addTemplate } from "@/lib/template-store"

function genId() { return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }

const EMPTY_INJECT: () => InjectTemplate = () => ({
  id: genId(),
  type: "alert",
  channel: "system_alert",
  urgency: "medium",
  title: "",
  content: "",
  aiPromptHint: "",
  showNotes: "",
  context: "",
  expectedActions: [],
})

const EMPTY_ROUND: () => RoundTemplate = () => ({
  id: genId(),
  title: "",
  situationUpdateTemplate: "",
  timerMinutes: 10,
  injects: [EMPTY_INJECT()],
  requireAllFeedback: true,
  facilitatorNotes: {
    discussionGoal: "",
    keyQuestions: [""],
    hints: [""],
    expectedDecisions: [""],
    redFlags: [""],
    debriefPoints: [""],
  },
})

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StringListField({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex flex-col gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              onChange={e => { const n = [...values]; n[i] = e.target.value; onChange(n) }}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40"
              placeholder={`${label} ${i + 1}`}
            />
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button onClick={() => onChange([...values, ""])} className="flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors">
          <Plus className="size-3" /> Add
        </button>
      </div>
    </div>
  )
}

function InjectEditor({ inject, onChange, onDelete, index }: {
  inject: InjectTemplate
  onChange: (u: InjectTemplate) => void
  onDelete: () => void
  index: number
}) {
  const [open, setOpen] = useState(index === 0)
  const u = (patch: Partial<InjectTemplate>) => onChange({ ...inject, ...patch })

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {inject.channel} · {inject.urgency}
          </span>
          <span className="font-mono text-xs text-foreground truncate max-w-[200px]">{inject.title || "(untitled inject)"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="size-3.5" />
          </button>
          {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border">
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Field label="Type">
              <select value={inject.type} onChange={e => u({ type: e.target.value as any })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none font-mono">
                {["alert","intel","media","executive","technical","regulatory","social","internal"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Channel">
              <select value={inject.channel} onChange={e => u({ channel: e.target.value as any })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none font-mono">
                {["whatsapp","slack","email","siem_alert","sms","phone","news_ticker","system_alert","raw"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Urgency">
              <select value={inject.urgency} onChange={e => u({ urgency: e.target.value as any })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none font-mono">
                {["low","medium","high","critical"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Title">
            <input value={inject.title ?? ""} onChange={e => u({ title: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="Alert title…" />
          </Field>
          <Field label="Content" hint="Shown to participants. Use {placeholders} for AI fill-in.">
            <textarea value={inject.content ?? ""} onChange={e => u({ content: e.target.value })} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
          </Field>
          <Field label="Sender name / handle">
            <div className="grid grid-cols-2 gap-2">
              <input value={inject.senderName ?? ""} onChange={e => u({ senderName: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="Name" />
              <input value={inject.senderHandle ?? ""} onChange={e => u({ senderHandle: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="handle / email" />
            </div>
          </Field>
          <Field label="AI prompt hint" hint="Used in hybrid mode — the AI uses this to generate content">
            <input value={inject.aiPromptHint ?? ""} onChange={e => u({ aiPromptHint: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="e.g. Generate a realistic SIEM alert about C2 beaconing for {sector}…" />
          </Field>
          <Field label="Show notes (facilitator only)">
            <textarea value={inject.showNotes ?? ""} onChange={e => u({ showNotes: e.target.value })} rows={2} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
          </Field>
        </div>
      )}
    </div>
  )
}

function RoundEditor({ round, onChange, onDelete, index }: {
  round: RoundTemplate
  onChange: (u: RoundTemplate) => void
  onDelete: () => void
  index: number
}) {
  const [open, setOpen] = useState(true)
  const u = (patch: Partial<RoundTemplate>) => onChange({ ...round, ...patch })

  function updateInject(i: number, upd: InjectTemplate) {
    const injects = [...round.injects]; injects[i] = upd; u({ injects })
  }
  function deleteInject(i: number) {
    u({ injects: round.injects.filter((_, j) => j !== i) })
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/10 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-primary">R{index + 1}</span>
          <span className="font-mono text-sm font-semibold text-foreground">{round.title || "(untitled round)"}</span>
          <span className="font-mono text-[10px] text-muted-foreground">· {round.injects.length} injects · {round.timerMinutes}m</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="size-4" />
          </button>
          {open ? <ChevronUp className="size-4 text-primary" /> : <ChevronDown className="size-4 text-primary" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-primary/20">
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Field label="Round title">
              <input value={round.title} onChange={e => u({ title: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="e.g. Initial Detection" />
            </Field>
            <Field label="Timer (minutes)">
              <input type="number" value={round.timerMinutes} onChange={e => u({ timerMinutes: Number(e.target.value) })} min={5} max={60} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
            </Field>
          </div>

          <Field label="Situation update" hint="Use {company}, {sector}, {systems}, {crown} as placeholders">
            <textarea value={round.situationUpdateTemplate} onChange={e => u({ situationUpdateTemplate: e.target.value })} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
          </Field>

          <div className="flex items-center gap-2">
            <input type="checkbox" id={`req-${round.id}`} checked={round.requireAllFeedback ?? false} onChange={e => u({ requireAllFeedback: e.target.checked })} className="rounded" />
            <label htmlFor={`req-${round.id}`} className="font-mono text-xs text-muted-foreground cursor-pointer">Require all participant feedback before progressing</label>
          </div>

          {/* Injects */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Injects ({round.injects.length})</span>
              <button onClick={() => u({ injects: [...round.injects, EMPTY_INJECT()] })} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors">
                <Plus className="size-3" /> Add inject
              </button>
            </div>
            {round.injects.map((inj, i) => (
              <InjectEditor key={inj.id} inject={inj} onChange={u2 => updateInject(i, u2)} onDelete={() => deleteInject(i)} index={i} />
            ))}
          </div>

          {/* Facilitator notes (collapsed) */}
          <details className="rounded-xl border border-border bg-background">
            <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">Facilitator notes</summary>
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border mt-0">
              <Field label="Discussion goal">
                <input value={round.facilitatorNotes.discussionGoal} onChange={e => u({ facilitatorNotes: { ...round.facilitatorNotes, discussionGoal: e.target.value } })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
              </Field>
              <StringListField label="Key questions" values={round.facilitatorNotes.keyQuestions} onChange={v => u({ facilitatorNotes: { ...round.facilitatorNotes, keyQuestions: v } })} />
              <StringListField label="Red flags" values={round.facilitatorNotes.redFlags} onChange={v => u({ facilitatorNotes: { ...round.facilitatorNotes, redFlags: v } })} />
              <StringListField label="Debrief points" values={round.facilitatorNotes.debriefPoints} onChange={v => u({ facilitatorNotes: { ...round.facilitatorNotes, debriefPoints: v } })} />
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

// ─── Validation ───
function validate(t: Partial<ScenarioTemplate>): string[] {
  const errors: string[] = []
  if (!t.name?.trim()) errors.push("Template name is required")
  if (!t.operationName?.trim()) errors.push("Operation name is required")
  if (!t.rounds?.length) errors.push("At least one round is required")
  t.rounds?.forEach((r, i) => {
    if (!r.title.trim()) errors.push(`Round ${i + 1}: title is required`)
    if (!r.injects.length) errors.push(`Round ${i + 1}: at least one inject is required`)
    r.injects.forEach((inj, j) => {
      if (!inj.title?.trim()) errors.push(`Round ${i + 1}, inject ${j + 1}: title is required`)
    })
  })
  return errors
}

export function FormatBuilder({ initial }: { initial?: ScenarioTemplate }) {
  const [template, setTemplate] = useState<Partial<ScenarioTemplate>>(initial ?? {
    id: genId(),
    name: "",
    operationName: "",
    description: "",
    tags: [],
    difficulty: "intermediate",
    contentMode: "hybrid",
    version: "1.0",
    estimatedDurationMinutes: 90,
    rounds: [EMPTY_ROUND()],
    organizationContext: { name: "{company}", sector: "{sector}", size: "{size}", criticalSystems: "{systems}", crownJewels: "{crown}" },
    outcomes: { good: [""], bad: [""], debriefQuestions: [""] },
  })
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const u = (patch: Partial<ScenarioTemplate>) => setTemplate(prev => ({ ...prev, ...patch }))

  function updateRound(i: number, r: RoundTemplate) {
    const rounds = [...(template.rounds ?? [])]; rounds[i] = r; u({ rounds })
  }
  function deleteRound(i: number) {
    u({ rounds: (template.rounds ?? []).filter((_, j) => j !== i) })
  }

  function handleSave() {
    const errs = validate(template)
    setErrors(errs)
    if (errs.length) return
    const full = { ...template, createdAt: template.createdAt ?? Date.now(), updatedAt: Date.now() } as ScenarioTemplate
    addTemplate(full)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const TAGS_OPTIONS = ["ransomware","insider-threat","supply-chain","bec","ddos","cloud-breach","data-exfil","tabletop","technical","executive","beginner","intermediate","advanced","nis2","gdpr"]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/templates" className="flex size-8 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <span className="font-mono text-sm text-foreground">{template.name || "New template"}</span>
          </div>
          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <span className="flex items-center gap-1 font-mono text-xs text-destructive">
                <AlertTriangle className="size-3" /> {errors.length} issues
              </span>
            )}
            <button onClick={handleSave} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${saved ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"}`}>
              <Save className="size-3.5" /> {saved ? "Saved!" : "Save template"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 md:px-8 flex flex-col gap-6">
        {errors.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-destructive">Validation errors</span>
            <ul className="flex flex-col gap-1">
              {errors.map((e, i) => <li key={i} className="text-sm text-destructive/80">· {e}</li>)}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-card px-5 py-5 flex flex-col gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Template metadata</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Template name">
              <input value={template.name} onChange={e => u({ name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="e.g. Ransomware — Full Crisis" />
            </Field>
            <Field label="Operation name">
              <input value={template.operationName} onChange={e => u({ operationName: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="OPERATION BLACK TIDE" />
            </Field>
            <Field label="Difficulty">
              <select value={template.difficulty} onChange={e => u({ difficulty: e.target.value as any })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none">
                {["beginner","intermediate","advanced","expert"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Content mode">
              <select value={template.contentMode} onChange={e => u({ contentMode: e.target.value as any })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none">
                <option value="static">Static (fixed content)</option>
                <option value="ai-generated">AI generated</option>
                <option value="hybrid">Hybrid (AI fills template)</option>
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" value={template.estimatedDurationMinutes} onChange={e => u({ estimatedDurationMinutes: Number(e.target.value) })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" />
            </Field>
            <Field label="Version">
              <input value={template.version} onChange={e => u({ version: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40" placeholder="1.0" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={template.description} onChange={e => u({ description: e.target.value })} rows={2} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-primary/40 resize-none" />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {TAGS_OPTIONS.map(tag => {
                const active = (template.tags ?? []).includes(tag as any)
                return (
                  <button
                    key={tag}
                    onClick={() => u({ tags: active ? (template.tags ?? []).filter(t => t !== tag) : [...(template.tags ?? []), tag as any] })}
                    className={`font-mono text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-md border transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Rounds */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Rounds ({template.rounds?.length ?? 0})</span>
            <button onClick={() => u({ rounds: [...(template.rounds ?? []), EMPTY_ROUND()] })} className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 transition-colors">
              <Plus className="size-3.5" /> Add round
            </button>
          </div>
          {(template.rounds ?? []).map((r, i) => (
            <RoundEditor key={r.id} round={r} index={i} onChange={r2 => updateRound(i, r2)} onDelete={() => deleteRound(i)} />
          ))}
        </div>
      </main>
    </div>
  )
}
