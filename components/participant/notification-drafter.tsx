"use client"

import { useEffect, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { NotificationDraft, NotificationType, Participant } from "@/lib/types"

export function typeChip(type: NotificationType): string {
  switch (type) {
    case 'ncsc_24h': return "24u Cbw"
    case 'ncsc_72h': return "72u Cbw"
    case 'ap_72h': return "AVG 72u"
    case 'ncsc_final': return "Eindverslag"
  }
}

export function typeDeadlineMs(type: NotificationType): number {
  const H = 60 * 60 * 1000
  switch (type) {
    case 'ncsc_24h': return 24 * H
    case 'ncsc_72h': return 72 * H
    case 'ap_72h':   return 72 * H
    case 'ncsc_final': return 30 * 24 * H
  }
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "verstreken"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

interface FormProps {
  type: NotificationType
  participantId: string
  participants: Participant[]
  existing?: NotificationDraft
  incidentDetectedAt?: number
  onSubmitted?: () => void
}

// WHY: three-field simplified inline form used by the MeldplichtTray. The
// legacy six-field drafter component is retired; this replaces its inner form.
export function MeldplichtInlineForm({ type, participantId, participants, existing, incidentDetectedAt, onSubmitted }: FormProps) {
  const [whatWeKnow, setWhatWeKnow] = useState(existing?.content.initialImpactAssessment ?? "")
  const [responsible, setResponsible] = useState(existing?.content.responsibleContact ?? "")
  const [doingNow, setDoingNow] = useState(existing?.content.mitigations ?? "")
  const [suspectMalicious, setSuspectMalicious] = useState(!!existing?.content.suspectMalicious)
  const [crossBorder, setCrossBorder] = useState(!!existing?.content.crossBorderImpact)
  const [more, setMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftId, setDraftId] = useState<string | undefined>(existing?.id)
  const [submitted, setSubmitted] = useState(!!existing?.submittedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (submitted) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [submitted])

  async function save(submit: boolean) {
    setSaving(true)
    try {
      const content: NotificationDraft["content"] = {
        initialImpactAssessment: whatWeKnow,
        responsibleContact: responsible,
        mitigations: doingNow,
        suspectMalicious: suspectMalicious ? "Ja" : undefined,
        crossBorderImpact: crossBorder ? "Ja" : undefined,
      }
      const res = await api.upsertNotification({ participantId, type, draftId, content, submit })
      if (res.draftId) setDraftId(res.draftId)
      if (submit) {
        setSubmitted(true)
        onSubmitted?.()
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (submitted) return
    // WHY: 500ms debounce so typing doesn't hammer the API on every keystroke.
    const t = setTimeout(() => { void save(false) }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatWeKnow, responsible, doingNow, suspectMalicious, crossBorder])

  const canSubmit = whatWeKnow.trim().length >= 20 && responsible.trim().length >= 2 && doingNow.trim().length >= 20 && !saving

  if (submitted) {
    return (
      <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-600">
        Concept verzonden om {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    )
  }

  const deadlineMs = (incidentDetectedAt ?? Date.now()) + typeDeadlineMs(type) - now

  return (
    <div className="flex flex-col gap-2 text-xs">
      {incidentDetectedAt && (
        <div className="text-[10px] text-muted-foreground">
          Wettelijk uiterlijk: over {formatCountdown(deadlineMs)}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-foreground">Wat weten we?</span>
        <Textarea
          rows={2}
          value={whatWeKnow}
          maxLength={200}
          onChange={e => setWhatWeKnow(e.target.value)}
          placeholder="Bijv. Ransomware-encryptie op prod-VMware cluster; 3 servers onbereikbaar."
          className="text-[11px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-foreground">Wie is verantwoordelijk voor deze melding?</span>
        <select
          value={responsible}
          onChange={e => setResponsible(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-[11px]"
        >
          <option value="">Kies deelnemer…</option>
          {participants.map(p => (
            <option key={p.id} value={p.name}>{p.name}{p.role ? ` (${p.role})` : ""}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-foreground">Wat doen we er nu aan?</span>
        <Textarea
          rows={2}
          value={doingNow}
          onChange={e => setDoingNow(e.target.value)}
          placeholder="Bijv. Isoleren netwerksegment, IR-retainer geactiveerd om 09:15."
          className="text-[11px]"
        />
      </label>
      <button
        type="button"
        onClick={() => setMore(v => !v)}
        className="self-start text-[10px] text-muted-foreground hover:text-foreground"
      >
        {more ? "− Meer details verbergen" : "+ Meer details"}
      </button>
      {more && (
        <div className="flex flex-col gap-1 pl-2 border-l border-border">
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={suspectMalicious} onChange={e => setSuspectMalicious(e.target.checked)} className="size-3" />
            Vermoeden van kwaadwillig handelen
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={crossBorder} onChange={e => setCrossBorder(e.target.checked)} className="size-3" />
            Grensoverschrijdende gevolgen
          </label>
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">{saving ? "Opslaan…" : "Concept wordt automatisch bewaard"}</span>
        <Button type="button" size="sm" onClick={() => void save(true)} disabled={!canSubmit} className="h-7 gap-1">
          <Send className="size-3" />
          Versturen
        </Button>
      </div>
    </div>
  )
}

// Backwards-compat named export. The legacy full drafter panel is retired —
// callers should switch to <MeldplichtTray />. This shim renders nothing so
// any lingering import doesn't crash.
export function NotificationDrafter(_: { session: unknown; participantId: string }) {
  return null
}

// Small helpers kept for other consumers (control-dashboard, etc.).
export function summarizeDraft(c: NotificationDraft["content"]): string {
  return [c.responsibleContact, c.initialImpactAssessment].filter(Boolean).join(" · ").slice(0, 200)
}

export { Input, Textarea }
