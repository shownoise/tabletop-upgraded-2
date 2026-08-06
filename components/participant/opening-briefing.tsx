"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react"
import type { SessionState, Role } from "@/lib/types"
import type { RoleBriefing } from "@/lib/graph/types"
import { ROLE_META } from "@/lib/types"
import { effectiveRolesForParticipant } from "@/lib/engine/distribute-roles"

// Phase 3 — the once-per-session opening briefing.
// Reads session.graph?.roleBriefings — mounted on the play view.
// State (has-been-seen) lives in localStorage under a per-session/per-participant key.
export function OpeningBriefing({
  session,
  participantId,
}: {
  session: SessionState
  participantId?: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  const storageKey = participantId ? `tabletop:opening-briefing:${session.id}:${participantId}` : null

  // Effective roles for this participant, in the same order the queue would show them
  // (primary first, then inherited).
  const rolesInOrder: Role[] = useMemo(() => {
    if (!participantId) return []
    const entry = session.roleDistribution?.entries.find(e => e.participantId === participantId)
    if (!entry) {
      // Fallback to the participant's role if no distribution.
      const p = session.participants.find(p => p.id === participantId)
      return p?.role ? [p.role] : []
    }
    const overrides = session.roleAssignmentOverrides?.[participantId]
    return effectiveRolesForParticipant(entry, overrides)
  }, [session, participantId])

  const briefings = session.graph?.roleBriefings

  // On mount: if we've been dismissed already for this session/participant,
  // start collapsed. If not, keep expanded and mark it dismissed on close.
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return
    const seen = window.localStorage.getItem(storageKey)
    if (seen === "seen") {
      setExpanded(false)
      setDismissed(true)
    }
  }, [storageKey])

  function handleClose() {
    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.setItem(storageKey, "seen")
    }
    setDismissed(true)
    setExpanded(false)
  }

  // Never render before roles resolve or during lobby (nothing to brief on yet).
  if (rolesInOrder.length === 0) return null
  if (!briefings) return null

  // Assemble the ordered list of briefings actually to show for THIS participant.
  const items = rolesInOrder
    .map((role, idx) => {
      const brief = briefings[role]
      if (!brief || (!brief.text && !(brief.playbookGaps ?? []).length)) return null
      return { role, brief, isInherited: idx > 0 }
    })
    .filter((x): x is { role: Role; brief: RoleBriefing; isInherited: boolean } => x !== null)

  if (items.length === 0) return null

  return (
    <div className={`rounded-xl border-2 ${dismissed ? "border-border/40 bg-muted/10" : "border-primary/40 bg-primary/5"} px-4 py-3 flex flex-col gap-2`}>
      <button
        type="button"
        onClick={() => setExpanded(x => !x)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
            Openingsbriefing — {items.length} rol{items.length === 1 ? "" : "len"}
          </span>
        </span>
        {!dismissed && (
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">nieuw</span>
        )}
      </button>
      {expanded && (
        <div className="flex flex-col gap-3">
          {items.map(({ role, brief, isInherited }) => {
            const label = ROLE_META[role]?.label ?? role
            return (
              <section key={role} className="rounded-md border border-border bg-background/40 px-3 py-2">
                {isInherited && (
                  <div className="mb-1 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-3" />
                    <span className="font-mono text-[10px] uppercase tracking-wider">
                      Deze rol is niet bezet: {label} — je covert deze mandaat ook
                    </span>
                  </div>
                )}
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-mono text-xs font-semibold">{label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{role}</span>
                </div>
                {brief.text && (
                  <p className="text-xs leading-relaxed text-foreground/90">{brief.text}</p>
                )}
                {(brief.playbookGaps ?? []).length > 0 && (
                  <div className="mt-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Playbook-gaps
                    </span>
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {(brief.playbookGaps ?? []).map((gap: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px]">
                          <span className="text-amber-700 dark:text-amber-400 shrink-0">•</span>
                          <span className="leading-snug">{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )
          })}
          {!dismissed && (
            <button
              type="button"
              onClick={handleClose}
              className="self-end rounded border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              Gelezen — inklappen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
