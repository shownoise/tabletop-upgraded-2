import { NextResponse } from "next/server"
import { z } from "zod"
import { safeJson } from "@/lib/api-validation"
import { getSession } from "@/lib/session-store"
import { currentDecisionNode } from "@/lib/session-next-action"
import { decisionMandate, rolesForParticipant, roleCoverageInUse } from "@/lib/session-roles"
import type { DecisionNodeData } from "@/lib/graph/types"
import type { Role, SessionState } from "@/lib/types"
import { ROLE_META } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_REASONING = 2000

const VALID_ROLES = ["it_manager", "ciso", "head_of_comms", "legal", "ceo", "cfo", "hr_lead", "ops_manager"] as const

const SubmitDecisionBody = z.object({
  participantId: z.string().min(1).max(64),
  participantName: z.string().max(100).optional(),
  roundIndex: z.number().int().min(0).max(50),
  actionId: z.string().min(1).max(200),
  reasoning: z.string().max(MAX_REASONING).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
  // Event-mode team-device: explicit role the team is submitting AS.
  activeRole: z.enum(VALID_ROLES).optional(),
})

function label(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

// Mandaatcontrole op de server (#105 §4). Tot nu toe bepaalde alleen de client
// welke opties zichtbaar waren: wie `activeRole` zelf meestuurde kon een keuze
// indienen van een rol die hij niet speelde, en de inzending kwam als echte
// beslissing in de review terecht.
//
// `decisionMandate()` is de enige bron: die weet dat een overgenomen rol (een
// stoel die niemand claimde en die aan deze deelnemer is toegewezen) net zo
// geldig is als de eigen rol — dat is de hele reden dat er een rolverdeling is.
// Geeft `null` als de inzending mag, anders de Nederlandse weigeringstekst.
function mandateRefusal(
  session: SessionState,
  body: { participantId: string; actionId: string; activeRole?: Role },
): string | null {
  const node = currentDecisionNode(session)
  if (node?.type !== 'decision') return null
  const decision = node.data as DecisionNodeData
  const option = decision.options.find(o => o.id === body.actionId)
  // Hoort bij een ander beslispunt of is een legacy roleAction op de ronde:
  // daar beslist submitDecision() over, niet het mandaat.
  if (!option) return null
  // Een impliciete optie is de "geen besluit"-uitkomst die finalizeDecision
  // zelf wegschrijft. Dit staat vóór de rolcheck: zulke opties hebben vaak geen
  // `allowedRole`, en zonder deze regel zouden ze dus als "van iedereen" gelden.
  if (option.implicit) {
    return 'Deze keuze wordt door de facilitator afgerond en kan niet door een deelnemer worden ingediend.'
  }
  // Een optie zonder eigenaar is van iedereen aan tafel.
  if (!option.allowedRole) return null

  // Event-modus met een teamdevice: niemand claimt een rol en dat ene tablet
  // dient namens álle rollen in. Dekking is daar een eigenschap van het team,
  // niet van een persoon — mandaat per deelnemer zou daar iedereen weigeren.
  // Zodra er wél iemand een rol claimt geldt het echte mandaat weer.
  if (session.mode === 'event' && !roleCoverageInUse(session)) return null

  const mandate = decisionMandate(session, decision, body.participantId)
  const mine = mandate.options.find(o => o.optionId === body.actionId)
  if (mine?.canSubmit) {
    // De deelnemer mág de optie, maar stuurde een andere rol mee. Dat zou de
    // beslissing onder de verkeerde rol in de review laten landen.
    if (body.activeRole && body.activeRole !== option.allowedRole) {
      return `Deze keuze hoort bij ${label(option.allowedRole)}, niet bij ${label(body.activeRole)}. Wissel eerst van rol.`
    }
    return null
  }

  if (option.requiresCapability && !session.flags?.[option.requiresCapability]) {
    return 'Deze keuze is in deze sessie nog niet beschikbaar.'
  }

  const own = rolesForParticipant(session, body.participantId)
  if (!own?.all.length) {
    return `Deze keuze hoort bij ${label(option.allowedRole)}. Je hebt nog geen rol — kies eerst een rol voordat je indient.`
  }
  return `Deze keuze hoort bij ${label(option.allowedRole)}. Jij speelt ${own.all.map(label).join(' en ')}, dus deze keuze is niet aan jou.`
}

export async function POST(req: Request) {
  const parsed = await safeJson(req, SubmitDecisionBody)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: "Er is geen actieve sessie." }, { status: 404 })
  if (!session.participants.some(p => p.id === body.participantId)) {
    return NextResponse.json(
      { ok: false, error: "Je zit niet (meer) in de actieve sessie. Sluit opnieuw aan met de sessiecode." },
      { status: 401 },
    )
  }

  const refusal = mandateRefusal(session, {
    participantId: body.participantId,
    actionId: body.actionId,
    activeRole: body.activeRole as Role | undefined,
  })
  if (refusal) return NextResponse.json({ ok: false, error: refusal }, { status: 403 })

  const { submitDecision } = await import("@/lib/session-store")
  const result = await submitDecision({
    participantId: body.participantId,
    participantName: (body.participantName ?? "").trim(),
    roundIndex: body.roundIndex,
    actionId: body.actionId,
    reasoning: body.reasoning ?? "",
    confidence: body.confidence as 1 | 2 | 3 | 4 | 5 | undefined,
    activeRole: body.activeRole as Role | undefined,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
