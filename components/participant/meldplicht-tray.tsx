"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { MeldplichtPrompt, NotificationDraft, SessionState } from "@/lib/types"
import { MeldplichtInlineForm, typeChip } from "./notification-drafter"

interface Props {
  session: SessionState
  participantId: string
}

export function MeldplichtTray({ session, participantId }: Props) {
  const prompts = (session.meldplichtPrompts ?? []).filter(p => p.status !== 'dismissed')
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set())

  useEffect(() => {
    const submitted = prompts.filter(p => p.status === 'submitted')
    if (submitted.length === 0) return
    const timers = submitted
      .filter(p => !fadingOut.has(p.id))
      .map(p => {
        const t = setTimeout(() => setFadingOut(prev => new Set(prev).add(p.id)), 10_000)
        return t
      })
    return () => timers.forEach(clearTimeout)
  }, [prompts, fadingOut])

  const visible = prompts.filter(p => !fadingOut.has(p.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-2" aria-label="Meldplicht-prompts">
      {visible.map(p => (
        <MeldplichtPromptCard
          key={p.id}
          prompt={p}
          session={session}
          participantId={participantId}
        />
      ))}
    </div>
  )
}

function MeldplichtPromptCard({
  prompt,
  session,
  participantId,
}: {
  prompt: MeldplichtPrompt
  session: SessionState
  participantId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const existingDraft = (session.notifications ?? []).find((n: NotificationDraft) => n.type === prompt.type && !n.submittedAt)

  async function dismiss() {
    setDismissing(true)
    await api.dismissMeldplichtPrompt({ promptId: prompt.id })
  }

  if (prompt.status === 'submitted') {
    return (
      <div className="animate-slide-in-up rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-600">
        Concept verzonden — {new Date(prompt.triggeredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    )
  }

  return (
    <div className="animate-slide-in-up rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {typeChip(prompt.type)}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">{prompt.triggerReason.summary}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={dismissing}
          aria-label="Sluiten"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {!expanded ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-[11px] text-foreground">Wil je een concept opstellen? Duurt 2 minuten.</p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => void dismiss()} disabled={dismissing}>
              Niet nu
            </Button>
            <Button size="sm" className="h-7 text-[11px]" onClick={() => setExpanded(true)}>
              Nu concept maken
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2">
          <MeldplichtInlineForm
            type={prompt.type}
            participantId={participantId}
            participants={session.participants}
            existing={existingDraft}
            incidentDetectedAt={session.incidentDetectedAt}
            onSubmitted={() => { /* prompt status flips server-side; card re-renders */ }}
          />
        </div>
      )}
    </div>
  )
}
