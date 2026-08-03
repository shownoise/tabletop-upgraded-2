"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, LayoutDashboard, Play, RotateCcw, Sparkles, ChevronRight, AlertCircle, Send, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSessionStream } from "@/lib/use-session-stream"
import { api } from "@/lib/api-client"
import { ROLE_META } from "@/lib/types"
import type { DecisionNodeData, ScenarioGraph, SpecialNodeData } from "@/lib/graph/types"
import type { Inject, Participant, Role, SessionState } from "@/lib/types"
import { analyzeGraph } from "@/lib/graph/analyze"
import { GraphPathPanel } from "./graph-path-panel"

export function StoryView() {
  const { state, connected } = useSessionStream()
  const session = state.session

  if (!connected && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground animate-pulse">
          Connecting...
        </span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No active session.</p>
          <Link href="/admin" className="mt-2 inline-block font-mono text-xs uppercase tracking-wider text-primary hover:underline">
            Create one
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header session={session} />
      <main className="mx-auto max-w-6xl px-6 py-6 md:px-10 md:py-8 flex flex-col gap-6">
        {session.status === "lobby" && <LobbyPanel session={session} />}
        {session.status === "active" && <ActivePanel session={session} />}
        {session.status === "ended" && <EndedPanel session={session} />}
      </main>
    </div>
  )
}

function Header({ session }: { session: SessionState }) {
  const graph = session.graph as ScenarioGraph | undefined
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <Link
          href="/admin"
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Setup
        </Link>
        <div className="flex flex-col items-center">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            {graph?.name ?? session.scenario.scenario_title ?? "Live session"}
          </span>
          <span className="font-mono text-lg font-bold tracking-widest text-primary">
            {session.joinCode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-1.5 rounded border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <LayoutDashboard className="size-3" />
            Classic view
          </Link>
        </div>
      </div>
    </header>
  )
}

// ─── LOBBY ────────────────────────────────────────────────────────────────

