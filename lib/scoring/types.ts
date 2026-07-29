import type { Domain, OutcomeDimension, ProcessDimension } from './constants'

// Re-export dimensiona types voor consumers die vanuit types.ts importeren.
export type { Domain, OutcomeDimension, ProcessDimension } from './constants'

// De scoring-package is puur. Alle types hier zijn zelf-standig en niet
// afhankelijk van `lib/graph/types.ts` of `lib/types.ts` — het is de
// bedoeling dat de app-code een adapter schrijft die de app-state naar dit
// input-shape mapt, en niet dat scoring de app-shape kent.

export type RoleId = string
export type Mode = 'ASSESSMENT' | 'EVENT'

// ── Input: scenario-configuratie (immutable per oefening) ──────────────

export interface OptionSpec {
  id: string
  label?: string
  // Deel A §5 — vector over de zes uitkomstdimensies, alle zes verplicht.
  outcomeVector: Record<OutcomeDimension, number>
  requiresCosign?: RoleId[]
  // Deel B §7.1 — impliciete "geen besluit"-optie krijgt implicit=true.
  implicit?: boolean
  debriefNote?: string
}

export interface DecisionPointSpec {
  id: string
  round: number
  domain: Domain
  // Ontwerp-eigenaar. Runtime resolutie kan effectiveOwner opleveren, zie role-resolution.ts
  designedOwner: RoleId
  consulted?: RoleId[]
  // Deel B §1.6 — false = mag vervallen bij te weinig rolscheiding.
  required?: boolean
  // Deel A §7.1 Δ_ref voor deze beslispunt (in minuten). Als undefined → gebruik round.designTimeMinutes.
  designTimeMinutes?: number
  options: OptionSpec[]
  // Deel A §2 — escalatie-klok gekoppeld aan beslispunt.
  escalationTrigger?: { atInject: string; targetHours: number }
  // Verwachte verdeling van *wie* dit beslispunt neemt (rolen → aandeel). Spec §7.2 p_i*.
  // Default: 100% aan designedOwner (of effectiveOwner post-resolutie).
  expectedOwnerDistribution?: Record<RoleId, number>
}

export interface InjectSpec {
  id: string
  round: number
  // Deel A §3.1 — crucial dekt "materieel voor beslissing", info is achtergrondkleur.
  importance: 'crucial' | 'info'
  // Deel A §4.2b — asymmetrische zichtbaarheid (niet routing).
  visibleTo?: RoleId[]
  // Deel A §4.2c — misroute-inject: hoort feitelijk bij deze rol.
  correctRoute?: RoleId
  // Deel A §3.1 — 'facilitator' = ad-hoc gepusht; ruis voor D-berekening als imp=info.
  origin: 'scenario' | 'facilitator'
  // Voor MANDAAT §7.2 — welk domein raakt deze inject bij escalatie? Optioneel.
  relatedDomain?: Domain
}

export interface RoundSpec {
  number: number
  // Deel A §7.1 — Δ_ref voor tempo-scoring (ronde-niveau default).
  designTimeMinutes: number
  // Deel A §5 — weging per dimensie in deze ronde.
  outcomeWeights: Record<OutcomeDimension, number>
  // Deel A §7.4 — tijdvenster voor herziening (min). Default REVISION_WINDOW_MIN.
  revisionWindowMin?: number
}

export interface ExternalPartySpec {
  id: string
  label: string
  // Deel A §7.5 w_j
  weight: number
  // Deel A §7.5 κ_j — tolerantie in uren.
  toleranceHours: number
  // Venster relatief aan sessie-start in uren [open, sluit]. Optioneel.
  window?: { openHours: number; closeHours: number }
}

export interface ScenarioSpec {
  rounds: RoundSpec[]
  decisionPoints: DecisionPointSpec[]
  injects: InjectSpec[]
  externalParties?: ExternalPartySpec[]
  // Deel A §7.8 — override gewichten van PROCES-aggregatie.
  processWeights?: Partial<Record<ProcessDimension, number>>
  // Deel B §1.1 — override fallback-ketens per domein.
  domainOwnership?: Partial<Record<Domain, RoleId[]>>
  // Deel B §1.6 — minimum distinctOwners waaronder required=false beslispunten vervallen.
  optionalDecisionThreshold?: number
}

// ── Input: uitvoering + event log ──────────────────────────────────────

