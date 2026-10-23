// De stappenflow van de deelnemer. Eén bron voor welke stap open staat, welke
// stap het scherm toont en welke tekst de onboarding bevat.
//
// Waarom puur en zonder React: de facilitator bepaalt de fase, de deelnemer
// volgt. Die afleiding moet testbaar zijn zonder een browser, want issue #105
// ontstond precies doordat elk scherm zijn eigen afleiding had.

import type { RoundPhase, SessionState } from '@/lib/types'

export type StepId =
  | 'welkom'
  | 'ronde'
  | 'injects'
  | 'overleg'
  | 'keuze'
  | 'review'
  | 'afronding'

export const STEP_ORDER: readonly StepId[] = [
  'welkom',
  'ronde',
  'injects',
  'overleg',
  'keuze',
  'review',
  'afronding',
]

export const TOTAL_STEPS = STEP_ORDER.length

export interface StepMeta {
  id: StepId
  // Korte titel, bovenaan het scherm. Geen zin, geen uitleg.
  title: string
  // Eén regel die zegt wat je hier doet.
  lead: string
}

export const STEP_META: Record<StepId, StepMeta> = {
  welkom: {
    id: 'welkom',
    title: 'Jouw rol',
    lead: 'Wie je bent in deze oefening en wat je mag besluiten.',
  },
  ronde: {
    id: 'ronde',
    title: 'Deze ronde',
    lead: 'De situatie in het kort en de vraag waarover je straks beslist.',
  },
  injects: {
    id: 'injects',
    title: 'Berichten',
    lead: 'Alleen de berichten die jouw rol bereiken.',
  },
  overleg: {
    id: 'overleg',
    title: 'Overleg',
    lead: 'Bespreek met het team wat je gaat doen.',
  },
  keuze: {
    id: 'keuze',
    title: 'Keuze',
    lead: 'De gemandateerde rol dient de keuze in.',
  },
  review: {
    id: 'review',
    title: 'Review',
    lead: 'Wat jullie keuze deed op de zes dimensies.',
  },
  afronding: {
    id: 'afronding',
    title: 'Afronding',
    lead: 'Terugblik op de hele oefening.',
  },
}

export function stepNumber(id: StepId): number {
  return STEP_ORDER.indexOf(id) + 1
}

// "Stap 3 van 7" — de voortgangsregel die op elk scherm staat.
export function stepLabel(id: StepId): string {
  return `Stap ${stepNumber(id)} van ${TOTAL_STEPS}`
}

export function stepForPhase(phase?: RoundPhase): StepId {
  switch (phase) {
    case 'discussion':
      return 'overleg'
    case 'decision':
      return 'keuze'
    case 'review':
      return 'review'
    default:
      return 'injects'
  }
}

export interface FlowInput {
  status: SessionState['status']
  roundPhase?: RoundPhase
  currentRound: number
  // Heeft deze deelnemer een rol (geclaimd of overgenomen)? Zonder rol heeft
  // vooruitbladeren geen zin: er is niets dat van jou is.
  hasRole: boolean
}

// De hoogste stap die de facilitator heeft geopend. Hier loopt de deelnemer
// nooit voorbij.
export function highestOpenStep(input: FlowInput): StepId {
  if (input.status === 'ended') return 'afronding'
  if (!input.hasRole) return 'welkom'
  if (input.status === 'lobby') return 'welkom'
  if (input.currentRound < 0) return 'welkom'
  return stepForPhase(input.roundPhase)
}

// Waar de deelnemer landt zodra de facilitator iets opent. Bij een nieuwe
// ronde is dat de ronde-intro en niet meteen de berichtenstroom: zonder de
// beslisvraag weet niemand waarop hij moet letten (issue #105 §6).
export function landingStep(input: FlowInput): StepId {
  if (input.status === 'ended') return 'afronding'
  if (!input.hasRole) return 'welkom'
  if (input.status === 'lobby') return 'welkom'
  if (input.currentRound < 0) return 'welkom'
  if (!input.roundPhase || input.roundPhase === 'inject') return 'ronde'
  return stepForPhase(input.roundPhase)
}

