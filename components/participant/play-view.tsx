"use client"

import Link from "next/link"
import { Component, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, CheckCircle, ChevronDown, FileText, Info, Loader2, ShieldAlert, Users } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import type { Inject, LiveEvent, Participant, Role, RoleDocument, SessionState, SpecialEvent, SubmittedDecision } from "@/lib/types"
import { ROLE_META } from "@/lib/types"
import { api } from "@/lib/api-client"
import { getGoal } from "@/lib/goals/registry"
import type { GoalId } from "@/lib/engine/types"
import { InjectFeed } from "./inject-feed"
import { UrgentInjectModal } from "./urgent-inject-modal"
import { RoundTimerCompact } from "./round-timer"
import { SessionHUD } from "./session-hud"
import { FeedbackScreen } from "./feedback-screen"
import { DecisionPanel } from "./decision-panel"
import { SpecialModal } from "./special-modal"
import { Empty } from "@/components/ui/empty"
import { useLang } from "@/lib/use-lang"
import { tr } from "@/lib/i18n"
import { stripMarkdown } from "@/lib/render-markdown"
import { playNotificationSound } from "@/lib/sounds"

const NAME_KEY = "ctt:name"
const ID_KEY = "ctt:participantId"
const ROLE_KEY = "ctt:role"
const FEEDBACK_KEY = "ctt:feedback_rounds"

// ─── Session lead ─────────────────────────────────────────────
// The session lead chairs the meeting: advances BOB/OODA phases.
// Priority: CEO first, then first available crisis management role.
const SESSION_LEAD_PRIORITY: Role[] = [
  'ceo', 'ciso', 'cfo', 'ops_manager', 'legal', 'head_of_comms', 'hr_lead', 'it_manager', 'system_admin',
]

function getSessionLeadRole(participants: { role?: Role | null }[]): Role | null {
  const assigned = new Set(participants.map(p => p.role).filter(Boolean) as Role[])
  return SESSION_LEAD_PRIORITY.find(r => assigned.has(r)) ?? null
}

function stripBobPrefix(text: string): string {
  return text
    .replace(/^\[(Beeldvorming|Oordeelvorming|Besluit(?:vorming)?)\][:\s]*/i, "")
    .replace(/^(Beeldvorming|Oordeelvorming|Besluit(?:vorming)?)\s*[:\-–—]\s*/i, "")
    .trim()
}

// ─── Error boundary ───────────────────────────────────────────
class DecisionBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-center font-mono text-xs text-destructive">
        Decision panel kon niet laden — ververs de pagina.
      </div>
    )
    return this.props.children
  }
}

// ─── Framework explanation ────────────────────────────────────

const FRAMEWORK_DESCRIPTIONS: Partial<Record<string, string>> = {
  bob:     "Discussies volgen BOB: Beeldvorming (wat weten we?), Oordeelsvorming (wat zijn onze opties?) en Besluitvorming (wat besluiten we?). Het crisisteam bewaakt zelf de overgang naar de volgende fase via de knop in het scherm.",
  ooda:    "Discussies volgen de OODA-cyclus: Observe, Orient, Decide, Act. Het crisisteam bepaalt samen wanneer de volgende stap wordt gezet.",
  dair:    "Deze oefening gebruikt DAIR: Detect, Assess, Inform, Respond — de standaard incident response-cyclus.",
  nist_ir: "Deze oefening volgt de NIST IR-cyclus: Prepare, Detect, Contain, Eradicate, Recover, Post-Incident.",
  free:    "Deze oefening gebruikt vrije discussie — geen vast raamwerk. Leg de nadruk op heldere redenering en expliciete beslissingsverantwoordelijkheid.",
}

