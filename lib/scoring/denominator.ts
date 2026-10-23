// De noemer van een scorebespreking.
//
// Waarom een eigen module: de live test liet "0 van 600" zien na één gespeelde
// ronde zonder inzendingen. De noemer was `outcomes.length * 100` over álle
// ronde-nodes in de graph. Een ronde die nooit is gespeeld, en een gespeelde
// ronde zonder enig beslispunt, konden nooit punten opleveren — ze horen dus
// niet in de noemer. Anders zakt elk team naar 0% door rondes die het nooit
// heeft gezien.

import type { RoundOutcome, ScenarioSpec } from './types'

// Een ronde-uitkomst loopt van 0 tot 100 punten (zie outcome-round.ts).
export const POINTS_PER_ROUND = 100

// Gespeelde rondes met minstens één beslismoment. `outcomes` bevat per
// definitie al alleen de gespeelde rondes (scoreExercise beperkt daarop), dus
// hier blijft alleen de vraag over of de ronde ook iets te beslissen gaf.
export function scorableRounds(scenario: ScenarioSpec, outcomes: RoundOutcome[]): RoundOutcome[] {
  const roundsWithDecision = new Set(scenario.decisionPoints.map(dp => dp.round))
  return outcomes.filter(o => roundsWithDecision.has(o.round))
}

export interface ScoreDenominator {
  // Rondes die meetellen in de noemer.
  rounds: number[]
  maxPoints: number
  // Daarvan de rondes waarin werkelijk iets is ingediend. Een scoorbare ronde
  // zonder inzending telt als 0 punten — de kans was er, het team pakte hem niet.
  measuredRounds: number[]
  // Niets ingediend in geen enkele scoorbare ronde: dan is er niets te scoren
  // en is een percentage misleidend in plaats van informatief.
  nothingToScore: boolean
  // Percentage, of null wanneer er niets te scoren is.
  percentage: number | null
}

export function scoreDenominator(
  scenario: ScenarioSpec,
  outcomes: RoundOutcome[],
  totalPoints: number,
): ScoreDenominator {
  const scorable = scorableRounds(scenario, outcomes)
  const measured = scorable.filter(o => o.hasSubmissions)
  const maxPoints = scorable.length * POINTS_PER_ROUND
  const nothingToScore = measured.length === 0
  return {
    rounds: scorable.map(o => o.round),
    maxPoints,
    measuredRounds: measured.map(o => o.round),
    nothingToScore,
    percentage: nothingToScore || maxPoints === 0 ? null : Math.round((totalPoints / maxPoints) * 100),
  }
}

// Dezelfde noemer, maar vanuit een al berekend rapport.
//
// Waarom een tweede ingang: een weergave heeft geen `ScenarioSpec` bij de hand,
// en `applyRegulatoryAdjustment()` kan ronde-rijen aan `outcomes` toevoegen voor
// een meldplicht-verzuim in een ronde die nooit een beslismoment had. Zo'n rij
// mag de noemer niet laten groeien. De noemer is daarom al vastgesteld in het
// rapport (`scorableRounds` / `maxPoints`); hier wordt alleen nog geteld welke
// van die rondes werkelijk een inzending hadden.
export function denominatorFromReport(report: {
  outcomes: RoundOutcome[]
  scorableRounds: number[]
  maxPoints: number
  totalPoints: number
}): ScoreDenominator {
  const scorable = new Set(report.scorableRounds)
  const measured = report.outcomes.filter(o => scorable.has(o.round) && o.hasSubmissions)
  const nothingToScore = measured.length === 0
  return {
    rounds: [...report.scorableRounds],
    maxPoints: report.maxPoints,
    measuredRounds: measured.map(o => o.round),
    nothingToScore,
    percentage: nothingToScore || report.maxPoints === 0
      ? null
      : Math.round((report.totalPoints / report.maxPoints) * 100),
  }
}

// Eén regel voor alle rapportweergaven, zodat deelnemer, facilitator en rapport
// hetzelfde lezen als er nog niets gescoord kan worden.
export const NOTHING_TO_SCORE_NL =
  'Er zijn nog geen keuzes ingediend — er is dus niets te scoren.'
