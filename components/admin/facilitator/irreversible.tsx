"use client"

// Eerlijke knoppen voor onomkeerbare acties.
//
// Waarom dit bestaat: op het facilitatorgereedschap staan vier acties die de
// sessie onherroepelijk verder zetten — een inject pushen, een ruis-inject
// vuren, een special starten en een gemandateerde keuze maken. Er is nergens in
// `lib/session-store.ts` een tegenhanger (geen unpush, geen cancel, geen
// rollback van de graph), dus een misklik is definitief. Zolang die weg terug
// niet bestaat is het minste wat de knop kan doen: vóór de klik zeggen dat er
// geen weg terug is.
//
// Twee bouwstenen, zodat alle vier de plekken hetzelfde gedrag houden:
//  - `useConfirmOnce` — eerste klik bewapent, tweede klik voert uit. Lichter dan
//    een modal, en daarom bruikbaar in dichte lijsten waar je tijdens een ronde
//    snel moet kunnen klikken.
//  - `IrreversibleNote` — één regel die benoemt wat er niet terug kan, voor de
//    acties waar een tweede klik de hoofdflow te veel zou vertragen.

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

/**
 * Twee-staps bevestiging zonder dialoog. `request(id, run)` bewapent de actie bij
 * de eerste aanroep en voert hem uit bij de tweede. De bewapening valt na
 * `resetMs` automatisch terug, zodat een halve klik niet blijft hangen tot de
 * facilitator er per ongeluk langs komt.
 */
export function useConfirmOnce(resetMs = 6000) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingId) return
    const timer = setTimeout(() => setPendingId(null), resetMs)
    return () => clearTimeout(timer)
  }, [pendingId, resetMs])

  return {
    isPending: (id: string) => pendingId === id,
    /** Retourneert true als de actie daadwerkelijk is uitgevoerd. */
    request: (id: string, run: () => void) => {
      if (pendingId === id) {
        setPendingId(null)
        run()
        return true
      }
      setPendingId(id)
      return false
    },
    clear: () => setPendingId(null),
  }
}

/** Eén regel die benoemt wat er na de klik niet meer terug kan. */
export function IrreversibleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
