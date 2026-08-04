"use client"

import { useState } from "react"
import { AlertTriangle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api-client"
import type { MeldingMoment, Role, SessionState } from "@/lib/types"

interface Props {
  session: SessionState
  participantId: string
  participantRole: Role
}

const RECIPIENT_LABEL: Record<string, string> = {
  ir_retainer: "Eye Security (IR-retainer)",
  msp: "IT-partner / MSP",
  ncsc: "NCSC",
  ap: "Autoriteit Persoonsgegevens",
  police: "Politie",
  insurer: "Cyberverzekeraar",
  internal: "Intern (bestuur / management)",
}

// Participant-initiated melding — visible only when a melding-moment is open
// in the current round AND the participant's role is on the allowedRoles list.
// Filing a melding may spawn a follow-up inject (see fileMelding in session-store).
export function MeldingButton({ session, participantId, participantRole }: Props) {
  const [open, setOpen] = useState(false)
  const [typeId, setTypeId] = useState<string | null>(null)
  const [freeText, setFreeText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find open moments the participant may file on.
  const openMoments = findOpenMoments(session, participantRole)
  if (openMoments.length === 0) return null

  // Track already-filed to avoid double-file confusion.
  const filedIds = new Set(
    (session.meldingen ?? [])
      .filter(m => m.participantId === participantId)
      .map(m => m.momentId),
  )

  // If all open moments were already filed by this participant, show nothing.
  const filable = openMoments.filter(m => !filedIds.has(m.id))
  if (filable.length === 0) return null

  const activeMoment = filable[0]

  async function submit() {
    if (!typeId) { setError("Kies een type melding."); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.fileMelding({
        participantId,
        momentId: activeMoment.id,
        typeId,
        freeText: freeText.trim() || undefined,
      })
      setOpen(false)
      setTypeId(null)
      setFreeText("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon melding niet indienen.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
      >
        <AlertTriangle className="size-3.5" />
        Melding doen — {RECIPIENT_LABEL[activeMoment.recipient] ?? activeMoment.recipient}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Melding doen</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Naar: <span className="font-medium text-foreground">{RECIPIENT_LABEL[activeMoment.recipient] ?? activeMoment.recipient}</span>
          </p>
          {activeMoment.helper && (
            <p className="text-xs text-muted-foreground italic">{activeMoment.helper}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Type melding</Label>
            <div className="flex flex-col gap-1.5">
              {activeMoment.types.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeId(t.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    typeId === t.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mld-free">Toelichting (optioneel)</Label>
            <Textarea
              id="mld-free"
              rows={3}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Wat wil je meegeven?"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>Annuleren</Button>
            <Button type="button" onClick={submit} disabled={submitting || !typeId} className="gap-2">
              <Send className="size-3.5" /> {submitting ? "Verzenden…" : "Melding indienen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function findOpenMoments(session: SessionState, role: Role): MeldingMoment[] {
  const round = session.scenario.rounds[session.currentRound]
  if (!round) return []
  const graphRound = session.graph?.nodes.find(
    n => n.type === "round" && (n.data as { title: string }).title === round.title,
  )
  const rd = graphRound?.data as { meldingMoments?: MeldingMoment[] } | undefined
  const moments = rd?.meldingMoments ?? []
  return moments.filter(m => m.allowedRoles.length === 0 || m.allowedRoles.includes(role))
}
