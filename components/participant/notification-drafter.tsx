"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, Clock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { NotificationDraft, NotificationType, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
  participantId: string
}

const H = 60 * 60 * 1000

function deadlineMinutes(type: NotificationType): number {
  switch (type) {
    case 'ncsc_24h': return 24 * 60
    case 'ncsc_72h': return 72 * 60
    case 'ap_72h': return 72 * 60
    case 'ncsc_final': return 30 * 24 * 60
  }
}

function label(type: NotificationType): string {
  switch (type) {
    case 'ncsc_24h': return "NCSC vroegtijdige waarschuwing (24u)"
    case 'ncsc_72h': return "NCSC melding met initiële beoordeling (72u)"
    case 'ncsc_final': return "NCSC eindverslag / voortgangsverslag"
    case 'ap_72h': return "AP-melding (AVG, 72u)"
  }
}

function useTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "gemist"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function deadlineColor(msLeft: number): string {
  if (msLeft <= 0) return "text-red-500"
  if (msLeft < 2 * H) return "text-red-400"
  if (msLeft < 6 * H) return "text-yellow-400"
  return "text-emerald-500"
}

export function NotificationDrafter({ session, participantId }: Props) {
  const meldplicht = session.graph?.meldplicht
  const enabled = meldplicht?.enabled ?? true
  const anchor = session.incidentDetectedAt ?? session.startedAt ?? Date.now()
  const now = useTicker()

  const activeTypes = useMemo<NotificationType[]>(() => {
    if (!enabled) return []
    const list: NotificationType[] = []
    if (!meldplicht || meldplicht.ncsc24hEnabled) list.push('ncsc_24h')
    if (!meldplicht || meldplicht.ncsc72hEnabled) list.push('ncsc_72h')
    if (meldplicht?.ncscFinalEnabled) list.push('ncsc_final')
    if (!meldplicht || meldplicht.apEnabled) list.push('ap_72h')
    return list
  }, [enabled, meldplicht])

  if (!enabled) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Bell className="size-3.5 text-tt-accent" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Meldplicht</span>
      </div>
      <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-xs">
        {activeTypes.map(t => {
          const msLeft = anchor + deadlineMinutes(t) * 60 * 1000 - now
          return (
            <div key={`cd-${t}`} className="flex items-center gap-1">
              <Clock className="size-3" />
              <span className="font-mono text-[10px] text-muted-foreground">{shortLabel(t)}</span>
              <span className={`font-mono text-[10px] ${deadlineColor(msLeft)}`}>{formatCountdown(msLeft)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-col divide-y divide-border">
        {activeTypes.map(t => (
          <NotificationForm
            key={t}
            type={t}
            participantId={participantId}
            existing={(session.notifications ?? []).find(n => n.type === t)}
          />
        ))}
      </div>
    </div>
  )
}

function shortLabel(t: NotificationType): string {
  switch (t) {
    case 'ncsc_24h': return "24u NCSC"
    case 'ncsc_72h': return "72u NCSC"
    case 'ap_72h': return "72u AP"
    case 'ncsc_final': return "Eind NCSC"
  }
}

function NotificationForm({
  type,
  participantId,
  existing,
}: {
  type: NotificationType
  participantId: string
  existing?: NotificationDraft
}) {
  const [draft, setDraft] = useState<NotificationDraft["content"]>(existing?.content ?? {})
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(!!existing?.submittedAt)
  const [draftId, setDraftId] = useState<string | undefined>(existing?.id)

  useEffect(() => {
    setDraft(existing?.content ?? {})
    setSubmitted(!!existing?.submittedAt)
    setDraftId(existing?.id)
  }, [existing?.id, existing?.submittedAt])

  async function save(submit = false) {
    setSaving(true)
    try {
      const res = await api.upsertNotification({ participantId, type, draftId, content: draft, submit })
      if (res.draftId) setDraftId(res.draftId)
      if (submit) setSubmitted(true)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (submitted) return
    const t = setTimeout(() => { void save(false) }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (submitted) {
    return (
      <div className="px-4 py-3 flex flex-col gap-1 bg-emerald-500/5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
          {label(type)} — verzonden
        </span>
        <p className="text-[11px] text-tt-dim">{summarize(draft)}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label(type)}</span>
      <div className="grid grid-cols-1 gap-2">
        <TextField label="Vermoeden van kwaadwillig handelen" value={draft.suspectMalicious ?? ""} onChange={v => setDraft({ ...draft, suspectMalicious: v })} />
        <TextField label="Grensoverschrijdende gevolgen" value={draft.crossBorderImpact ?? ""} onChange={v => setDraft({ ...draft, crossBorderImpact: v })} />
        <TextField label="Verantwoordelijke contactpersoon" value={draft.responsibleContact ?? ""} onChange={v => setDraft({ ...draft, responsibleContact: v })} />
        <TextField label="Initiële impact-beoordeling" value={draft.initialImpactAssessment ?? ""} onChange={v => setDraft({ ...draft, initialImpactAssessment: v })} multiline />
        <TextField label="IoC's" value={draft.iocs ?? ""} onChange={v => setDraft({ ...draft, iocs: v })} multiline />
        <TextField label="Mitigerende maatregelen" value={draft.mitigations ?? ""} onChange={v => setDraft({ ...draft, mitigations: v })} multiline />
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="font-mono text-[9px] text-tt-dim">{saving ? "Opslaan…" : "Concept wordt automatisch bewaard"}</span>
        <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving} className="h-7 gap-1">
          <Send className="size-3" />
          Verzenden
        </Button>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {multiline ? (
        <Textarea rows={2} value={value} onChange={e => onChange(e.target.value)} className="text-[11px]" />
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[11px]" />
      )}
    </label>
  )
}

function summarize(c: NotificationDraft["content"]): string {
  return [c.responsibleContact, c.initialImpactAssessment].filter(Boolean).join(" · ").slice(0, 200)
}