// ─── Intro overlay ───
function IntroOverlay({
  lang,
  onReady,
  operationName,
  session,
  participantId,
  participantRole,
}: {
  lang: ReturnType<typeof useLang>[0]
  onReady: () => void
  operationName?: string
  session: SessionState | null
  participantId: string | null
  participantRole?: Role
}) {
  const [marking, setMarking] = useState(false)

  const goalId = session?.config.goalId as GoalId | undefined
  const goal = goalId ? (() => { try { return getGoal(goalId) } catch { return null } })() : null
  const frameworkDesc = session?.config.decisionFramework
    ? FRAMEWORK_DESCRIPTIONS[session.config.decisionFramework]
    : FRAMEWORK_DESCRIPTIONS.bob

  async function handleReady() {
    if (participantId && !marking) {
      setMarking(true)
      try { await api.markReady(participantId) } catch { /* ignore */ }
    }
    onReady()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-tt-bg px-4 py-8">
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-20" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-lg flex flex-col gap-6">

        {/* Operation header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-tt-accent" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">CYBER_TABLETOP</span>
          </div>
          {operationName && (
            <h1 className="font-mono text-3xl font-bold tracking-tight text-tt-accent leading-tight">
              {operationName.toUpperCase()}
            </h1>
          )}
          <p className="font-mono text-[10px] text-tt-dim">
            {tr(lang, "welcomeSub")}
          </p>
        </div>

        {/* Goal-specific participant briefing */}
        {goal?.participantBriefing && (
          <div
            className="flex flex-col gap-3 border border-tt-border bg-tt-surface p-5"
            style={{ borderLeft: "3px solid #e8ff40" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
              Waar deze oefening over gaat
            </span>
            {goal.participantBriefing.split("\n").filter(l => l.trim()).map((line, i) => (
              <p key={i} className="font-mono text-xs text-tt-dim leading-relaxed">{line}</p>
            ))}
          </div>
        )}

        {/* Your role */}
        {participantRole && (
          <div className="flex flex-col gap-2 border border-tt-border bg-tt-surface p-4">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">Jouw rol</span>
            <span className="font-mono text-sm font-bold text-tt-bright">{ROLE_META[participantRole].label}</span>
            <p className="font-mono text-[10px] text-tt-dim">{ROLE_META[participantRole].description}</p>
          </div>
        )}

        {/* Framework explanation */}
        {frameworkDesc && (
          <div className="flex flex-col gap-2 border border-tt-border bg-tt-surface p-4">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Hoe beslissingen werken</span>
            <p className="font-mono text-xs text-tt-dim leading-relaxed">{frameworkDesc}</p>
          </div>
        )}

        {/* Generic how it works — only shown when there's no goal-specific briefing (avoids duplicate) */}
        {!goal?.participantBriefing && (
          <div
            className="flex flex-col gap-3 border border-tt-border bg-tt-surface p-5"
            style={{ borderLeft: "3px solid #e8ff40" }}
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
              {tr(lang, "howItWorks")}
            </span>
            {[
              tr(lang, "intro1"),
              tr(lang, "intro2"),
              tr(lang, "intro3"),
              tr(lang, "intro4"),
              tr(lang, "intro5"),
            ].map((s, i) => (
              <div key={i} className="flex gap-3">
                <span className="font-mono text-[10px] text-tt-accent mt-0.5 shrink-0">{i + 1}.</span>
                <p className="font-mono text-xs text-tt-dim leading-relaxed">{s}</p>
              </div>
            ))}
            <div className="border border-tt-border bg-tt-bright/5 px-4 py-2.5 mt-1">
              <p className="font-mono text-[10px] text-tt-dim">{tr(lang, "timerNote")}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleReady}
          disabled={marking}
          className="flex items-center justify-center gap-2 bg-[#e8ff40] px-6 py-4 font-mono text-sm uppercase tracking-widest text-[#0d0f0f] hover:bg-[#e8ff40]/90 transition-colors disabled:opacity-70"
        >
          {tr(lang, "readyBtn")}
        </button>
      </div>
    </div>
  )
}

// ─── Round situation card ───
const SEVERITY_COLORS = ["#e8ff40", "#ffb340", "#ff4d3d", "#ff4d3d"] as const
const SEVERITY_LABELS = ["MEDIUM", "HOOG", "KRITIEK", "KRITIEK"] as const

function RoundSituationCard({ session, lang }: { session: NonNullable<ReturnType<typeof useSessionStream>["state"]["session"]>; lang: ReturnType<typeof useLang>[0] }) {
  const roundIdx = session.currentRound
  const currentRound = roundIdx >= 0 ? session.scenario.rounds[roundIdx] : null
  const [expanded, setExpanded] = useState(true)

  if (!currentRound) return null

  const severityIdx = Math.min(roundIdx, SEVERITY_COLORS.length - 1)
  const severityColor = SEVERITY_COLORS[severityIdx]
  const severityLabel = SEVERITY_LABELS[severityIdx]

  return (
    <div
      className="border border-tt-border bg-tt-surface overflow-hidden"
      style={{ borderLeft: `3px solid ${severityColor}` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/25 border-b border-tt-border hover:bg-black/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[10px] font-bold tracking-widest shrink-0"
            style={{ color: severityColor }}
          >
            {tr(lang, "round").toUpperCase()} {roundIdx + 1}/{session.scenario.rounds.length}
          </span>
          <span className="font-mono text-[10px] text-tt-dim truncate">{currentRound.title}</span>
          <span
            className="hidden sm:inline font-mono text-[9px] border px-1.5 py-0.5"
            style={{ color: severityColor, borderColor: `${severityColor}40` }}
          >
            {severityLabel}
          </span>
        </div>
        <ChevronDown
          className="size-4 text-tt-dim shrink-0 transition-transform ml-2"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 pt-4">
          <p className="font-mono text-xs leading-relaxed text-tt-bright whitespace-pre-wrap">
            {stripMarkdown(currentRound.situation_update)}
          </p>

          {currentRound.learningObjectives && currentRound.learningObjectives.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-tt-border pt-3">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                Ronde doelen
              </span>
              {currentRound.learningObjectives.map(obj => (
                <div key={obj.id} className="flex items-start gap-2">
                  <span className={`font-mono text-[10px] shrink-0 mt-px ${obj.achieved ? "text-tt-green" : "text-[#2a3030]"}`}>
                    {obj.achieved ? "✓" : "□"}
                  </span>
                  <span className={`font-mono text-[10px] leading-snug ${obj.achieved ? "text-tt-green" : "text-tt-dim"}`}>
                    {obj.description}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border border-tt-border bg-tt-bright/5 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-tt-dim mb-2">
              {tr(lang, "roundIntro")}
            </p>
            <ul className="flex flex-col gap-1.5">
              {[
                tr(lang, "roundInstruction1"),
                tr(lang, "roundInstruction2"),
                tr(lang, "roundInstruction3"),
              ].map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[10px] shrink-0" style={{ color: severityColor }}>→</span>
                  <span className="font-mono text-[10px] text-tt-dim">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Real-time role picker (lobby) ───────────────────────────

const CRISIS_ROLES_ORDERED: Role[] = [
  "ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager",
]

function RolePickerLobby({
  session,
  participantId,
  myRole,
  lang,
}: {
  session: SessionState
  participantId: string
  myRole: Role | undefined
  lang: ReturnType<typeof useLang>[0]
}) {
  const [claiming, setClaiming] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)

  const takenRoles = new Map<Role, Participant>()
  for (const p of session.participants) {
    if (p.role) takenRoles.set(p.role, p)
  }

  async function claimRole(role: Role) {
    if (claiming) return
    setClaiming(role)
    setError(null)
    try {
      await api.assignRole({ participantId, role })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rol claimen mislukt")
    } finally {
      setClaiming(null)
    }
  }

  const ALL_ROLES_ORDERED: Role[] = [
    "ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager",
    "it_manager", "system_admin",
  ]
  const allowedRoles: Role[] = (session.config.selectedRoles?.length ?? 0) > 0
    ? ALL_ROLES_ORDERED.filter(r => session.config.selectedRoles!.includes(r))
    : CRISIS_ROLES_ORDERED

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Kies uw rol</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Elke rol kan maar door één deelnemer worden geclaimd. De facilitator start de oefening zodra iedereen klaar is.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {allowedRoles.map(role => {
          const meta = ROLE_META[role]
          const takenBy = takenRoles.get(role)
          const isMine = myRole === role
          const isTaken = !!takenBy && !isMine
          const isClaiming = claiming === role

          return (
            <button
              key={role}
              onClick={() => !isTaken && !isMine && claimRole(role)}
              disabled={isTaken || isClaiming || !!claiming}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed ${
                isMine
                  ? "border-primary bg-primary/10"
                  : isTaken
                  ? "border-border bg-card/30 opacity-50"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {isClaiming ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary mt-0.5" />
              ) : isMine ? (
                <CheckCircle className="size-4 shrink-0 text-primary mt-0.5" />
              ) : (
                <div className={`size-4 shrink-0 mt-0.5 rounded-full border-2 ${isTaken ? "border-border" : "border-primary/40"}`} />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className={`font-mono text-sm font-medium ${isMine ? "text-primary" : isTaken ? "text-muted-foreground" : "text-foreground"}`}>
                  {meta.label}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight">{meta.description}</span>
                {isTaken && takenBy && (
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    Geclaimd door {takenBy.name}
                  </span>
                )}
                {isMine && (
                  <span className="font-mono text-[10px] text-primary mt-0.5">Uw rol</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {myRole && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background px-4 py-3">
          <CheckCircle className="size-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            U speelt als <span className="font-semibold text-foreground">{ROLE_META[myRole].label}</span>. Wacht tot de facilitator de oefening start.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Role documents panel ───
function RoleDocumentsPanel({ docs }: { docs: RoleDocument[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (docs.length === 0) return null
  const typeLabel: Record<string, string> = {
    policy: "Polis", checklist: "Checklist", template: "Sjabloon", plan: "Plan", reference: "Referentie",
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
        <FileText className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Uw documenten</span>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {docs.map(doc => (
          <div key={doc.id}>
            <button
              onClick={() => setOpenId(openId === doc.id ? null : doc.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{typeLabel[doc.type] ?? doc.type}</span>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground shrink-0 ml-2 transition-transform ${openId === doc.id ? "rotate-180" : ""}`} />
            </button>
            {openId === doc.id && (
              <div className="px-4 pb-4 border-t border-border bg-muted/20">
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed font-mono pt-3 overflow-x-auto">{doc.content}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Escalation overlay ───
function EscalationOverlay({ roundIndex }: { roundIndex: number }) {
  if (roundIndex < 2) return null
  const isCritical = roundIndex >= 3
  return (
    <div className={`pointer-events-none fixed inset-x-0 top-0 z-20 h-1.5 ${
      isCritical
        ? "bg-destructive animate-pulse"
        : "bg-orange-500/70"
    }`} />
  )
}

// ─── Main view ───
export function PlayView() {
  const [lang, setLang] = useLang()
  const { state, connected, onEvent } = useSessionStream()
  const [name, setName] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [urgent, setUrgent] = useState<Inject | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string; type?: string } | null>(null)
  const [feedbackFor, setFeedbackFor] = useState<{ round: number; isFinal: boolean } | null>(null)
  const [specialDismissed, setSpecialDismissed] = useState<Set<string>>(new Set())
  const [timerPaused, setTimerPaused] = useState(false)
  const [soundMutedState, setSoundMutedState] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem("ctt:sound_muted") === "true" } catch { return false }
  })
  const [doneFeedbackRounds, setDoneFeedbackRounds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set<number>()
    try {
      const stored = localStorage.getItem(FEEDBACK_KEY)
      return stored ? new Set<number>(JSON.parse(stored)) : new Set<number>()
    } catch { return new Set<number>() }
  })
  const prevRoundRef = useRef<number>(-1)
  const sessionIdRef = useRef<string | null>(null)
  // Cached role from sessionStorage — only read client-side to avoid hydration mismatch
  const [storedRole, setStoredRole] = useState<Role | undefined>(undefined)

  useEffect(() => {
    try {
      setName(window.localStorage.getItem(NAME_KEY))
      setParticipantId(window.localStorage.getItem(ID_KEY))
      const r = window.sessionStorage.getItem(ROLE_KEY)
      if (r) setStoredRole(r as Role)
    } catch {}
  }, [])

  const session = state.session

  // Derive participant role from session (authoritative) or sessionStorage fallback.
  // Never reads window directly — avoids hydration mismatch and null-session crashes.
  const participantRole: Role | undefined = useMemo(() => {
    if (session && participantId) {
      const p = session.participants.find(p => p.id === participantId)
      if (p?.role) return p.role
    }
    return storedRole
  }, [session, participantId, storedRole])

  // Session lead: chairs the meeting, advances BOB/OODA phases
  const sessionLeadRole = useMemo(
    () => session ? getSessionLeadRole(session.participants) : null,
    [session?.participants]
  )
  const isSessionLead = !!participantRole && participantRole === sessionLeadRole

  // Detect round transitions → trigger feedback
  useEffect(() => {
    if (!session) return
    // Reset prevRound tracking when a new session replaces the old one
    if (session.id !== sessionIdRef.current) {
      sessionIdRef.current = session.id
      prevRoundRef.current = -1
      setDoneFeedbackRounds(new Set<number>())
      try { localStorage.removeItem(FEEDBACK_KEY) } catch {}
    }
    const idx = session.currentRound
    // Key stored as prevRoundRef.current + 1 (1-indexed) in handleFeedbackDone
    if (idx !== prevRoundRef.current && prevRoundRef.current >= 0 && !doneFeedbackRounds.has(prevRoundRef.current + 1)) {
      setFeedbackFor({ round: prevRoundRef.current + 1, isFinal: false })
    }
    if (session.status === "ended" && !doneFeedbackRounds.has(-1)) {
      setFeedbackFor({ round: session.scenario.rounds.length, isFinal: true })
    }
    prevRoundRef.current = idx
  }, [session?.currentRound, session?.status, session?.id])

  // Derived: find the special assigned to this participant (not dismissed)
  const activeSpecial = useMemo(() => {
    if (!participantId || !session) return null
    return (session.specialEvents ?? []).find(
      sp => sp.assignedParticipantId === participantId && !specialDismissed.has(sp.id)
    ) ?? null
  }, [session, participantId, specialDismissed])

  const soundMuted = () => { try { return localStorage.getItem("ctt:sound_muted") === "true" } catch { return false } }

  useEffect(() => {
    return onEvent((e: LiveEvent) => {
      if (e.name === "special_triggered") {
        if (!soundMuted()) playNotificationSound('inject')
        setBanner({ id: Date.now(), text: "Er is een speciaal event getriggerd!", type: "special" })
      } else if (e.name === "push_inject" || e.name === "surprise_inject") {
        const inj = (e.payload as { inject?: Inject }).inject
        if (inj && (inj.urgency === "critical" || e.name === "surprise_inject")) {
          if (!soundMuted()) playNotificationSound('urgent')
          setUrgent(inj)
        } else if (inj) {
          if (!soundMuted()) playNotificationSound('inject')
          setBanner({ id: Date.now(), text: `Nieuw inject: ${inj.title}`, type: "inject" })
        }
      } else if (e.name === "next_round") {
        const idx = (e.payload as { roundIndex?: number }).roundIndex
        if (!soundMuted()) playNotificationSound('round')
        if (typeof idx === "number") setBanner({ id: Date.now(), text: tr(lang, "round") + ` ${idx + 1} — ${session?.scenario.rounds[idx]?.title ?? ""}`, type: "round" })
      } else if (e.name === "start_session") {
        if (!soundMuted()) playNotificationSound('round')
        setBanner({ id: Date.now(), text: "Oefening gestart", type: "start" })
      } else if (e.name === "session_ended") {
        setBanner({ id: Date.now(), text: "Oefening afgerond", type: "end" })
      }
    })
  }, [onEvent, lang, session])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  const currentRound = useMemo(() => {
    if (!session || session.currentRound < 0) return null
    return session.scenario.rounds[session.currentRound] ?? null
  }, [session])

  function handleFeedbackDone(fb: { worked: string; didnt: string; gap: string }) {
    if (!feedbackFor) return
    const key = feedbackFor.isFinal ? -1 : feedbackFor.round
    const next = new Set(doneFeedbackRounds).add(key)
    setDoneFeedbackRounds(next)
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify([...next])) } catch {}
    setFeedbackFor(null)
  }

  const [slowLoad, setSlowLoad] = useState(false)
  useEffect(() => {
    if (session) return
    const t = setTimeout(() => setSlowLoad(true), 4000)
    return () => clearTimeout(t)
  }, [session])

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Empty>
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            {connected ? tr(lang, "waitingToStart") : "Verbinding maken…"}
          </h2>
          <p className="mt-1 max-w-sm text-muted-foreground">
            {slowLoad
              ? "Duurt langer dan verwacht. Controleer je verbinding."
              : connected
              ? "Wacht op de facilitator om de oefening te starten."
              : "Verbinding met server…"}
          </p>
          {slowLoad && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent"
            >
              Pagina vernieuwen
            </button>
          )}
          <Link href="/join" className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground hover:bg-accent">
            <ArrowLeft className="size-3.5" /> Terug
          </Link>
        </Empty>
      </div>
    )
  }

  const status = session.status

  return (
    <div className="min-h-screen bg-background">
      {/* Intro overlay */}
      {showIntro && session.status === "lobby" && (
        <IntroOverlay
          lang={lang}
          onReady={() => setShowIntro(false)}
          operationName={session.scenario.scenario_title}
          session={session}
          participantId={participantId}
          participantRole={participantRole}
        />
      )}

      {/* Special event modal */}
      {activeSpecial && participantId && (
        <SpecialModal
          special={activeSpecial}
          participantId={participantId}
          onClose={() => setSpecialDismissed(prev => new Set(prev).add(activeSpecial.id))}
        />
      )}

      {/* Feedback screen */}
      {feedbackFor && (
        <FeedbackScreen
          roundNumber={feedbackFor.round}
          totalRounds={session.scenario.rounds.length}
          isFinal={feedbackFor.isFinal}
          lang={lang}
          onContinue={handleFeedbackDone}
        />
      )}

      {/* Escalation overlay */}
      {session.status === "active" && session.currentRound >= 0 && (
        <EscalationOverlay roundIndex={session.currentRound} />
      )}

      {/* HUD header */}
      <SessionHUD session={session} connected={connected} name={name} participantRole={participantRole} lang={lang} setLang={setLang} />

      {/* Round timer + inline banner zone */}
      {currentRound && (
        <div className="sticky top-[52px] z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2 md:px-8">
            <RoundTimerCompact
              roundStartedAt={session.roundStartedAt}
              timerMinutes={currentRound.timerMinutes ?? 10}
              status={status}
              lang={lang}
              paused={session.roundPhase === "discussion" ? timerPaused : undefined}
              onTogglePause={session.roundPhase === "discussion" ? () => setTimerPaused(p => !p) : undefined}
            />
            {banner && (
              <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 border font-mono text-xs animate-fade-in ${
                banner.type === "round" ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}>
                <span className="size-1.5 rounded-full bg-current animate-pulse" />
                {banner.text}
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => {
                const next = !soundMutedState
                setSoundMutedState(next)
                try { localStorage.setItem("ctt:sound_muted", next ? "true" : "false") } catch {}
              }}
              title={soundMutedState ? "Geluid inschakelen" : "Geluid uitschakelen"}
              className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border px-2 py-1 shrink-0"
            >
              {soundMutedState ? "🔇" : "🔔"}
            </button>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {status === "lobby" ? tr(lang, "waitingToStart") :
               status === "ended" ? tr(lang, "exerciseEnded") :
               tr(lang, "roundOf", { n: String(session.currentRound + 1), total: String(session.scenario.rounds.length) })}
            </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Feed — main column; flex allows order-first on DecisionPanel for mobile */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Round situation */}
            {currentRound ? (
              <RoundSituationCard session={session} lang={lang} />
            ) : status === "lobby" ? (
              participantId ? (
                <RolePickerLobby
                  session={session}
                  participantId={participantId}
                  myRole={participantRole}
                  lang={lang}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card/50 py-12 text-center">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => <span key={i} className="size-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i*0.3}s` }} />)}
                  </div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "waitingToStart")}</p>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-border bg-card/50 py-8 text-center">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{tr(lang, "exerciseEnded")}</p>
              </div>
            )}

            {/* DECISION PHASE — pinned to top on mobile, natural order on desktop */}
            {session.roundPhase === "decision" && currentRound?.roleActions && participantId && (() => {
              const roundDecisions = (session.submittedDecisions ?? []).filter(d => d.roundIndex === session.currentRound)
              const totalPlayers = session.participants.filter(p => p.role).length
              return (
                <div className="order-first lg:order-none flex flex-col gap-2">
                  {totalPlayers > 0 && (
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-tt-dim">
                      <span className="size-1.5 rounded-full bg-tt-accent animate-pulse" />
                      {roundDecisions.length}/{totalPlayers} {roundDecisions.length === 1 ? "beslissing" : "beslissingen"} ingediend
                    </div>
                  )}
                  <DecisionBoundary>
                    <DecisionPanel
                      key={`decision-${session.currentRound}`}
                      roundIndex={session.currentRound}
                      roundActions={currentRound.roleActions}
                      participantId={participantId}
                      participantName={name ?? ""}
                      participantRole={participantRole}
                      existingDecision={(session.submittedDecisions ?? []).find(
                        d => d.participantId === participantId && d.roundIndex === session.currentRound
                      ) as SubmittedDecision | undefined}
                      lang={lang}
                    />
                  </DecisionBoundary>
                </div>
              )
            })()}

            {/* DISCUSSION PHASE — BOB/OODA phase prompt + stepper, then prep */}
            {session.roundPhase === "discussion" && (() => {
              const framework = session.config?.decisionFramework
              const hasBobOoda = framework === 'bob' || framework === 'ooda'
              const phaseIndex = session.currentDiscussionPhaseIndex ?? -1
              const totalPhases = framework === 'ooda' ? 4 : 3
              const isLastPhase = phaseIndex >= totalPhases - 1
              return (
                <>
                  {session.currentDiscussionPrompt && (
                    <div
                      className="border border-tt-border bg-tt-surface overflow-hidden"
                      style={{ borderLeft: "3px solid var(--tt-accent)" }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5 bg-tt-bright/5 border-b border-tt-border">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
                            Discussie — huidige fase
                          </span>
                          {hasBobOoda && phaseIndex >= 0 && (
                            <span className="font-mono text-[9px] text-tt-dim">
                              {phaseIndex + 1}/{totalPhases}
                            </span>
                          )}
                        </div>
                        {isSessionLead && hasBobOoda && !isLastPhase && (
                          <button
                            onClick={async () => {
                              try {
                                await api.setDiscussionPhase({
                                  roundNumber: session.currentRound,
                                  phaseIndex: phaseIndex + 1,
                                  action: 'set',
                                })
                              } catch { /* ignore */ }
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest text-tt-dim hover:text-tt-accent border border-tt-border/50 hover:border-tt-accent/40 px-2.5 py-1 transition-colors"
                          >
                            Volgende fase →
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-sm text-tt-bright leading-relaxed p-4">{session.currentDiscussionPrompt}</p>
                      {isLastPhase && (
                        <div className="border-t border-tt-border px-4 py-2.5 flex items-center gap-2 bg-tt-accent/5">
                          <span className="size-1.5 rounded-full bg-tt-accent animate-pulse shrink-0" />
                          <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
                            {isSessionLead
                              ? "Alle fases doorlopen — wacht op beslissing van de facilitator"
                              : "Alle fases doorlopen — het beslismoment komt eraan"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Discussion prep — previews role-specific decisions */}
                  {currentRound?.roleActions && participantRole && (() => {
                    const myActions = currentRound.roleActions!.filter(
                      a => a.allowedRoles.length === 0 || a.allowedRoles.includes(participantRole)
                    )
                    if (myActions.length === 0) return null
                    return (
                      <div
                        className="border border-tt-border bg-tt-surface overflow-hidden"
                        style={{ borderLeft: "3px solid color-mix(in srgb, var(--tt-accent) 30%, transparent)" }}
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-tt-bright/5 border-b border-tt-border">
                          <span className="font-mono text-[10px] font-bold tracking-widest text-tt-accent">VOORBEREIDING — {ROLE_META[participantRole].label.toUpperCase()}</span>
                          <span className="font-mono text-[9px] text-tt-dim ml-auto">Straks te beslissen</span>
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Jouw keuzes in deze ronde — bedenk welke actie je gaat bepleiten en waarom</p>
                          {myActions.map(action => (
                            <div key={action.id} className="flex items-start gap-3 border border-tt-border px-3 py-2.5"
                              style={{ borderLeft: "3px solid color-mix(in srgb, var(--tt-accent) 30%, transparent)" }}>
                              <span className="font-mono text-[9px] text-tt-accent shrink-0 mt-0.5">
                                {action.isRecommended ? "★" : "○"}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-xs text-tt-bright">{stripMarkdown(stripBobPrefix(action.label))}</span>
                                {action.description && (
                                  <p className="font-mono text-[10px] text-tt-dim leading-relaxed">{stripMarkdown(stripBobPrefix(action.description))}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </>
              )
            })()}

            {/* Inject feed — always shown for context */}
            <InjectFeed pushed={session.pushedInjects} lang={lang} participantRole={participantRole} />
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Players */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "players")}</span>
              </div>
              <ul aria-label="Deelnemers in deze oefening" className="flex flex-col divide-y divide-border max-h-48 overflow-y-auto">
                {session.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div aria-hidden="true" className="size-6 rounded-full border border-border bg-background font-mono text-[9px] uppercase text-muted-foreground flex items-center justify-center">
                        {p.name.slice(0, 2)}
                      </div>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.role && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-primary">
                          {ROLE_META[p.role].label}
                        </span>
                      )}
                      {p.role && p.role === sessionLeadRole && (
                        <span title="Voorzitter" className="font-mono text-[9px] text-tt-accent">⬡</span>
                      )}
                      <span className="size-1.5 rounded-full bg-primary" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Documents — filtered to this participant's role */}
            {participantRole && (() => {
              const myDocs = (session.documents ?? []).filter(d => d.targetRole === participantRole)
              return <RoleDocumentsPanel docs={myDocs} />
            })()}

            {/* Role authorities card — shown when participant has a role */}
            {participantRole && (() => {
              const meta = ROLE_META[participantRole]
              return (
                <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-primary/15">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Uw bevoegdheden</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{meta.label}</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2.5">
                    <ul className="flex flex-col gap-1.5">
                      {meta.authorities.map((a, i) => (
                        <li key={i} className="flex gap-2 text-xs text-foreground">
                          <span className="text-primary shrink-0 mt-0.5">✓</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Niet uw verantwoordelijkheid</p>
                      <p className="text-[11px] text-muted-foreground">{meta.notResponsibleFor}</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Session info */}
            <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{tr(lang, "eventLog")}</span>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {[...session.timeline].reverse().slice(0, 20).map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-[9px] text-muted-foreground shrink-0 mt-0.5">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">
                      {ev.type.replace(/_/g, " ")}
                      {(ev.data as { name?: string }).name ? ` — ${(ev.data as { name?: string }).name}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <UrgentInjectModal inject={urgent} onClose={() => setUrgent(null)} lang={lang} />
    </div>
  )
}