function LobbyPanel({ session }: { session: SessionState }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graph = session.graph as ScenarioGraph | undefined
  const analysis = useMemo(() => graph ? analyzeGraph(graph) : null, [graph])
  const claimedRoles = new Set(session.participants.map(p => p.role).filter(Boolean) as Role[])
  const missingRoles = analysis?.requiredRoles.filter(r => !claimedRoles.has(r)) ?? []

  async function handleStart() {
    setWorking(true)
    setError(null)
    try {
      await api.startSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Waiting room">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Share the join code <span className="font-mono font-bold text-foreground">{session.joinCode}</span> with participants at <span className="font-mono text-foreground">/join</span>.
          </p>
          {analysis && analysis.requiredRoles.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                Required roles for this scenario
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.requiredRoles.map(r => {
                  const isClaimed = claimedRoles.has(r)
                  return (
                    <span
                      key={r}
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                        isClaimed
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {ROLE_META[r].label}{isClaimed ? " ✓" : ""}
                    </span>
                  )
                })}
              </div>
              {missingRoles.length > 0 && (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {missingRoles.length} role(s) still open — you can start anyway, but branching may not work as designed.
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel title={`Participants (${session.participants.length})`}>
        {session.participants.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No participants yet.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {session.participants.map(p => (
            <ParticipantRow key={p.id} p={p} />
          ))}
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={handleStart} disabled={working || session.participants.length === 0} className="gap-2">
          <Play className="size-4" />
          Start session
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

// ─── ACTIVE ───────────────────────────────────────────────────────────────

function ActivePanel({ session }: { session: SessionState }) {
  const graph = session.graph as ScenarioGraph | undefined
  const currentNodeId = session.graphState?.currentNodeId
  const nodeById = useMemo(
    () => graph ? new Map(graph.nodes.map(n => [n.id, n])) : new Map(),
    [graph],
  )
  const currentNode = currentNodeId ? nodeById.get(currentNodeId) : undefined

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 flex flex-col gap-6">
        <NowPanel session={session} />
        {currentNode?.type === "decision" && (
          <AwaitingDecisionPanel session={session} node={currentNode} />
        )}
        {currentNode?.type === "special" && (
          <AwaitingSpecialPanel session={session} node={currentNode} />
        )}
        <ComingUpPanel session={session} graph={graph} currentNodeId={currentNodeId} />
      </div>
      <div className="flex flex-col gap-6">
        <ParticipantsPanel session={session} />
        <ScoreboardPanel session={session} />
        <ControlsPanel session={session} />
        {graph && <GraphPathPanel session={session} />}
      </div>
    </div>
  )
}

function ScoreboardPanel({ session }: { session: SessionState }) {
  const events = session.assessmentEvents ?? []
  if (events.length === 0) return null
  const byDim = new Map<string, { total: number; count: number; impacts: number }>()
  for (const ev of events) {
    const entry = byDim.get(ev.dimensionId) ?? { total: 0, count: 0, impacts: 0 }
    entry.total += ev.value
    entry.count += 1
    entry.impacts += ev.scoreImpact ?? 0
    byDim.set(ev.dimensionId, entry)
  }
  const rows = Array.from(byDim.entries()).map(([dim, { total, count, impacts }]) => ({
    dim,
    avg: Math.round(total / count),
    impacts,
    count,
  })).sort((a, b) => b.impacts - a.impacts)
  return (
    <Panel title="Live scoring">
      <div className="flex flex-col gap-1.5">
        {rows.map(r => {
          const color = r.avg >= 65 ? "text-emerald-600 dark:text-emerald-400"
            : r.avg >= 40 ? "text-yellow-600 dark:text-yellow-400"
            : "text-destructive"
          return (
            <div key={r.dim} className="flex items-center gap-2 text-xs">
              <span className="flex-1 font-mono text-[10px] uppercase text-muted-foreground truncate">
                {r.dim.replace(/_/g, " ")}
              </span>
              <span className={`font-mono ${color}`}>{r.avg}</span>
              <span className="font-mono text-[9px] text-muted-foreground">
                ({r.impacts > 0 ? "+" : ""}{r.impacts}) · n={r.count}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function NowPanel({ session }: { session: SessionState }) {
  const round = session.scenario.rounds[session.currentRound]
  if (!round) {
    return (
      <Panel title="Now">
        <p className="text-xs text-muted-foreground italic">Waiting for first round to reveal…</p>
      </Panel>
    )
  }
  const injectsForRound = session.pushedInjects.filter(p => p.roundIndex === session.currentRound)
  const pushedIds = new Set(session.pushedInjects.map(p => p.inject.id))
  const unpushedThisRound = (round.injects ?? []).filter(i => !pushedIds.has(i.id))
  // Find facilitatorPerspective from graph round node (not the compiled Round)
  const graph = session.graph
  const facilitatorPerspective = graph && session.graphState
    ? (() => {
        const currentNode = graph.nodes.find(n => n.id === session.graphState!.currentNodeId)
        if (currentNode?.type === "round") return (currentNode.data as { facilitatorPerspective?: string }).facilitatorPerspective
        // Try to find the round-node by matching title
        const roundNode = graph.nodes.find(n => n.type === "round" && (n.data as { title?: string }).title === round.title)
        return roundNode ? (roundNode.data as { facilitatorPerspective?: string }).facilitatorPerspective : undefined
      })()
    : undefined
  return (
    <Panel title={`Round ${session.currentRound + 1} · Now`} accent>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{round.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {round.situation_update}
          </p>
        </div>
        {facilitatorPerspective && (
          <details className="rounded border border-primary/30 bg-primary/5 px-3 py-2" open>
            <summary className="font-mono text-[10px] uppercase tracking-wider text-primary cursor-pointer">
              🎯 IR-perspectief (jouw briefing als facilitator)
            </summary>
            <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap">{facilitatorPerspective}</p>
          </details>
        )}
        {unpushedThisRound.length > 0 && (
          <PushInjectsList
            title={`Injects te pushen (${unpushedThisRound.length})`}
            roundIndex={session.currentRound}
            injects={unpushedThisRound}
          />
        )}
        <PeekAndPushOtherRounds session={session} />
        {injectsForRound.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Injects pushed ({injectsForRound.length})
            </span>
            <ul className="flex flex-col gap-2">
              {injectsForRound.map(p => (
                <li key={p.inject.id} className="rounded border border-border bg-background px-3 py-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] uppercase text-primary">
                        {p.inject.channel ?? p.inject.type}
                      </span>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">{p.inject.urgency}</span>
                      {p.inject.targetRoles?.length ? (
                        <span className="font-mono text-[9px] text-muted-foreground">
                          → {p.inject.targetRoles.join(", ")}
                        </span>
                      ) : p.inject.targetTeam && p.inject.targetTeam !== "all" ? (
                        <span className="font-mono text-[9px] text-muted-foreground">→ {p.inject.targetTeam}</span>
                      ) : null}
                    </div>
                    {p.inject.timestamp && (
                      <span className="font-mono text-[9px] text-muted-foreground">{p.inject.timestamp}</span>
                    )}
                  </div>
                  <div className="text-xs font-medium">{p.inject.title}</div>
                  <p className="text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap">{p.inject.content}</p>
                  {(p.inject.senderName || p.inject.source) && (
                    <span className="font-mono text-[9px] text-muted-foreground">
                      — {p.inject.senderName ?? p.inject.source}{p.inject.senderHandle ? ` (${p.inject.senderHandle})` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <RoundTimer roundStartedAt={session.roundStartedAt} timerMinutes={round.timerMinutes} />
      </div>
    </Panel>
  )
}

function PushInjectsList({
  title,
  roundIndex,
  injects,
}: {
  title: string
  roundIndex: number
  injects: Inject[]
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pushedLocal, setPushedLocal] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function push(injectId: string) {
    setBusyId(injectId)
    setError(null)
    try {
      await api.pushInject({ roundIndex, injectId })
      setPushedLocal(prev => new Set(prev).add(injectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
        {title}
      </span>
      <ul className="flex flex-col gap-2">
        {injects.map(inject => {
          const localPushed = pushedLocal.has(inject.id)
          return (
            <li
              key={inject.id}
              className="rounded border border-border bg-background px-3 py-2 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[9px] uppercase text-primary shrink-0">
                    {inject.channel ?? inject.type}
                  </span>
                  <span className="font-mono text-[9px] uppercase text-muted-foreground shrink-0">
                    {inject.urgency}
                  </span>
                  {inject.targetRoles?.length ? (
                    <span className="font-mono text-[9px] text-muted-foreground truncate">
                      → {inject.targetRoles.join(", ")}
                    </span>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={localPushed ? "outline" : "default"}
                  disabled={busyId !== null || localPushed}
                  onClick={() => push(inject.id)}
                  className="h-7 gap-1 font-mono text-[10px] uppercase tracking-wider"
                >
                  {localPushed ? (
                    <>
                      <Check className="size-3" /> Gepusht
                    </>
                  ) : busyId === inject.id ? (
                    "..."
                  ) : (
                    <>
                      <Send className="size-3" /> Push
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs font-medium">{inject.title}</div>
              <p className="text-[11px] text-muted-foreground leading-snug whitespace-pre-wrap line-clamp-3">
                {inject.content}
              </p>
            </li>
          )
        })}
      </ul>
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-2 py-1 text-[10px] text-destructive-foreground">
          {error}
        </div>
      )}
    </div>
  )
}

function PeekAndPushOtherRounds({ session }: { session: SessionState }) {
  const pushedIds = new Set(session.pushedInjects.map(p => p.inject.id))
  const otherRounds = session.scenario.rounds
    .map((r, i) => ({ round: r, index: i }))
    .filter(({ index, round }) => {
      if (index === session.currentRound) return false
      const remaining = (round.injects ?? []).filter(i => !pushedIds.has(i.id))
      return remaining.length > 0
    })

  const [openRound, setOpenRound] = useState<number | null>(null)
  if (otherRounds.length === 0) return null

  const opened = otherRounds.find(r => r.index === openRound)
  const openedUnpushed = opened
    ? (opened.round.injects ?? []).filter(i => !pushedIds.has(i.id))
    : []

  return (
    <details className="rounded border border-border bg-background/50">
      <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
        Andere rondes ({otherRounds.length}) — kijk vooruit of gooi injects buiten volgorde
      </summary>
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {otherRounds.map(({ round, index }) => (
            <button
              key={index}
              type="button"
              onClick={() => setOpenRound(openRound === index ? null : index)}
              className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                openRound === index
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40"
              }`}
            >
              R{index + 1} · {round.title.slice(0, 30)}
            </button>
          ))}
        </div>
        {opened && openedUnpushed.length > 0 && (
          <PushInjectsList
            title={`R${opened.index + 1} — ${openedUnpushed.length} niet-gepusht`}
            roundIndex={opened.index}
            injects={openedUnpushed}
          />
        )}
      </div>
    </details>
  )
}

function RoundTimer({ roundStartedAt, timerMinutes }: { roundStartedAt?: number; timerMinutes?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!roundStartedAt || !timerMinutes) return null
  const totalSec = timerMinutes * 60
  const elapsed = Math.floor((now - roundStartedAt) / 1000)
  const left = Math.max(0, totalSec - elapsed)
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, "0")
  const pct = Math.min(100, (elapsed / totalSec) * 100)
  const critical = left <= 60
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
        <span className="text-muted-foreground">Round timer</span>
        <span className={critical ? "text-destructive font-bold" : "text-primary"}>{mm}:{ss}</span>
      </div>
      <div className="h-1 w-full bg-border overflow-hidden rounded-full">
        <div
          className={`h-full transition-all duration-1000 ${critical ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AwaitingDecisionPanel({ session, node }: { session: SessionState; node: { data: unknown; id: string } }) {
  const dd = node.data as DecisionNodeData
  const isFacilitator = dd.measuredBy === "facilitator_trigger"
  const isSoft = dd.advancesGraph === false
  const [busy, setBusy] = useState(false)

  async function pick(optionId: string) {
    if (busy) return
    setBusy(true)
    try {
      await fetch("/api/session/graph-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, optionId }),
      })
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (busy) return
    if (!confirm("Beslissing overslaan? Team krijgt -6 op decision_speed en engine kiest de eerste optie als default.")) return
    setBusy(true)
    try {
      await fetch("/api/session/skip-decision", { method: "POST" })
    } finally {
      setBusy(false)
    }
  }

  const submittedThisRound = (session.submittedDecisions ?? []).filter(d => d.roundIndex === session.currentRound)

  return (
    <div className="rounded-xl border-2 border-yellow-500/40 bg-yellow-500/5 px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-yellow-600 dark:text-yellow-400" />
          <span className="font-mono text-xs uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
            {isSoft ? "Extra keuze (scoring only)" : `Awaiting ${isFacilitator ? "your" : "participant"} decision`}
          </span>
        </div>
        {!isSoft && (
          <Button size="sm" variant="outline" onClick={skip} disabled={busy} className="text-[10px] h-7">
            Sla over
          </Button>
        )}
      </div>
      <p className="text-sm font-medium">{dd.prompt}</p>
      {isFacilitator ? (
        <div className="flex flex-wrap gap-2">
          {dd.options.map(opt => (
            <Button
              key={opt.id}
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => pick(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Branches by matching action
          </span>
          {dd.options.map(opt => (
            <div key={opt.id} className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5 text-xs">
              <span>{opt.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                triggered by action id: {opt.roleActionId ?? "—"}
              </span>
            </div>
          ))}
          {submittedThisRound.length > 0 && (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {submittedThisRound.length} submission(s) this round
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function AwaitingSpecialPanel({ session, node }: { session: SessionState; node: { data: unknown; id: string } }) {
  const sd = node.data as SpecialNodeData
  const active = (session.specialEvents ?? []).find(s => s.status === "active" && s.type === sd.type)
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-wider text-primary">
          Special in progress: {sd.type}
        </span>
      </div>
      {active ? (
        <p className="text-sm">
          Assigned to <span className="font-medium">{active.assignedParticipantName ?? "(unassigned)"}</span> ({active.assignedRole ?? "any"}).
          {" "}Total score so far: <span className="font-mono">{active.totalScore ?? 0}</span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">Waiting for special to be triggered…</p>
      )}
    </div>
  )
}

function ComingUpPanel({
  session,
  graph,
  currentNodeId,
}: {
  session: SessionState
  graph: ScenarioGraph | undefined
  currentNodeId: string | undefined
}) {
  if (!graph || !currentNodeId) return null
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const outgoing = graph.edges.filter(e => e.source === currentNodeId && e.type !== "inject")
  const items = outgoing.slice(0, 4).map(edge => {
    const target = nodeById.get(edge.target)
    return { edge, target }
  })
  return (
    <Panel title={`Coming up (${outgoing.length} branch${outgoing.length === 1 ? "" : "es"})`}>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {session.status === "ended" ? "Scenario ended." : "Terminal node — session will end after this."}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {items.map(({ edge, target }) => (
          <div
            key={edge.id}
            className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs"
          >
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase text-primary">
              {target?.type ?? "?"}
            </span>
            <span className="flex-1">{describeNode(target)}</span>
            {edge.label && (
              <span className="font-mono text-[10px] text-muted-foreground">via {edge.label}</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ParticipantsPanel({ session }: { session: SessionState }) {
  const submissionByParticipant = new Map(
    (session.submittedDecisions ?? [])
      .filter(d => d.roundIndex === session.currentRound)
      .map(d => [d.participantId, d]),
  )
  return (
    <Panel title={`Participants (${session.participants.length})`}>
      {session.participants.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No one has joined.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {session.participants.map(p => {
            const submitted = submissionByParticipant.get(p.id)
            return (
              <div key={p.id} className="flex flex-col gap-1 rounded border border-border bg-background px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full ${submitted ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {p.role ? ROLE_META[p.role].label : "no role"}
                  </span>
                </div>
                {submitted && (
                  <div className="ml-3.5 border-l border-emerald-500/30 pl-2 flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                      → {submitted.actionLabel}
                    </span>
                    {submitted.reasoning && (
                      <p className="text-[11px] text-muted-foreground leading-snug italic">
                        "{submitted.reasoning}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

const QUICK_TRIGGERS: Array<{
  id: string; emoji: string; label: string; hint: string;
  title: string; content: string;
  type?: import("@/lib/types").InjectType; urgency?: import("@/lib/types").Urgency;
}> = [
  {
    id: "journalist", emoji: "📞", label: "Journalist belt", hint: "Media-druk",
    title: "NOS journalist belt", type: "media", urgency: "high",
    content: "Sanne Visser (NOS) belt: 'Wij hebben bronnen die zeggen dat er een groot cyberincident bij jullie speelt. Deadline 18:00. Wat is uw reactie?'",
  },
  {
    id: "board", emoji: "💼", label: "Board vraagt update", hint: "Governance-druk",
    title: "Board voorzitter belt CEO", type: "executive", urgency: "high",
    content: "Voorzitter RvC: 'Ik hoor via wandelgangen dat er iets speelt. Ik wil binnen 30 minuten een schriftelijke briefing. En elke 2u een update.'",
  },
  {
    id: "customer", emoji: "😡", label: "Klant belt", hint: "Klant-druk",
    title: "Grote klant boos aan de lijn", type: "executive", urgency: "high",
    content: "Sander (CISO grootste klant): 'Onze SOC ziet iets bij jullie. Als jullie niet binnen 1u met verklaring komen, overwegen wij het contract op te zeggen.'",
  },
  {
    id: "regulator", emoji: "⚖", label: "Toezichthouder", hint: "Compliance-druk",
    title: "Toezichthouder belt", type: "regulatory", urgency: "critical",
    content: "NIS2 team: 'Wij hebben signalen dat er een significant incident speelt. Uw vroegtijdige waarschuwing hebben wij nog niet ontvangen. Klok tikt.'",
  },
  {
    id: "twitter", emoji: "🐦", label: "Social storm", hint: "Reputatie",
    title: "Twitter/X: uw naam trendt", type: "social", urgency: "high",
    content: "3200 mentions/uur, meest negatief. Bekende beveiligingsonderzoeker vraagt: 'Waarom horen we hier niks van?'",
  },
  {
    id: "hr", emoji: "👥", label: "Medewerker paniek", hint: "Interne druk",
    title: "OR-voorzitter mailt", type: "internal", urgency: "medium",
    content: "Er zijn zorgen onder medewerkers. Sommigen hebben salarisgegevens in de systemen. Vraag om briefing binnen het uur.",
  },
  {
    id: "attacker", emoji: "💀", label: "Ransom escalatie", hint: "Attacker druk",
    title: "Nieuwe post op leak-blog", type: "media", urgency: "critical",
    content: "DarkBridge post: '500 records als proof of exfiltratie. Betaal binnen 12u of we publiceren de volledige dump + bellen jullie klanten.'",
  },
  {
    id: "supplier", emoji: "🔗", label: "Supplier issue", hint: "Supply chain",
    title: "Third-party leverancier belt", type: "technical", urgency: "medium",
    content: "Cloud-provider: 'Onze rate-limits worden geraakt door verdachte activiteit vanuit uw tenant. Wij overwegen isolatie.'",
  },
]

function ControlsPanel({ session }: { session: SessionState }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentPhase = session.roundPhase ?? "inject"

  async function run(fn: () => Promise<unknown>) {
    setWorking(true)
    setError(null)
    try { await fn() } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setWorking(false)
    }
  }

  const PHASES: Array<{ id: import("@/lib/types").RoundPhase; label: string; hint: string }> = [
    { id: "inject", label: "Briefing", hint: "Lees situation + injects" },
    { id: "discussion", label: "Discussie", hint: "Team overlegt" },
    { id: "decision", label: "Beslissen", hint: "Submit acties" },
    { id: "review", label: "Review", hint: "Bespreek keuzes" },
  ]

  return (
    <Panel title="Controls">
      <div className="flex flex-col gap-3">
        {session.status === "active" && session.currentRound >= 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Round phase</span>
            <div className="grid grid-cols-4 gap-1">
              {PHASES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => run(() => api.setPhase(p.id))}
                  disabled={working}
                  title={p.hint}
                  className={`rounded border px-1.5 py-1 font-mono text-[10px] uppercase transition-colors ${
                    currentPhase === p.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">
              {PHASES.find(p => p.id === currentPhase)?.hint}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Quick pressure</span>
          <div className="grid grid-cols-2 gap-1">
            {QUICK_TRIGGERS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => run(() => api.surpriseInject({
                  title: t.title, content: t.content, type: t.type, urgency: t.urgency,
                }))}
                disabled={working}
                className="rounded border border-border bg-background px-2 py-1.5 text-[10px] font-mono text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="font-medium">{t.emoji} {t.label}</div>
                <div className="text-[9px] text-muted-foreground truncate">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            onClick={() => run(() => api.nextRound())}
            disabled={working}
            className="justify-start gap-2"
          >
            <ChevronRight className="size-3.5" />
            Volgende ronde
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={working}
            onClick={() => {
              const title = prompt("Surprise inject title:")
              if (!title) return
              const content = prompt("Content:")
              if (!content) return
              void run(() => api.surpriseInject({ title, content }))
            }}
            className="justify-start gap-2"
          >
            <Sparkles className="size-3.5" />
            Custom inject
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={working}
            onClick={() => {
              if (!confirm("End this session and reset?")) return
              void run(() => api.resetSession())
            }}
            className="justify-start gap-2 text-destructive hover:text-destructive"
          >
            <RotateCcw className="size-3.5" />
            Reset session
          </Button>
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </Panel>
  )
}

// ─── ENDED ────────────────────────────────────────────────────────────────

function EndedPanel({ session }: { session: SessionState }) {
  const outcome = session.graphState?.finalOutcome
  return (
    <div className="flex flex-col gap-6">
      <Panel title="Session ended" accent>
        {outcome ? (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Outcome</span>
            <h2 className="text-xl font-semibold">{outcome.label}</h2>
            {typeof outcome.scoreImpact === "number" && (
              <p className="font-mono text-xs text-muted-foreground">
                Score impact: {outcome.scoreImpact > 0 ? "+" : ""}{outcome.scoreImpact}
              </p>
            )}
            <p className="mt-2 text-sm leading-relaxed">{outcome.narrative}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Session complete. View the report for a full debrief.</p>
        )}
      </Panel>
      <div className="flex gap-3">
        <Link href="/admin/report" className="rounded-lg border border-primary bg-primary text-primary-foreground px-4 py-2 font-mono text-xs uppercase tracking-wider hover:opacity-90">
          Open report
        </Link>
        <Link href="/admin" className="rounded-lg border border-border bg-card px-4 py-2 font-mono text-xs uppercase tracking-wider hover:border-primary/40">
          New session
        </Link>
      </div>
    </div>
  )
}

// ─── SHARED ────────────────────────────────────────────────────────────────

function Panel({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section
      className={`rounded-xl border px-5 py-4 flex flex-col gap-3 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{title}</span>
      </div>
      {children}
    </section>
  )
}

function ParticipantRow({ p }: { p: Participant }) {
  return (
    <div className="flex items-center gap-3 rounded border border-border bg-background px-2.5 py-1.5">
      <span className="size-1.5 rounded-full bg-primary/60" />
      <span className="flex-1 text-sm">{p.name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {p.role ? ROLE_META[p.role].label : "no role"}
      </span>
    </div>
  )
}

function describeNode(node: { type?: string; data?: unknown } | undefined): string {
  if (!node) return "unknown"
  const d = node.data as { title?: string; label?: string; type?: string; prompt?: string } | undefined
  if (node.type === "round") return d?.title ?? "(untitled round)"
  if (node.type === "decision") return d?.prompt?.slice(0, 60) ?? "(decision)"
  if (node.type === "special") return d?.type ?? "(special)"
  if (node.type === "outcome") return d?.label ?? "(outcome)"
  return node.type ?? "?"
}