export interface Roster {
  // Bezette rollen (participants). Eén persoon speelt mogelijk meerdere rollen (multiplex);
  // dan komt de rol in meerdere entries voor, of eenmalig — de resolutie kijkt naar de set.
  presentRoles: RoleId[]
  // Deel A §4.2d — rollen die de facilitator speelt; besluiten van deze rollen tellen niet in scoring.
  npcRoles?: RoleId[]
  // Deel B §4 — groep-model voor EVENT-mode. In ASSESSMENT undefined.
  groups?: Array<{ id: string; name: string; participantIds: string[] }>
}

// Één event uit de log. Discriminated union — herberekening leest hier uit.
export type ExerciseEvent =
  | { kind: 'session_start'; t: number }
  | { kind: 'round_phase_changed'; t: number; round: number; toPhase: 'briefing' | 'overleg' | 'keuze' | 'lock' | 'review' }
  | { kind: 'inject_received'; t: number; round: number; injectId: string; recipient: RoleId }
  | { kind: 'inject_shared'; t: number; round: number; injectId: string; sharedBy: RoleId }
  | { kind: 'decision_submitted'; t: number; round: number; decisionPointId: string; optionId: string; by: RoleId; confidence?: number; cosignedBy?: RoleId[]; assumptions?: AssumptionTag[]; premises?: PremiseTag[] }
  | { kind: 'decision_revised'; t: number; round: number; decisionPointId: string; optionId: string; by: RoleId; triggeredByInjectId?: string }
  | { kind: 'external_party_activated'; t: number; partyId: string; actionable: 0 | 0.5 | 1 }
  | { kind: 'escalation_fired'; t: number; decisionPointId: string; escalatedBy: RoleId }
  | { kind: 'handoff_recorded'; t: number; quality: number /* 0..1 */ }
  | { kind: 'roster_snapshot'; t: number; hoursWorkedByRole: Record<RoleId, number>; taskShareByRole: Record<RoleId, number>; hasRoster: boolean; rosterCreatedBeforeHour: number | null }
  | { kind: 'facilitator_slider'; t: number; round: number; dimension: ProcessDimension; value: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'facilitator_q_j'; t: number; partyId: string; value: 0 | 0.5 | 1 }
  | { kind: 'facilitator_handoff_quality'; t: number; value: number /* 0..1 */ }

export interface AssumptionTag {
  text: string
  kind: 'fact' | 'assumption'
  source?: string
  falsificationTrigger?: string
}

// Alias voor toekomstige uitbreiding — vandaag identiek aan AssumptionTag.
export type PremiseTag = AssumptionTag

// ── Input samengebracht ───────────────────────────────────────────────

export interface ExerciseInput {
  scenario: ScenarioSpec
  roster: Roster
  events: ExerciseEvent[]
  mode: Mode
}

// ── Output ─────────────────────────────────────────────────────────────

export type DataQuality = 'measured' | 'observation' | 'null'

export interface DimensionScore {
  value: number | null   // 0..5, of null bij ontbrekende data
  dataQuality: DataQuality
  reason?: string        // gevuld wanneer value=null, of wanneer observation ≠ measured
  // Sub-termen — nuttig voor debrief, zonder deze in de aggregate te laten meelopen.
  detail?: Record<string, number | null>
}

export interface RoundOutcome {
  round: number
  // Deel A §5 — gemiddelde uitkomst over de 6 dims, genormaliseerd op −1..+1.
  normalized: number
  // Per-dim uitkomst (som van gekozen vectoren × gewicht, gedeeld door max).
  perDimension: Record<OutcomeDimension, number>
  // Deel B §5.1 — punten 0..100 = round(100 · (normalized+1) / 2).
  points: number
}

export interface ScoringOutput {
  scoringVersion: string
  mode: Mode
  roleResolution: {
    effectiveOwners: Record<Domain, RoleId | 'NPC'>
    rolCoverage: number
    distinctOwners: number
    resolvedAt: number
  }
  outcomes: RoundOutcome[]
  totalPoints: number
  dimensions: Record<ProcessDimension, DimensionScore>
  processAggregate: number | null   // Deel A §7.8 — geometrisch gewogen gemiddelde over meetbare dims.
  calibration?: number | null       // Deel B §7.2 — als confidence data bestaat.
  // Debrief-haakjes: welke required=false beslispunten zijn overgeslagen door team-drempel.
  droppedOptionalDecisions: string[]
}
