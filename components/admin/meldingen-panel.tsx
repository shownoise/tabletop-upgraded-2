"use client"

import { AlertTriangle } from "lucide-react"
import type { FiledMelding, MeldingMoment, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

const RECIPIENT_LABEL: Record<string, string> = {
  ir_retainer: "Eye Security",
  msp: "MSP",
  ncsc: "NCSC",
  ap: "AP",
  police: "Politie",
  insurer: "Verzekeraar",
  internal: "Intern",
}

// Facilitator-side view of participant-filed meldingen. Shows recipient, type,
// filing role, timestamp, and whether the follow-up inject was spawned.
export function MeldingenPanel({ session }: { session: SessionState }) {
  const meldingen = session.meldingen ?? []
  if (meldingen.length === 0) return null

  // Build a moment-by-id map so we can label each melding with the type it was.
  const momentById = new Map<string, MeldingMoment>()
  for (const n of session.graph?.nodes ?? []) {
    if (n.type !== "round") continue
    const rd = n.data as { meldingMoments?: MeldingMoment[] }
    for (const m of rd.meldingMoments ?? []) momentById.set(m.id, m)
  }

  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-3.5 text-amber-600" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Ingediende meldingen — {meldingen.length}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-amber-500/20">
        {[...meldingen].reverse().map(m => <MeldingRow key={m.id} m={m} moment={momentById.get(m.momentId)} />)}
      </ul>
    </section>
  )
}

function MeldingRow({ m, moment }: { m: FiledMelding; moment?: MeldingMoment }) {
  const typeLabel = moment?.types.find(t => t.id === m.typeId)?.label ?? m.typeId
  const recipient = moment ? RECIPIENT_LABEL[moment.recipient] ?? moment.recipient : "?"
  const when = new Date(m.filedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return (
    <li className="py-2 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{typeLabel}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{when} · R{m.roundIndex + 1}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Door: <span className="text-foreground">{m.participantName}</span> ({ROLE_META[m.role]?.label ?? m.role})</span>
        <span>·</span>
        <span>Naar: <span className="text-foreground">{recipient}</span></span>
        {m.spawnedInjectId && (
          <>
            <span>·</span>
            <span className="text-emerald-700 dark:text-emerald-400">Follow-up inject uitgestuurd</span>
          </>
        )}
      </div>
      {m.freeText && <p className="text-xs italic text-muted-foreground">"{m.freeText}"</p>}
    </li>
  )
}
