"use client"

import { useState } from "react"
import { Landmark, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { RegulatoryMilestone, RegulatoryObligationState, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
  participantId: string
}

// Participant-facing button — visible only when at least one obligation is
// 'open' for the current session's regime. Any staffed role can file. After
// filing, the button disappears for everyone (per-milestone).
export function RegulatoryNotificationButton({ session, participantId }: Props) {
  const [open, setOpen] = useState(false)
  const [freeText, setFreeText] = useState("")
  const [keyPoints, setKeyPoints] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{
    milestoneLabel: string
    filedInRound: number
    timing: 'on_time' | 'late'
  } | null>(null)

  const regime = session.regulatoryRegime
  if (!regime) return null

  const obligations = session.regulatoryObligations ?? []
  const openObligation = obligations.find(o => o.status === 'open')
  if (!openObligation && !confirmation) return null

  const activeMilestone: RegulatoryMilestone | undefined = openObligation
    ? regime.milestones.find(m => m.id === openObligation.milestoneId)
    : undefined

  async function submit() {
    if (!openObligation || !activeMilestone) return
    if (freeText.trim().length === 0 || keyPoints.trim().length === 0) {
      setError("Vul beide velden in.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.fileRegulatoryObligation({
        participantId,
        milestoneId: openObligation.milestoneId,
        freeText: freeText.trim(),
        keyPoints: keyPoints.trim(),
      })
      const filedHour = res.obligation.filedAtHour ?? 0
      const deadlineHour = openObligation.openedAtHour + activeMilestone.deadlineHours
      setConfirmation({
        milestoneLabel: activeMilestone.label,
        filedInRound: res.obligation.filedAtRound ?? (session.currentRound + 1),
        timing: filedHour <= deadlineHour ? 'on_time' : 'late',
      })
      setOpen(false)
      setFreeText("")
      setKeyPoints("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon melding niet indienen.")
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <ConfirmationCard confirmation={confirmation} onDismiss={() => setConfirmation(null)} />
    )
  }

  if (!openObligation || !activeMilestone) return null

  const buttonLabel = `${activeMilestone.label} — meld bij ${regime.authorityLabel}`

  return (
    <>
      <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Landmark className="size-4 text-amber-700 dark:text-amber-400 mt-0.5" />
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-sm font-medium text-foreground">{activeMilestone.label}</span>
            <p className="text-[11px] text-muted-foreground leading-snug">{activeMilestone.purpose}</p>
            <p className="text-[10px] text-muted-foreground">
              Deadline: binnen {activeMilestone.deadlineHours} uur na bekendwording.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          className="self-start gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Send className="size-3.5" />
          {buttonLabel}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeMilestone.label}</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Naar: <span className="font-medium text-foreground">{regime.authorityLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground italic">{regime.obligation}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-what">Wat is er gebeurd?</Label>
            <Textarea
              id="reg-what"
              rows={4}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Kern van het incident, omvang, aard van de data of dienstverstoring."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-doing">Wat wordt er nu gedaan om het te beperken?</Label>
            <Textarea
              id="reg-doing"
              rows={4}
              value={keyPoints}
              onChange={e => setKeyPoints(e.target.value)}
              placeholder="Containment-stappen, betrokken partijen, communicatie."
            />
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            In de praktijk formaliseert een jurist of advocaat deze melding — hier oefen je waar het inhoudelijk landt.
          </p>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Annuleren</Button>
            <Button type="button" onClick={submit} disabled={submitting} className="gap-2">
              <Send className="size-3.5" /> {submitting ? "Verzenden…" : "Melding indienen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConfirmationCard({
  confirmation,
  onDismiss,
}: {
  confirmation: { milestoneLabel: string; filedInRound: number; timing: 'on_time' | 'late' }
  onDismiss: () => void
}) {
  const onTime = confirmation.timing === 'on_time'
  return (
    <div className={`rounded-xl border p-3 flex items-start justify-between gap-2 ${
      onTime
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    }`}>
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{confirmation.milestoneLabel} — verzonden in ronde {confirmation.filedInRound}.</span>
        <span className="text-[11px]">
          {onTime
            ? "Op tijd binnen de wettelijke termijn."
            : "Ingediend na de wettelijke termijn — dit blijft zichtbaar in de nabespreking."}
        </span>
      </div>
      <button type="button" onClick={onDismiss} className="text-[10px] uppercase tracking-wider hover:underline">
        Sluiten
      </button>
    </div>
  )
}

// Small helper used by ReviewCommentary to render an advice sentence in
// the "Uitkomst deze ronde" section.
export function regulatoryAdviceSentence(
  obligations: RegulatoryObligationState[],
  regimeId: string,
): string | null {
  const filed = obligations.filter(o => o.regimeId === regimeId && o.status === 'filed')
  if (filed.length > 0) {
    const last = filed[filed.length - 1]
    return `Meldplicht: ${last.milestoneId === 'initial' ? 'initiële melding' : 'eindrapportage'} ingediend in ronde ${last.filedAtRound}.`
  }
  const expired = obligations.filter(o => o.regimeId === regimeId && o.status === 'expired')
  if (expired.length > 0) {
    return `Meldplicht: nooit ingediend — dit is een expliciete bevinding in de nabespreking.`
  }
  return null
}
