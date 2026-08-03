"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, ChevronRight, Play, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSessionStream } from "@/lib/use-session-stream"
import { api } from "@/lib/api-client"
import { getAllGoals, getGoal } from "@/lib/goals/registry"
import { buildExerciseConfig } from "@/lib/engine/exercise-config"
import { buildFacilitatorContext } from "@/lib/engine/facilitator-support"
import type { GoalId } from "@/lib/engine/types"

// ─── Minimal markdown renderer (## headers, - bullets, **bold**) ──

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return (
          <h3 key={i} className="font-mono text-xs font-bold text-foreground mt-4 first:mt-0 uppercase tracking-widest">
            {line.slice(3)}
          </h3>
        )
        if (line.startsWith("- ")) return (
          <div key={i} className="flex gap-2 font-mono text-xs text-muted-foreground">
            <span className="text-primary shrink-0 mt-0.5">›</span>
            <span>{parseInline(line.slice(2))}</span>
          </div>
        )
        if (line.trim()) return (
          <p key={i} className="font-mono text-xs text-muted-foreground leading-relaxed">
            {parseInline(line)}
          </p>
        )
        return <div key={i} className="h-1.5" />
      })}
    </div>
  )
}

// ─── Dimension label map ──────────────────────────────────────

const DIM_DESCRIPTIONS: Record<string, string> = {
  decision_speed:       "How quickly does the team reach a formal decision once the inject lands?",
  decision_quality:     "Are decisions well-reasoned, with trade-offs considered and alternatives rejected?",
  escalation_timing:    "Does escalation happen at the right moment — not too early, not too late?",
  mandate_clarity:      "Is the decision owner explicit and the scope of their authority clear?",
  framework_adherence:  "Does the team consistently apply the chosen decision framework (BOB/OODA)?",
  dilemma_participation:"Do all roles engage in dilemma votes rather than deferring to a single voice?",
  communication_clarity:"Are internal and external communications clear, timed, and role-appropriate?",
  compliance_awareness: "Does Legal/CISO identify regulatory obligations (GDPR/NIS2) without being prompted?",
}

// ─── Page ────────────────────────────────────────────────────

export default function PreparePage() {
  const router = useRouter()
  const { state } = useSessionStream()
  const session = state.session
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Consolidated: /admin/story is the sole live facilitator view (handles both
  // graph-driven and template scenarios).
  const targetView = "/admin/story"

  useEffect(() => {
    if (session?.status === "active" || session?.status === "ended") {
      router.replace(targetView)
    }
  }, [session?.status, router, targetView])

  async function startSession() {
    setStarting(true)
    setError(null)
    try {
      await api.startSession()
      router.push(targetView)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed")
      setStarting(false)
    }
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="size-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const goalId = session.config.goalId as GoalId | undefined
  const goal = goalId ? (() => { try { return getGoal(goalId) } catch { return null } })() : null
  const resolvedConfig = goal ? buildExerciseConfig(goalId!, session.config) : null

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Pre-session brief</span>
              <span className="font-mono text-sm text-foreground truncate max-w-[220px]">{session.scenario.scenario_title}</span>
            </div>
          </div>
          <Button
            onClick={startSession}
            disabled={starting}
            className="gap-2 font-mono uppercase tracking-wider"
          >
            <Play className="size-3.5" />
            {starting ? "Starting…" : "Start session"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 md:px-8 flex flex-col gap-8">

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {/* Goal summary */}
        {goal && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Exercise goal</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{goal.name}</h1>
            <p className="font-mono text-sm text-muted-foreground leading-relaxed">{goal.description}</p>
          </section>
        )}

        {/* What you are testing */}
        {goal && goal.assessmentDimensions.length > 0 && (
          <section className="flex flex-col gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">What you are measuring</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {goal.assessmentDimensions.map(dim => (
                <div key={dim} className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-primary">{dim.replace(/_/g, ' ')}</span>
                  <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                    {DIM_DESCRIPTIONS[dim] ?? dim.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Facilitator guide */}
        {goal?.facilitatorGuide && (
          <section className="flex flex-col gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Facilitator guide</span>
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <SimpleMarkdown text={goal.facilitatorGuide} />
            </div>
          </section>
        )}

        {/* Round-by-round preview */}
        {session.scenario.rounds.length > 0 && (
          <section className="flex flex-col gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Round preview</span>
            <div className="flex flex-col gap-3">
              {session.scenario.rounds.map((round, i) => {
                const ctx = resolvedConfig ? buildFacilitatorContext(resolvedConfig, i) : null
                const prompts = ctx?.observationPrompts.slice(0, 2) ?? []
                const redFlags = round.facilitatorNotes?.redFlags?.slice(0, 2) ?? []
                return (
                  <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
                      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest shrink-0">R{i + 1}</span>
                      <span className="font-mono text-sm text-foreground font-medium">{round.title}</span>
                      {round.timerMinutes && (
                        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{round.timerMinutes} min</span>
                      )}
                    </div>
                    <div className="px-5 py-3 flex flex-col gap-3">
                      {round.facilitatorNotes?.discussionGoal && (
                        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                          {round.facilitatorNotes.discussionGoal}
                        </p>
                      )}
                      {prompts.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[8px] uppercase tracking-widest text-primary">Watch for</span>
                          {prompts.map((p, pi) => (
                            <div key={pi} className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                              <span className="text-primary shrink-0">›</span>{p}
                            </div>
                          ))}
                        </div>
                      )}
                      {redFlags.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[8px] uppercase tracking-widest text-destructive">Red flags</span>
                          {redFlags.map((f, fi) => (
                            <div key={fi} className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                              <span className="text-destructive shrink-0">⚠</span>{f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Join code — share with participants */}
        <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/10 px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Join code</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
              {session.joinCode}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(session.joinCode)
                } catch { /* ignore */ }
              }}
            >
              Copy
            </Button>
            <a
              href={typeof window !== "undefined" ? `${window.location.origin}/join?code=${session.joinCode}` : `/join?code=${session.joinCode}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Open /join
            </a>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            Deel deze code met deelnemers. Zij gaan naar <span className="font-mono text-foreground">/join</span>, vullen de code in en kiezen hun rol.
          </p>
        </div>

        {/* Start CTA at bottom */}
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
          <p className="font-mono text-xs text-muted-foreground">
            Share the join code with your team, then start the session when everyone is in the lobby.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startSession} disabled={starting} className="gap-2 font-mono uppercase tracking-wider">
              <Play className="size-3.5" />
              {starting ? "Starting…" : "Start session"}
            </Button>
            <Link
              href="/admin/story"
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              Go to live view <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
}
