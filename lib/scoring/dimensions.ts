// De zes dimensies in mensentaal. Eén bron voor deelnemer, facilitator én
// rapport — issue #105 vroeg expliciet dat die drie exact hetzelfde tonen.
//
// Waarom hier en niet in i18n: dit is domeininhoud (wat betekent +2 op
// forensiek), geen UI-tekst. De scorebespreking is een gesprekshulpmiddel, dus
// de *richting* en de *reden* staan vooraan en het getal is secundair.

import { OUTCOME_DIMENSIONS, type OutcomeDimension } from './constants'

export type ImpactDirection = 'positief' | 'negatief' | 'neutraal'

export interface DimensionMeta {
  key: OutcomeDimension
  // Volledig uitgeschreven, zoals issue #105 vraagt. Nooit alleen de code.
  label: string
  // Waar deze as over gaat, in één regel voor de facilitator.
  question: string
  // Wat een plus respectievelijk een min op deze as betekent. Gebruikt om de
  // toelichting per dimensie te genereren zonder dat een auteur per optie
  // zes zinnen hoeft te schrijven.
  up: string
  down: string
  // Wat een 0 hier betekent. Apart veld omdat `question` een vraag is: die
  // leest achter "Geen effect — " als een vraag aan de deelnemer in plaats van
  // als uitleg.
  flat: string
}

export const DIMENSION_META: Record<OutcomeDimension, DimensionMeta> = {
  CONT: {
    key: 'CONT',
    label: 'Containment',
    question: 'Houden we de aanvaller tegen en breidt het incident zich niet verder uit?',
    up: 'de aanvaller krijgt minder ruimte',
    down: 'de aanval kan zich verder uitbreiden',
    flat: 'Deze keuze verandert niets aan de bewegingsruimte van de aanvaller.',
  },
  FOR: {
    key: 'FOR',
    label: 'Forensische positie',
    question: 'Kunnen we achteraf nog vaststellen wat er is gebeurd?',
    up: 'sporen blijven bruikbaar voor onderzoek',
    down: 'bewijs raakt verloren of onbetrouwbaar',
    flat: 'Deze keuze verandert niets aan wat je achteraf nog kunt vaststellen.',
  },
  BC: {
    key: 'BC',
    label: 'Bedrijfscontinuïteit',
    question: 'Blijft het primaire proces doorlopen?',
    up: 'het werk kan doorgaan',
    down: 'het primaire proces valt (verder) stil',
    flat: 'Deze keuze raakt het primaire proces niet.',
  },
  JUR: {
    key: 'JUR',
    label: 'Juridisch & meldplicht',
    question: 'Staan we juridisch sterk en halen we onze meldtermijnen?',
    up: 'de juridische en meldpositie wordt sterker',
    down: 'er ontstaat juridisch risico of een gemiste termijn',
    flat: 'Deze keuze verandert de juridische en meldpositie niet.',
  },
  VER: {
    key: 'VER',
    label: 'Verantwoording & communicatie',
    question: 'Kunnen we dit uitleggen aan wie het aangaat?',
    up: 'het verhaal naar buiten blijft houdbaar',
    down: 'vertrouwen van betrokkenen loopt schade op',
    flat: 'Deze keuze verandert niets aan wat je kunt uitleggen.',
  },
  KOS: {
    key: 'KOS',
    label: 'Kosten & schade',
    question: 'Wat kost dit, in geld en in schade?',
    up: 'kosten en schade blijven beperkt',
    down: 'kosten of schade lopen op',
    flat: 'Deze keuze kost niets extra en voorkomt niets extra.',
  },
}

// Volgorde waarin de zes altijd verschijnen. Vast, zodat deelnemer,
// facilitator en rapport dezelfde rij tonen.
export const DIMENSION_ORDER: readonly OutcomeDimension[] = OUTCOME_DIMENSIONS

export interface DimensionImpact {
  key: OutcomeDimension
  label: string
  value: number
  direction: ImpactDirection
  // 0 = geen effect, 1 = merkbaar, 2 = bepalend. Voor pijl/kleur-intensiteit.
  magnitude: 0 | 1 | 2
  // Pijl als los teken, zodat de UI geen eigen mapping hoeft te verzinnen.
  arrow: '↑' | '↓' | '→'
  // De menselijke toelichting: waarom staat hier een plus of een min.
  explanation: string
}

// Een waarde van exact 0 is een echt antwoord ("geen effect op deze as"), niet
// een ontbrekende waarde. Daarom rendert de UI alle zes altijd — issue #105:
// "Elke keuze moet aan alle zes dimensies gekoppeld zijn."
export function dimensionImpact(key: OutcomeDimension, value: number): DimensionImpact {
  const meta = DIMENSION_META[key]
  const v = Number.isFinite(value) ? value : 0
  const abs = Math.abs(v)
  const magnitude: 0 | 1 | 2 = abs === 0 ? 0 : abs >= 1.5 ? 2 : 1
  const direction: ImpactDirection = v > 0 ? 'positief' : v < 0 ? 'negatief' : 'neutraal'
  const arrow = v > 0 ? '↑' : v < 0 ? '↓' : '→'
  let explanation: string
  if (v === 0) {
    explanation = `Geen effect. ${meta.flat}`
  } else if (v > 0) {
    explanation = magnitude === 2 ? `Sterk: ${meta.up}.` : `${capitalise(meta.up)}.`
  } else {
    explanation = magnitude === 2 ? `Zwaar: ${meta.down}.` : `${capitalise(meta.down)}.`
  }
  return { key, label: meta.label, value: v, direction, magnitude, arrow, explanation }
}

export type OutcomeVectorLike = Partial<Record<OutcomeDimension, number>> | null | undefined

// Altijd zes impacts, in vaste volgorde. Een ontbrekende dimensie in de
// opgeslagen vector wordt 0 — "geen effect", niet "onbekend".
export function dimensionImpacts(vector: OutcomeVectorLike): DimensionImpact[] {
  return DIMENSION_ORDER.map(key => dimensionImpact(key, vector?.[key] ?? 0))
}

// De trade-off in één zin: de sterkste winst tegenover het zwaarste verlies.
// Dit is wat de facilitator plenair voorleest, dus geen getallen in de kern van
// de zin — die staan al in de kolom ernaast.
export function tradeOffSentence(vector: OutcomeVectorLike): string | null {
  const impacts = dimensionImpacts(vector)
  const gains = impacts.filter(i => i.value > 0).sort((a, b) => b.value - a.value)
  const losses = impacts.filter(i => i.value < 0).sort((a, b) => a.value - b.value)
  if (gains.length === 0 && losses.length === 0) return null
  if (gains.length === 0) {
    return `Deze keuze levert op geen enkele as winst op en kost vooral ${losses[0].label.toLowerCase()}.`
  }
  if (losses.length === 0) {
    return `Deze keuze wint op ${gains[0].label.toLowerCase()} zonder dat een andere as eronder lijdt.`
  }
  return `${gains[0].label} wordt beter, maar dat gaat ten koste van ${losses[0].label.toLowerCase()}.`
}

// Waarom een ronde zonder inzending alsnog een vector heeft: de tijd liep af.
// De reden hoort zichtbaar te zijn naast de score (issue #105 §6).
export const NO_DECISION_REASON =
  'Er is binnen de tijd geen besluit ingediend. De gevolgen hieronder zijn die van niets doen.'

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
