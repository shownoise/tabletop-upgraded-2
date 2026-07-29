import type { ExerciseInput, ScoringOutput } from './types'

// Referentiecase — Deel A §9 "één volledig ransomware-scenario van vier rondes
// met vastgelegd besluitpad en verwachte eindscores. Verandert die uitkomst,
// dan expliciet in de changelog."
//
// Scenario: dubbele extortie, T+0..T+70u, drie kritieke beslispunten per ronde,
// vier externe partijen (retainer, verzekeraar, AP, NCSC). Team van 6:
// CRISIS_LEAD, SECURITY_LEAD, LEGAL_DPO, IT_LEAD, COMMS, FINANCE_PROC.
// RETAINER_LIAISON en HR onbezet → fallback naar SECURITY_LEAD / CRISIS_LEAD.
export const referenceExercise: ExerciseInput = {
  mode: 'ASSESSMENT',
  roster: {
    presentRoles: ['CRISIS_LEAD', 'SECURITY_LEAD', 'LEGAL_DPO', 'IT_LEAD', 'COMMS', 'FINANCE_PROC', 'BUSINESS_OWNER'],
  },
  scenario: {
    rounds: [
      { number: 1, designTimeMinutes: 20, outcomeWeights: { CONT: 3, FOR: 3, BC: 2, JUR: 1, VER: 1, KOS: 1 } },
      { number: 2, designTimeMinutes: 20, outcomeWeights: { CONT: 2, FOR: 2, BC: 1, JUR: 3, VER: 2, KOS: 1 } },
      { number: 3, designTimeMinutes: 25, outcomeWeights: { CONT: 1, FOR: 1, BC: 2, JUR: 2, VER: 3, KOS: 2 } },
      { number: 4, designTimeMinutes: 25, outcomeWeights: { CONT: 1, FOR: 1, BC: 1, JUR: 3, VER: 3, KOS: 1 } },
    ],
    externalParties: [
      { id: 'retainer',    label: 'IR-retainer',           weight: 3, toleranceHours: 2,  window: { openHours: 0, closeHours: 1 } },
      { id: 'insurer',     label: 'Verzekeraar',           weight: 2, toleranceHours: 4,  window: { openHours: 0, closeHours: 6 } },
      { id: 'ap',          label: 'Autoriteit Persoonsgegevens', weight: 3, toleranceHours: 2,  window: { openHours: 0, closeHours: 72 } },
      { id: 'ncsc',        label: 'NCSC',                  weight: 2, toleranceHours: 2,  window: { openHours: 0, closeHours: 24 } },
    ],
    injects: [
      // R1 — detectie
      { id: 'r1-i1', round: 1, importance: 'crucial', origin: 'scenario', visibleTo: ['SECURITY_LEAD'] },
      { id: 'r1-i2', round: 1, importance: 'crucial', origin: 'scenario', visibleTo: ['IT_LEAD'] },
      { id: 'r1-i3', round: 1, importance: 'info',    origin: 'scenario' },
      // R2 — exfiltratie
      { id: 'r2-i1', round: 2, importance: 'crucial', origin: 'scenario', visibleTo: ['LEGAL_DPO'] },
      { id: 'r2-i2', round: 2, importance: 'crucial', origin: 'scenario', visibleTo: ['FINANCE_PROC'] },
      { id: 'r2-i3', round: 2, importance: 'crucial', origin: 'scenario' },
      { id: 'r2-i4', round: 2, importance: 'info',    origin: 'scenario' },
      { id: 'r2-i5', round: 2, importance: 'info',    origin: 'scenario', correctRoute: 'COMMS', visibleTo: ['HR'] },  // journalist belt HR-lijn
      // R3 — leak-site
      { id: 'r3-i1', round: 3, importance: 'crucial', origin: 'scenario', visibleTo: ['COMMS'] },
      { id: 'r3-i2', round: 3, importance: 'info',    origin: 'scenario' },
      // R4 — recovery
      { id: 'r4-i1', round: 4, importance: 'crucial', origin: 'scenario' },
    ],
    decisionPoints: [
      { id: 'r1-cont', round: 1, domain: 'CONTAINMENT', designedOwner: 'SECURITY_LEAD',  designTimeMinutes: 20, required: true, options: [
        { id: 'r1-cont-a', label: 'Volledig isoleren',    outcomeVector: { CONT:  2, FOR: -1, BC: -2, JUR:  0, VER: 0, KOS: -1 } },
        { id: 'r1-cont-b', label: 'Segment + EDR-isolatie', outcomeVector: { CONT:  2, FOR:  2, BC:  0, JUR:  0, VER: 0, KOS: -1 }, debriefNote: 'Snelheid + bewijsbehoud — referentieantwoord.' },
        { id: 'r1-cont-c', label: 'Wachten op scoping',   outcomeVector: { CONT: -2, FOR:  0, BC:  1, JUR: -1, VER: 0, KOS:  0 } },
      ] },
      { id: 'r2-jur', round: 2, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', consulted: ['CRISIS_LEAD', 'COMMS'], designTimeMinutes: 20, required: true,
        escalationTrigger: { atInject: 'r2-i1', targetHours: 4 },
        options: [
          { id: 'r2-jur-a', label: 'NIS2 early warning + AP-klok', outcomeVector: { CONT: 0, FOR:  0, BC: 0, JUR:  2, VER:  1, KOS: -1 } },
          { id: 'r2-jur-b', label: 'Wachten op forensisch bewijs',  outcomeVector: { CONT: 0, FOR:  1, BC: 0, JUR: -2, VER: -1, KOS:  0 } },
          { id: 'r2-jur-c', label: 'Counsel eerst', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR:  1, VER:  0, KOS: -1 } },
        ] },
      { id: 'r2-geld', round: 2, domain: 'GELD', designedOwner: 'FINANCE_PROC', consulted: ['LEGAL_DPO'], designTimeMinutes: 20, required: true, options: [
        { id: 'r2-geld-a', label: 'Verzekeraar nu bellen',        outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 1, KOS:  1 } },
        { id: 'r2-geld-b', label: 'Verzekeraar na scoping',        outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: -1 } },
        { id: 'r2-geld-c', label: 'Zelf voorschieten',              outcomeVector: { CONT: 0, FOR: 0, BC: 1, JUR: 0, VER: 0, KOS: -2 } },
      ] },
      { id: 'r3-comms', round: 3, domain: 'EXTERNE_COMMS', designedOwner: 'COMMS', designTimeMinutes: 25, required: true, options: [
        { id: 'r3-comms-a', label: 'Proactieve verklaring',   outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 1, VER:  2, KOS: 0 } },
        { id: 'r3-comms-b', label: 'No comment',              outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: -1, KOS: 0 } },
      ] },
      { id: 'r4-jur', round: 4, domain: 'JURIDISCH', designedOwner: 'LEGAL_DPO', designTimeMinutes: 25, required: true, options: [
        { id: 'r4-jur-a', label: 'Volledige melding met scope', outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR:  2, VER:  1, KOS: -1 } },
        { id: 'r4-jur-b', label: 'Minimale melding',            outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: -1, VER: -1, KOS:  0 } },
      ] },
    ],
  },
  // Vastgelegd besluitpad: team kiest de "referentieantwoord"-opties in R1, R2-JUR, R2-GELD;
  // R3 no-comment (slecht), R4 volledig (goed). Externe partijen: retainer op tijd, insurer
  // net binnen venster, AP op tijd, NCSC 1u te laat.
  events: buildReferenceEvents(),
}