// Terugbladeren mag, vooruitlopen niet.
export function clampStep(desired: StepId, highest: StepId): StepId {
  const d = STEP_ORDER.indexOf(desired)
  const h = STEP_ORDER.indexOf(highest)
  if (d < 0) return highest
  return d > h ? highest : desired
}

// Een sleutel die verandert zodra de facilitator de fase, de ronde of de
// status verzet. Het scherm springt dan naar de nieuwe landingsstap.
export function phaseKey(input: FlowInput): string {
  return `${input.status}:${input.currentRound}:${input.roundPhase ?? 'inject'}:${input.hasRole ? 'rol' : 'geenrol'}`
}

// ── Situatieschets inkorten ───────────────────────────────────────────
// Issue #105 §5: de rondeheader vertelde alle injects vooraf. De header is een
// korte algemene introductie; de rest blijft opvraagbaar maar staat niet open.
export function shortLead(text: string, maxChars = 320): { lead: string; rest: string } {
  const clean = (text ?? '').trim()
  if (clean.length <= maxChars) return { lead: clean, rest: '' }

  // Knip op een zinseinde binnen het budget, anders op een woordgrens.
  const window = clean.slice(0, maxChars)
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
    window.lastIndexOf('.\n'),
  )
  const cut = sentenceEnd > maxChars * 0.4 ? sentenceEnd + 1 : window.lastIndexOf(' ')
  const safeCut = cut > 0 ? cut : maxChars
  return {
    lead: clean.slice(0, safeCut).trim(),
    rest: clean.slice(safeCut).trim(),
  }
}

// ── Onboarding ────────────────────────────────────────────────────────
// Issue #105 §2: het introscherm was 964 woorden met BOB-fasen en
// feit/aanname-uitleg. Dat is niet meer de kern. Vijf kaarten, onder de 150
// woorden, en geen enkel woord over een raamwerk.

export type OnboardingIcon = 'rol' | 'bericht' | 'overleg' | 'keuze' | 'dimensies'

export interface OnboardingCard {
  icon: OnboardingIcon
  title: string
  body: string
}

export const ONBOARDING_LEAD = 'Vijf kaarten, dan begin je.'

export const ONBOARDING_CARDS: readonly OnboardingCard[] = [
  {
    icon: 'rol',
    title: 'Jouw rol en mandaat',
    body: 'Je speelt één rol. Je ziet wat die rol mag besluiten en wat niet.',
  },
  {
    icon: 'bericht',
    title: 'Lees je berichten',
    body: 'Berichten komen per rol binnen. Je ziet alleen wat jouw rol bereikt.',
  },
  {
    icon: 'overleg',
    title: 'Bespreek met je team',
    body: 'Overleg hardop. De beslisvraag van de ronde blijft in beeld staan.',
  },
  {
    icon: 'keuze',
    title: 'Bereid de keuze voor',
    body: 'Elke keuze hoort bij één rol. Die rol dient in, de rest adviseert.',
  },
  {
    icon: 'dimensies',
    title: 'Bespreek de gevolgen',
    body: 'In de review zie je wat je keuze doet op zes dimensies: containment, forensiek, continuïteit, juridisch, verantwoording en kosten.',
  },
]

// Het woordaantal van álle onboardingtekst bij elkaar. Issue #105 vraagt
// expliciet om dit getal, dus het komt uit de tekst zelf en niet uit een
// handmatige telling die scheef gaat zodra iemand een regel bijschrijft.
export function onboardingWordCount(): number {
  const all = [ONBOARDING_LEAD, ...ONBOARDING_CARDS.flatMap(c => [c.title, c.body])].join(' ')
  return all.split(/\s+/).filter(Boolean).length
}
