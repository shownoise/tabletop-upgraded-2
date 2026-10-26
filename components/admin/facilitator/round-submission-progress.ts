// Hoeveel beslissingen zijn er deze ronde ingediend, en hoeveel worden er
// verwacht.
//
// Waarom dit apart staat: de metriek bovenaan de rondestap en het
// live-overzicht moeten dezelfde noemer tonen. Stond er "0 ingediend" zonder
// noemer, dan wist de facilitator niet of hij op één of op acht inzendingen
// wachtte (#105 §7). Eén afleiding, zodat die twee nooit uit elkaar lopen.

import { missingDecisionRoles, missingEventDecisionAssignments } from "@/lib/session-next-action"
import type { Role, SessionState } from "@/lib/types"

export interface RoundSubmissionProgress {
  submitted: number
  // null betekent: geen betrouwbare noemer. De UI toont dan alleen het aantal
  // in plaats van een verzonnen "van 1".
  expected: number | null
  // De rollen die nu nog een beslissing verschuldigd zijn. Rollen die niemand
  // dekt staan hier niet in: die kunnen niet indienen en houden niets tegen.
  missingRoles: Role[]
  // "0 van 4 ingediend", of zonder noemer "0 ingediend".
  label: string
}

export function roundSubmissionProgress(session: SessionState): RoundSubmissionProgress {
  const submitted = (session.submittedDecisions ?? [])
    .filter(d => d.roundIndex === session.currentRound).length

  // Tijdens de beslisfase houdt de store per deelnemer bij hoeveel rollen hij
  // nog moet afhandelen. Een deelnemer die klaar is verdwijnt uit die map, dus
  // we tellen het openstaande deel (total - completed) en niet het totaal —
  // anders kromp de noemer mee met de voortgang.
  const pending = session.activeDecision?.pendingByParticipant
  const stillOpen = pending
    ? Object.values(pending).reduce((n, p) => n + Math.max(0, (p.total ?? 0) - (p.completed ?? 0)), 0)
    : 0

  // Buiten de beslisfase komt het openstaande aantal van het beslispunt zelf,
  // per (groep, rol): in event-modus dient elk team apart in.
  const outstanding = stillOpen > 0 ? stillOpen : missingEventDecisionAssignments(session).length

  let expected: number | null = submitted + outstanding
  // Geen beslispunt open (klassiek scenario, of alles al binnen vóór de eerste
  // inzending): dan is het aantal deelnemers de eerlijkste noemer.
  if (expected === 0) expected = session.participants.length || null

  return {
    submitted,
    expected,
    missingRoles: missingDecisionRoles(session),
    label: expected != null ? `${submitted} van ${expected} ingediend` : `${submitted} ingediend`,
  }
}