function buildReferenceEvents(): ExerciseInput['events'] {
  const T0 = 1_700_000_000_000  // arbitrary reference epoch
  const min = (m: number) => T0 + m * 60_000
  const hr = (h: number) => T0 + h * 3_600_000

  const evs: ExerciseInput['events'] = [
    { kind: 'session_start', t: T0 },
    // — R1
    { kind: 'round_phase_changed', t: min(0),  round: 1, toPhase: 'briefing' },
    { kind: 'round_phase_changed', t: min(2),  round: 1, toPhase: 'overleg' },
    { kind: 'inject_received',     t: min(3),  round: 1, injectId: 'r1-i1', recipient: 'SECURITY_LEAD' },
    { kind: 'inject_received',     t: min(4),  round: 1, injectId: 'r1-i2', recipient: 'IT_LEAD' },
    { kind: 'inject_received',     t: min(5),  round: 1, injectId: 'r1-i3', recipient: 'CRISIS_LEAD' },
    { kind: 'inject_shared',       t: min(6),  round: 1, injectId: 'r1-i1', sharedBy: 'SECURITY_LEAD' },
    { kind: 'inject_shared',       t: min(7),  round: 1, injectId: 'r1-i2', sharedBy: 'IT_LEAD' },
    { kind: 'decision_submitted',  t: min(20), round: 1, decisionPointId: 'r1-cont', optionId: 'r1-cont-b', by: 'SECURITY_LEAD',
      confidence: 4, premises: [{ text: 'MDR ziet lateral movement', kind: 'fact', source: 'MDR' }, { text: 'EDR-isolatie werkt', kind: 'assumption', falsificationTrigger: 'als EDR-agents niet responderen: reset naar volledig isoleren' }] },
    { kind: 'external_party_activated', t: min(18), partyId: 'retainer', actionable: 1 },
    { kind: 'round_phase_changed', t: min(22), round: 1, toPhase: 'lock' },
    { kind: 'round_phase_changed', t: min(23), round: 1, toPhase: 'review' },

    // — R2 (T+6u start)
    { kind: 'round_phase_changed', t: hr(6),          round: 2, toPhase: 'briefing' },
    { kind: 'round_phase_changed', t: hr(6) + min(2), round: 2, toPhase: 'overleg' },
    { kind: 'inject_received',     t: hr(6) + min(3), round: 2, injectId: 'r2-i1', recipient: 'LEGAL_DPO' },
    { kind: 'inject_received',     t: hr(6) + min(4), round: 2, injectId: 'r2-i2', recipient: 'FINANCE_PROC' },
    { kind: 'inject_received',     t: hr(6) + min(5), round: 2, injectId: 'r2-i3', recipient: 'CRISIS_LEAD' },
    { kind: 'inject_received',     t: hr(6) + min(6), round: 2, injectId: 'r2-i4', recipient: 'IT_LEAD' },
    { kind: 'inject_received',     t: hr(6) + min(7), round: 2, injectId: 'r2-i5', recipient: 'HR' }, // misroute
    { kind: 'inject_shared',       t: hr(6) + min(8), round: 2, injectId: 'r2-i1', sharedBy: 'LEGAL_DPO' },
    { kind: 'inject_shared',       t: hr(6) + min(9), round: 2, injectId: 'r2-i2', sharedBy: 'FINANCE_PROC' },
    { kind: 'inject_shared',       t: hr(6) + min(10), round: 2, injectId: 'r2-i5', sharedBy: 'HR' },
    { kind: 'escalation_fired',    t: hr(6) + min(15), decisionPointId: 'r2-jur', escalatedBy: 'LEGAL_DPO' },
    { kind: 'decision_submitted',  t: hr(6) + min(22), round: 2, decisionPointId: 'r2-jur',  optionId: 'r2-jur-a',  by: 'LEGAL_DPO', confidence: 4 },
    { kind: 'decision_submitted',  t: hr(6) + min(24), round: 2, decisionPointId: 'r2-geld', optionId: 'r2-geld-a', by: 'FINANCE_PROC', confidence: 3 },
    { kind: 'external_party_activated', t: hr(6) + min(30), partyId: 'ap',      actionable: 1 },
    { kind: 'external_party_activated', t: hr(6) + min(32), partyId: 'insurer', actionable: 0.5 },
    { kind: 'round_phase_changed', t: hr(6) + min(35), round: 2, toPhase: 'lock' },
    { kind: 'round_phase_changed', t: hr(6) + min(36), round: 2, toPhase: 'review' },

    // — R3 (T+30u)
    { kind: 'round_phase_changed', t: hr(30),          round: 3, toPhase: 'briefing' },
    { kind: 'round_phase_changed', t: hr(30) + min(2), round: 3, toPhase: 'overleg' },
    { kind: 'inject_received',     t: hr(30) + min(3), round: 3, injectId: 'r3-i1', recipient: 'COMMS' },
    { kind: 'inject_received',     t: hr(30) + min(4), round: 3, injectId: 'r3-i2', recipient: 'CRISIS_LEAD' },
    { kind: 'inject_shared',       t: hr(30) + min(6), round: 3, injectId: 'r3-i1', sharedBy: 'COMMS' },
    { kind: 'decision_submitted',  t: hr(30) + min(28), round: 3, decisionPointId: 'r3-comms', optionId: 'r3-comms-b', by: 'COMMS', confidence: 5 },  // hoog vertrouwen op slechte keuze
    { kind: 'external_party_activated', t: hr(25),     partyId: 'ncsc', actionable: 1 },  // 1u te laat: sluit=24
    { kind: 'round_phase_changed', t: hr(30) + min(32), round: 3, toPhase: 'lock' },
    { kind: 'round_phase_changed', t: hr(30) + min(33), round: 3, toPhase: 'review' },

    // — R4 (T+70u)
    { kind: 'round_phase_changed', t: hr(70),          round: 4, toPhase: 'briefing' },
    { kind: 'round_phase_changed', t: hr(70) + min(2), round: 4, toPhase: 'overleg' },
    { kind: 'inject_received',     t: hr(70) + min(3), round: 4, injectId: 'r4-i1', recipient: 'LEGAL_DPO' },
    { kind: 'decision_submitted',  t: hr(70) + min(24), round: 4, decisionPointId: 'r4-jur', optionId: 'r4-jur-a', by: 'LEGAL_DPO', confidence: 4 },
    { kind: 'round_phase_changed', t: hr(70) + min(28), round: 4, toPhase: 'lock' },
    { kind: 'round_phase_changed', t: hr(70) + min(29), round: 4, toPhase: 'review' },

    // Roster snapshot (VOLHOUD)
    { kind: 'roster_snapshot', t: hr(6),
      hoursWorkedByRole: { CRISIS_LEAD: 10, SECURITY_LEAD: 12, LEGAL_DPO: 11, IT_LEAD: 12, COMMS: 8, FINANCE_PROC: 6, BUSINESS_OWNER: 4 },
      taskShareByRole:   { CRISIS_LEAD: 0.20, SECURITY_LEAD: 0.20, LEGAL_DPO: 0.15, IT_LEAD: 0.20, COMMS: 0.10, FINANCE_PROC: 0.10, BUSINESS_OWNER: 0.05 },
      hasRoster: true, rosterCreatedBeforeHour: 6 },
    { kind: 'facilitator_handoff_quality', t: hr(12), value: 0.7 },
  ]
  return evs
}

// Golden output vastgelegd door de scoring-engine v1.0.0 op referenceExercise.
// Bij veranderingen in formules: hier bijwerken én in de changelog.
// De waarden hier zijn "verwachte range" i.p.v. exacte cijfers om de test
// robuust te houden bij benoemde afrondings-tweaks. Zie __tests__/reference.test.ts.
// Vastgelegde bandbreedtes voor SCORING_VERSION 1.0.0. Bij formule-tweaks:
// hernieuwen én in de changelog optekenen. Bandbreedtes ipv exacte cijfers
// om afronding-tweaks te tolereren; assertions op de vorm van de output
// staan los.
export const REFERENCE_EXPECTED = {
  minTotalPoints: 200,
  maxTotalPoints: 400,
  minProcess: 1.5,
  maxProcess: 4.5,
  expectDimensionsMeasured: ['BESLUIT', 'ADAPT', 'EXTERN'] as const,
  expectDimensionsCanBeNull: ['VOLHOUD'] as const,
  expectRoleResolutionHasAllTen: true,
  expectCalibrationDefined: true,
}
