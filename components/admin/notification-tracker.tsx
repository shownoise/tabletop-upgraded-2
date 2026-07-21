"use client"

import { useState } from "react"
import { Bell, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { NotificationType, SessionState } from "@/lib/types"
import { typeChip } from "@/components/participant/notification-drafter"

interface Props {
  session: SessionState
}

const LABELS: Record<NotificationType, string> = {
  ncsc_24h: "24u NCSC vroegtijdige waarschuwing",
  ncsc_72h: "72u NCSC melding",
  ncsc_final: "Eindverslag NCSC",
  ap_72h: "AP-melding (AVG)",
}

// WHY: replaces the persistent panel — a compact counter with popover and a
// facilitator escape hatch to spawn a prompt manually.
export function NotificationTracker({ session }: Props) {
  const meldplicht = session.graph?.meldplicht
  const [open, setOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)

  if (meldplicht && !meldplicht.enabled) return null

  const prompts = session.meldplichtPrompts ?? []
  const drafts = session.notifications ?? []
  const openPrompts = prompts.filter(p => p.status === 'open' || p.status === 'drafted').length
  const submitted = drafts.filter(d => !!d.submittedAt).length

  async function trigger(type: NotificationType) {
    setTriggering(true)
    try {
      await api.triggerMeldplichtManual({ type, summary: "Facilitator: extra meldplicht-moment" })
    } finally {
      setTriggering(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] hover:bg-accent/40"
      >
        <Bell className="size-3 text-primary" />
        <span>Meldplicht:</span>
        <span className="font-medium">{openPrompts} open</span>
        <span className="text-muted-foreground">· {submitted} verzonden</span>
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-8 w-72 rounded-xl border border-border bg-popover p-3 shadow-lg text-xs">
          <div className="mb-2 font-medium">Actieve meldplicht-prompts</div>
          {prompts.length === 0 && <div className="text-muted-foreground">Nog geen prompts gespawned.</div>}
          <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {prompts.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                <span className="truncate">
                  <span className="mr-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{typeChip(p.type)}</span>
                  {p.triggerReason.summary}
                </span>
                <span className="text-[9px] text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Trigger meldplicht-moment</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(LABELS) as NotificationType[]).map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => void trigger(t)}
                  disabled={triggering}
                >
                  {typeChip(t)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
