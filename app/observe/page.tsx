"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { useSessionStream } from "@/lib/use-session-stream"
import { ROLE_META } from "@/lib/types"
import { InjectFeed } from "@/components/participant/inject-feed"
import { RoundTimerCompact } from "@/components/participant/round-timer"
import { stripMarkdown } from "@/lib/render-markdown"

// ─── Severity palette (mirrors play-view) ─────────────────────
const SEVERITY_COLORS = ["#4ade80", "#facc15", "#f97316", "#ef4444", "#dc2626"]
const SEVERITY_LABELS = ["LAAG", "MEDIUM", "HOOG", "KRITIEK", "KRITIEK"]

// ─── Scrolling ticker for injects ─────────────────────────────
function LiveTicker({ text }: { text: string }) {
  return (
    <div className="overflow-hidden border-t border-tt-border bg-black/40 py-2">
      <p className="animate-marquee whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-tt-accent">
        {text}
      </p>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────
export default function ObservePage() {
  const { state, connected } = useSessionStream()
  const session = state.session
  const [lastInjectTitle, setLastInjectTitle] = useState<string | null>(null)
  const prevInjectCount = useRef(0)

  // Track latest inject for ticker
  useEffect(() => {
    const count = session?.pushedInjects?.length ?? 0
    if (count > prevInjectCount.current && session?.pushedInjects) {
      const latest = [...session.pushedInjects].sort((a, b) => b.pushedAt - a.pushedAt)[0]
      if (latest) setLastInjectTitle(latest.inject.title)
    }
    prevInjectCount.current = count
  }, [session?.pushedInjects?.length])

  // ── No session yet ──
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-tt-bg text-center px-6">
        <div className="grid-bg pointer-events-none fixed inset-0 opacity-10" aria-hidden />
        <ShieldAlert className="size-10 text-tt-dim" />
        <p className="font-mono text-sm uppercase tracking-widest text-tt-dim">
          {connected ? "Wacht op sessie…" : "Verbinding maken…"}
        </p>
        <span className={`size-2 rounded-full ${connected ? "bg-tt-green animate-pulse" : "bg-tt-dim"}`} />
      </div>
    )
  }

  const roundIdx = session.currentRound
  const currentRound = roundIdx >= 0 ? session.scenario.rounds[roundIdx] : null
  const severityIdx = Math.min(Math.max(roundIdx, 0), SEVERITY_COLORS.length - 1)
  const severityColor = SEVERITY_COLORS[severityIdx]
  const severityLabel = SEVERITY_LABELS[severityIdx]
  const isActive = session.status === "active"
  const isEnded = session.status === "ended"

  return (
    <div className="min-h-screen bg-tt-bg text-tt-bright flex flex-col">
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-10" aria-hidden />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between border-b border-tt-border bg-black/60 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-5 text-tt-accent" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">CYBER_TABLETOP // OBSERVE</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection dot */}
          <span className={`size-1.5 rounded-full ${connected ? "bg-tt-green animate-pulse" : "bg-tt-red"}`} />

          {/* Round timer */}
          {isActive && currentRound && (
            <RoundTimerCompact
              roundStartedAt={session.roundStartedAt}
              timerMinutes={currentRound.timerMinutes ?? session.config.timerPerRound ?? 15}
              status={session.status}
              lang="nl"
            />
          )}

          {/* Round phase badge */}
          {isActive && session.roundPhase && (
            <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 ${
              session.roundPhase === "inject"     ? "border-blue-500/40 text-blue-400 bg-blue-500/10" :
              session.roundPhase === "discussion" ? "border-amber-500/40 text-amber-400 bg-amber-500/10" :
              session.roundPhase === "decision"   ? "border-red-500/40 text-red-400 bg-red-500/10" :
              "border-green-500/40 text-green-400 bg-green-500/10"
            }`}>
              {session.roundPhase === "inject"     ? "INJECT" :
               session.roundPhase === "discussion" ? "DISCUSSIE" :
               session.roundPhase === "decision"   ? "BESLISSING" : "REVIEW"}
            </span>
          )}

          {/* Join code */}
          {session.joinCode && (
            <div className="flex items-center gap-2 border border-tt-border bg-black/40 px-3 py-1">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Join:</span>
              <span className="font-mono text-sm font-bold tracking-widest text-tt-accent">{session.joinCode}</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 mx-auto w-full max-w-7xl px-6 py-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column: situation + injects ── */}
        <div className="flex flex-col gap-5 lg:col-span-2">

          {/* Operation title */}
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Operatie</span>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-tt-accent leading-tight md:text-3xl">
              {session.scenario.scenario_title?.toUpperCase()}
            </h1>
            <p className="font-mono text-xs text-tt-dim leading-relaxed max-w-2xl">
              {session.scenario.scenario_summary}
            </p>
          </div>

          {/* Current round situation */}
          {currentRound ? (
            <div
              className="border border-tt-border bg-tt-surface overflow-hidden"
              style={{ borderLeft: `3px solid ${severityColor}` }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 bg-black/25 border-b border-tt-border">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold tracking-widest" style={{ color: severityColor }}>
                    RONDE {roundIdx + 1}/{session.scenario.rounds.length}
                  </span>
                  <span className="font-mono text-[10px] text-tt-dim truncate">{currentRound.title}</span>
                </div>
                <span
                  className="font-mono text-[9px] border px-1.5 py-0.5"
                  style={{ color: severityColor, borderColor: `${severityColor}40` }}
                >
                  {severityLabel}
                </span>
              </div>
              <div className="px-4 py-4">
                <p className="font-mono text-sm leading-relaxed text-tt-bright whitespace-pre-wrap">
                  {stripMarkdown(currentRound.situation_update)}
                </p>
              </div>
            </div>
          ) : isEnded ? (
            <div className="rounded border border-tt-border bg-tt-surface px-6 py-8 text-center">
              <p className="font-mono text-sm uppercase tracking-widest text-tt-dim">Oefening afgerond</p>
            </div>
          ) : (
            <div className="rounded border border-tt-border bg-tt-surface px-6 py-8 text-center">
              <div className="flex justify-center gap-2 mb-3">
                {[0,1,2].map(i => (
                  <span key={i} className="size-2 rounded-full bg-tt-dim animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                ))}
              </div>
              <p className="font-mono text-xs uppercase tracking-wider text-tt-dim">Wacht op facilitator…</p>
            </div>
          )}

          {/* BOB/OODA phase panel — shown during discussion */}
          {session.roundPhase === "discussion" && session.currentDiscussionPrompt && (() => {
            const framework = session.config?.decisionFramework
            const phaseIndex = session.currentDiscussionPhaseIndex ?? 0
            const BOB_NAMES = ["Beeldvorming", "Oordeelvorming", "Besluitvorming"]
            const OODA_NAMES = ["Observe", "Orient", "Decide", "Act"]
            const phaseNames = framework === 'ooda' ? OODA_NAMES : BOB_NAMES
            const totalPhases = phaseNames.length
            const phaseName = phaseNames[phaseIndex] ?? phaseNames[0]
            return (
              <div
                className="border border-tt-border bg-tt-surface overflow-hidden"
                style={{ borderLeft: "3px solid var(--tt-accent)" }}
              >
                <div className="flex items-center justify-between px-4 py-2.5 bg-tt-bright/5 border-b border-tt-border">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-tt-accent">
                      {framework === 'ooda' ? "OODA" : "BOB"} — Fase {phaseIndex + 1}/{totalPhases}
                    </span>
                    <span className="font-mono text-[9px] text-tt-bright font-bold">{phaseName}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  <p className="font-mono text-xs text-tt-bright leading-relaxed">{session.currentDiscussionPrompt}</p>
                  <div className="flex gap-1.5">
                    {Array.from({ length: totalPhases }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1 flex-1"
                        style={{
                          backgroundColor: i <= phaseIndex ? "var(--tt-accent)" : "var(--tt-border)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Decision phase indicator */}
          {session.roundPhase === "decision" && (
            <div className="flex items-center gap-2 border border-tt-accent/30 bg-tt-accent/5 px-4 py-2.5">
              <span className="size-1.5 rounded-full bg-tt-accent animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-tt-accent">
                Beslismoment — deelnemers brengen hun keuze uit
              </span>
              <span className="ml-auto font-mono text-[10px] text-tt-dim">
                {(session.submittedDecisions ?? []).filter(d => d.roundIndex === roundIdx).length}
                /{session.participants.filter(p => p.role).length} ingediend
              </span>
            </div>
          )}

          {/* Inject feed — no role filter = all injects visible */}
          <InjectFeed
            pushed={session.pushedInjects}
            lang="nl"
            participantRole={undefined}
          />
        </div>

        {/* ── Right column: participants + phase ── */}
        <aside className="flex flex-col gap-4">

          {/* Participants */}
          <div className="rounded border border-tt-border bg-tt-surface overflow-hidden">
            <div className="border-b border-tt-border px-4 py-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-tt-dim">Deelnemers</span>
              <span className="font-mono text-[10px] text-tt-accent">{session.participants.length}</span>
            </div>
            <ul aria-label="Deelnemers" className="flex flex-col divide-y divide-tt-border max-h-72 overflow-y-auto">
              {session.participants.length === 0 ? (
                <li className="px-4 py-3 text-center font-mono text-[10px] text-tt-dim">Geen deelnemers</li>
              ) : session.participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="size-5 rounded-full border border-tt-border bg-black/40 font-mono text-[9px] uppercase text-tt-dim flex items-center justify-center shrink-0">
                      {p.name.slice(0, 2)}
                    </span>
                    <span className="font-mono text-xs text-tt-bright truncate max-w-[120px]">{p.name}</span>
                  </div>
                  {p.role && (
                    <span className="font-mono text-[8px] uppercase tracking-wider border border-tt-accent/30 bg-tt-accent/10 text-tt-accent px-1.5 py-px shrink-0">
                      {ROLE_META[p.role]?.label ?? p.role}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Phase flow indicator */}
          {isActive && (
            <div className="rounded border border-tt-border bg-tt-surface px-4 py-3 flex flex-col gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Ronde fase</span>
              <div className="flex items-center gap-1">
                {(["inject", "discussion", "decision", "review"] as const).map((phase, i) => {
                  const isCurrent = session.roundPhase === phase
                  const labels: Record<string, string> = {
                    inject: "INJECT", discussion: "DISCUSSIE", decision: "BESLISSING", review: "REVIEW",
                  }
                  const colors: Record<string, string> = {
                    inject: "var(--tt-blue)", discussion: "var(--tt-warn)",
                    decision: "var(--tt-red)", review: "var(--tt-green)",
                  }
                  return (
                    <div key={phase} className="flex items-center gap-1 flex-1">
                      {i > 0 && <span className="font-mono text-[9px] text-tt-border shrink-0">→</span>}
                      <span
                        className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 border shrink-0"
                        style={isCurrent ? {
                          color: colors[phase],
                          borderColor: `color-mix(in srgb, ${colors[phase]} 40%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${colors[phase]} 10%, transparent)`,
                        } : {
                          color: "var(--tt-dim)",
                          borderColor: "var(--tt-border)",
                        }}
                      >
                        {labels[phase]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Decisions submitted this round */}
          {isActive && roundIdx >= 0 && (
            <div className="rounded border border-tt-border bg-tt-surface overflow-hidden">
              <div className="border-b border-tt-border px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-tt-dim">Beslissingen ronde {roundIdx + 1}</span>
              </div>
              <ul className="flex flex-col divide-y divide-tt-border max-h-48 overflow-y-auto">
                {(session.submittedDecisions ?? [])
                  .filter(d => d.roundIndex === roundIdx)
                  .map((d, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2 gap-2">
                      <span className="font-mono text-[10px] text-tt-dim truncate">{d.participantName}</span>
                      <span className="font-mono text-[9px] text-tt-bright truncate max-w-[140px]">{d.actionLabel}</span>
                    </li>
                  ))}
                {(session.submittedDecisions ?? []).filter(d => d.roundIndex === roundIdx).length === 0 && (
                  <li className="px-4 py-3 text-center font-mono text-[10px] text-tt-dim">Nog geen beslissingen</li>
                )}
              </ul>
            </div>
          )}

          {/* Scenario meta */}
          <div className="rounded border border-tt-border bg-tt-surface px-4 py-3 flex flex-col gap-2">
            <span className="font-mono text-[9px] uppercase tracking-widest text-tt-dim">Scenario</span>
            {[
              { label: "Sector",    value: session.config.sector },
              { label: "Type",      value: session.config.scenarioType },
              { label: "Duur",      value: session.config.duration },
              { label: "Moeilijk.", value: session.config.difficulty },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] text-tt-dim shrink-0">{label}</span>
                <span className="font-mono text-[10px] text-tt-bright text-right truncate">{value}</span>
              </div>
            ) : null)}
          </div>
        </aside>
      </main>

      {/* ── Ticker bar ── */}
      {lastInjectTitle && <LiveTicker text={`NIEUW INJECT — ${lastInjectTitle}`} />}
    </div>
  )
}
