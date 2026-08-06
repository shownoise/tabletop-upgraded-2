"use client"

import { useMemo, useState } from "react"
import type { SessionState } from "@/lib/types"
import { ROLE_META, ROLE_ORDER, type Role } from "@/lib/types"
import type { PremadeInject } from "@/lib/graph/types"
import { api } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

// Phase 5 — facilitator runtime "noise button" panel. Fires ad-hoc injects from
// the scenario's authored library during DISCUSSION. Context only — never scored.
export function PremadeInjectPanel({ session }: { session: SessionState }) {
  const library = session.graph?.injectLibrary ?? []
  const [selectedClass, setSelectedClass] = useState<'feit' | 'aanname' | 'fabel' | 'all'>('all')
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  const [firedAt, setFiredAt] = useState<Record<string, number>>({})

  const filtered = useMemo(() => {
    return library.filter(entry => {
      if (selectedClass !== 'all') {
        if ((entry.classification ?? '') !== selectedClass) return false
      }
      if (selectedRoles.length > 0) {
        const t = entry.targetRoles ?? []
        // Broadcast entry (empty targetRoles) matches when no role filter is set,
        // and when a role filter IS set we require an overlap.
        if (t.length === 0) return false
        const overlap = t.some(r => selectedRoles.includes(r))
        if (!overlap) return false
      }
      return true
    })
  }, [library, selectedClass, selectedRoles])

  function toggleRole(role: Role) {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  async function fire(entry: PremadeInject) {
    const now = Date.now()
    setFiredAt(prev => ({ ...prev, [entry.id]: now }))
    try {
      await api.surpriseInject({
        title: entry.title,
        content: entry.content,
        type: 'alert',
        urgency: entry.urgency,
        channel: entry.channel,
        senderName: entry.senderName,
        targetRoles: entry.targetRoles && entry.targetRoles.length > 0 ? entry.targetRoles : undefined,
        classification: entry.classification,
        libraryId: entry.id,
      })
    } catch {
      // On failure release the disabled state so the facilitator can retry.
      setFiredAt(prev => {
        const next = { ...prev }
        delete next[entry.id]
        return next
      })
    }
  }

  function isCoolingDown(id: string) {
    const t = firedAt[id]
    if (!t) return false
    return Date.now() - t < 3000
  }

  if (library.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Ruis-injects (bibliotheek)
          </span>
        </div>
        <p className="text-xs italic text-muted-foreground">
          Nog geen ruis-injects gedefinieerd. Voeg toe in de builder onder &quot;Ruis-bibliotheek&quot;.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
          Ruis-injects (bibliotheek)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {filtered.length}/{library.length}
        </span>
      </div>

      {/* Classification filter chips */}
      <div className="flex flex-wrap gap-1">
        {(['all', 'feit', 'aanname', 'fabel'] as const).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedClass(c)}
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              selectedClass === c
                ? "border-primary/60 bg-primary/20 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {c === 'all' ? 'alle' : c}
          </button>
        ))}
      </div>

      {/* Role filter chips */}
      <div className="flex flex-wrap gap-1">
        {ROLE_ORDER.map(role => {
          const selected = selectedRoles.includes(role)
          return (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                selected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              }`}
            >
              {ROLE_META[role].label}
            </button>
          )
        })}
        {selectedRoles.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedRoles([])}
            className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            reset
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <li className="text-xs italic text-muted-foreground">Geen ruis-injects matchen de filter.</li>
        )}
        {filtered.map(entry => {
          const cooling = isCoolingDown(entry.id)
          const targetLabel = entry.targetRoles && entry.targetRoles.length > 0
            ? entry.targetRoles.map(r => ROLE_META[r]?.label ?? r).join(', ')
            : null
          return (
            <li key={entry.id}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fire(entry)}
                disabled={cooling}
                className="w-full justify-start gap-2 text-left h-auto py-1.5"
                title={entry.facilitatorNote || entry.title}
              >
                {cooling ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate text-xs">
                  {entry.label || entry.title || '(geen label)'}
                </span>
                {entry.classification && (
                  <Badge
                    variant="outline"
                    className={`shrink-0 font-mono text-[9px] uppercase tracking-wider ${classPillColor(entry.classification)}`}
                  >
                    {entry.classification}
                  </Badge>
                )}
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {entry.channel}
                </span>
                {targetLabel && (
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                    → {targetLabel}
                  </span>
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function classPillColor(c: 'feit' | 'aanname' | 'fabel'): string {
  switch (c) {
    case 'feit':    return 'border-emerald-500/40 text-emerald-600'
    case 'aanname': return 'border-amber-500/40 text-amber-600'
    case 'fabel':   return 'border-destructive/40 text-destructive'
  }
}
