// De inhoud van de rondleidingen, plus de rekenregels voor waar de tekstballon
// komt te staan.
//
// Waarom geen screenshots: de eigenaar vroeg om beelden van het échte scherm
// met één functie uitgelicht en de rest vaag. Opgenomen screenshots geven dat
// beeld één keer en zijn daarna fout — elke opmaakwijziging maakt ze stil
// onjuist en iemand moet ze opnieuw maken. Een spotlight over de levende UI
// geeft hetzelfde beeld (echt scherm, één element scherp, rest gedimd en
// vervaagd, pijl en toelichting ernaast) en blijft automatisch kloppen.
//
// Waarom puur en zonder React: de teksten en de positieberekening zijn te
// testen zonder browser. De vitest-omgeving is `node`, er is geen jsdom.

export type TourSide = 'boven' | 'onder' | 'links' | 'rechts'

export interface TourStep {
  // CSS-selector van het element dat uitgelicht wordt. Niet gevonden?
  // De stap wordt overgeslagen in plaats van de rondleiding te breken.
  target: string
  title: string
  body: string
  // Waar de ballon staat als er ruimte is.
  prefer?: TourSide
}

export interface Tour {
  id: string
  name: string
  steps: TourStep[]
}

// Waarom `[data-tour="..."]` en geen klassen: klassen zijn opmaak en veranderen
// bij elke stijlwijziging. Een data-attribuut is een afspraak die blijft staan.
const TOUR_SELECTOR = /^\[data-tour="[a-z0-9-]+"\]$/

export function isTourSelector(selector: string): boolean {
  return TOUR_SELECTOR.test(selector)
}

// ── De rondleidingen ──────────────────────────────────────────────────

export const DEELNEMER_TOUR: Tour = {
  id: 'deelnemer',
  name: 'Zo werkt jouw scherm',
  steps: [
    {
      target: '[data-tour="deelnemer-voortgang"]',
      title: 'Zeven stappen',
      body:
        'Hier zie je waar je bent. Een stap met een slotje heeft de begeleider nog niet ' +
        'geopend; een stap die je al gehad hebt kun je altijd teruglezen.',
      prefer: 'rechts',
    },
    {
      target: '[data-tour="deelnemer-stapkop"]',
      title: 'Wat deze stap van je vraagt',
      body:
        'De kop zegt in één regel wat je hier doet. Lees die eerst, dan weet je waar je bij ' +
        'de rest van het scherm op moet letten.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="deelnemer-beslisvraag"]',
      title: 'De beslisvraag',
      body:
        'Hierover beslissen jullie straks. De vraag blijft in beeld, zodat je tijdens het ' +
        'lezen en het overleg weet waar het naartoe gaat.',
      prefer: 'rechts',
    },
    {
      target: '[data-tour="deelnemer-berichten"]',
      title: 'Jouw berichten',
      body:
        'Alleen de berichten die jouw rol bereiken staan hier. Een collega met een andere rol ' +
        'ziet iets anders — leg naast elkaar wat jullie hebben.',
      prefer: 'rechts',
    },
    {
      target: '[data-tour="deelnemer-keuze"]',
      title: 'De keuze indienen',
      body:
        'Elke optie hoort bij één rol. Heb jij het mandaat, dan dien jij in. Ligt het bij een ' +
        'ander, dan is jouw werk om te adviseren.',
      prefer: 'boven',
    },
    {
      target: '[data-tour="deelnemer-review"]',
      title: 'Wat jullie keuze deed',
      body:
        'Na de ronde zie je de gevolgen op de zes dimensies. Het is geen cijfer dat je moet ' +
        'halen, het is de basis voor de nabespreking.',
      prefer: 'boven',
    },
  ],
}

// De rondleiding die je bij de eerste keer krijgt, direct na de kaarten. Die
// kaarten zeggen wát je gaat doen; deze wijst aan wáár dat staat. De eigenaar
// vroeg die twee te combineren: "dit moet samen met screen van het scherm hoe
// dat dan samenhangt met de verschillende menutjes en hoe je er doorheen moet
// navigeren". Alle vier de doelen bestaan op stap 1, dus er wordt niets
// overgeslagen bij de eerste keer.
export const DEELNEMER_START_TOUR: Tour = {
  id: 'deelnemer-start',
  name: 'Zo vind je alles terug',
  steps: [
    {
      target: '[data-tour="deelnemer-voortgang"]',
      title: 'Dit is je menu',
      body:
        'De zeven stappen van de oefening. De stap waar je nu bent licht op, een stap met een ' +
        'slotje heeft de begeleider nog niet geopend. Alles wat je al gehad hebt kun je ' +
        'aanklikken om terug te kijken — je raakt niets kwijt.',
      prefer: 'rechts',
    },
    {
      target: '[data-tour="deelnemer-stapkop"]',
      title: 'Waar je nu bent',
      body:
        'De naam van de stap en in één regel wat je hier doet. Onderaan het scherm staat de ' +
        'knop naar de volgende stap, en de knop terug.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="deelnemer-rol"]',
      title: 'Jouw rol en mandaat',
      body:
        'Wat jouw rol wél mag besluiten, en wat uitdrukkelijk niet. Die grens is de helft van ' +
        'de oefening: een besluit doorschuiven naar de juiste rol is een goede zet.',
      prefer: 'boven',
    },
    {
      target: '[data-tour="deelnemer-menu"]',
      title: 'Documenten en uitleg',
      body:
        'Je documenten staan hier, en je kunt ze op elk moment openen — ook terwijl je een ' +
        'keuze maakt. Deze uitleg kun je hier altijd opnieuw starten.',
      prefer: 'rechts',
    },
  ],
}

export const FACILITATOR_TOUR: Tour = {
  id: 'facilitator',
  name: 'Zo werkt het dashboard',
  steps: [
    {
      target: '[data-tour="facilitator-stap-sessie"]',
      title: 'Stap 1 — sessie en lobby',
      body:
        'Hier staat de toegangscode en zie je wie er binnen is. Je start de oefening pas als ' +
        'de rollen bezet zijn.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="facilitator-stap-ronde"]',
      title: 'Stap 2 — actieve ronde',
      body:
        'Hier schuif je de ronde door de fasen: bericht, overleg, keuze, review. Je ziet hoeveel ' +
        'keuzes binnen zijn en op wie je nog wacht. Eigen injects pushen doe je op Gereedschap.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="facilitator-stap-review"]',
      title: 'Stap 3 — review',
      body:
        'Na de keuze bespreek je hier wat de ronde deed: wat elk team heeft ingediend en hoe ' +
        'dat uitpakt op de dimensies.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="facilitator-stap-eindbespreking"]',
      title: 'Stap 4 — eindbespreking',
      body:
        'Alle gespeelde rondes op een rij, met de keuzes, de dimensies en gespreksvragen. ' +
        'Van hieruit open je het facilitatorrapport; de deelnemers zien hun eigen terugblik.',
      prefer: 'onder',
    },
    {
      target: '[data-tour="facilitator-stap-gereedschap"]',
      title: 'Gereedschap',
      body:
        'Alles wat geen stap is: eigen injects, specials en techniek. Dat staat apart, zodat ' +
        'de hoofdflow er niet in verdrinkt.',
      prefer: 'onder',
    },
  ],
}

export const TOURS: Record<string, Tour> = {
  deelnemer: DEELNEMER_TOUR,
  facilitator: FACILITATOR_TOUR,
  deelnemerStart: DEELNEMER_START_TOUR,
}

export const ALL_TOURS: readonly Tour[] = [DEELNEMER_TOUR, DEELNEMER_START_TOUR, FACILITATOR_TOUR]

// ── Stappen die bestaan ───────────────────────────────────────────────

// Een stap waarvan het doel niet in de DOM zit wordt overgeslagen. `exists`
// komt van buiten (de component geeft `document.querySelector`), zodat deze
// functie zonder DOM te testen is.
export function resolveSteps(
  steps: readonly TourStep[],
  exists: (selector: string) => boolean,
): TourStep[] {
  return steps.filter(s => exists(s.target))
}

// ── Positie van de uitsnede en de ballon ──────────────────────────────

export interface TourRect {
  top: number
  left: number
  width: number
  height: number
}

export interface TourSize {
  width: number
  height: number
}

// Ruimte tussen het uitgelichte element en de ballon.
export const TOUR_GAP = 12
// Minimale ruimte tussen de ballon en de vensterrand.
export const TOUR_MARGIN = 8
// Hoeveel de uitsnede om het element heen uitloopt, zodat de rand van het
// element niet tegen de donkere laag aan ligt.
export const TOUR_CUTOUT_PADDING = 6
// Hoe ver de pijl minimaal van de hoek van de ballon blijft.
export const TOUR_ARROW_INSET = 16

const OPPOSITE: Record<TourSide, TourSide> = {
  boven: 'onder',
  onder: 'boven',
  links: 'rechts',
  rechts: 'links',
}

function clamp(value: number, min: number, max: number): number {
  // Past de ballon niet eens tussen de twee marges, dan wint de bovengrens
  // niet van de ondergrens: plak hem aan de linker-/bovenrand.
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

// De uitsnede: het element plus wat lucht, geklemd binnen het venster. Afronden
// naar buiten, anders laat een halve pixel een lichte naad zien tussen de vier
// panelen die de donkere laag vormen.
export function cutoutRect(
  target: TourRect,
  viewport: TourSize,
  padding = TOUR_CUTOUT_PADDING,
): TourRect {
  const left = Math.max(0, Math.floor(target.left - padding))
  const top = Math.max(0, Math.floor(target.top - padding))
  const right = Math.min(viewport.width, Math.ceil(target.left + target.width + padding))
  const bottom = Math.min(viewport.height, Math.ceil(target.top + target.height + padding))
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

export interface BalloonPlacement {
  side: TourSide
  left: number
  top: number
  // Middelpunt van de pijl, in vensterpixels. Los van de ballon, zodat het
  // klemmen aan de vensterrand de pijl niet meesleept: de ballon schuift, de
  // pijl blijft naar het element wijzen.
  arrowLeft: number
  arrowTop: number
}

// Waar de ballon komt te staan. Nooit buiten het venster: eerst een kant kiezen
// waar hij past, dan klemmen aan de randen.
export function placeBalloon(
  target: TourRect,
  balloon: TourSize,
  viewport: TourSize,
  prefer: TourSide = 'onder',
): BalloonPlacement {
  const roomBoven = target.top - TOUR_GAP - TOUR_MARGIN
  const roomOnder = viewport.height - (target.top + target.height) - TOUR_GAP - TOUR_MARGIN
  const roomLinks = target.left - TOUR_GAP - TOUR_MARGIN
  const roomRechts = viewport.width - (target.left + target.width) - TOUR_GAP - TOUR_MARGIN

  const fits: Record<TourSide, boolean> = {
    boven: roomBoven >= balloon.height,
    onder: roomOnder >= balloon.height,
    links: roomLinks >= balloon.width,
    rechts: roomRechts >= balloon.width,
  }

  // Eerst de voorkeur, dan de overkant, dan onder/boven. Op een smal venster
  // (375px) is er naast een element vrijwel nooit ruimte voor een ballon van
  // ~300px breed, dus valt een voorkeur van links/rechts daar automatisch terug
  // op onder of boven.
  const order: TourSide[] = [prefer, OPPOSITE[prefer], 'onder', 'boven', 'rechts', 'links']
  const side = order.find(s => fits[s]) ?? (roomOnder >= roomBoven ? 'onder' : 'boven')

  const maxLeft = viewport.width - balloon.width - TOUR_MARGIN
  const maxTop = viewport.height - balloon.height - TOUR_MARGIN
  const centerX = target.left + target.width / 2
  const centerY = target.top + target.height / 2

  let left: number
  let top: number
  switch (side) {
    case 'onder':
      left = clamp(centerX - balloon.width / 2, TOUR_MARGIN, maxLeft)
      top = clamp(target.top + target.height + TOUR_GAP, TOUR_MARGIN, maxTop)
      break
    case 'boven':
      left = clamp(centerX - balloon.width / 2, TOUR_MARGIN, maxLeft)
      top = clamp(target.top - TOUR_GAP - balloon.height, TOUR_MARGIN, maxTop)
      break
    case 'rechts':
      left = clamp(target.left + target.width + TOUR_GAP, TOUR_MARGIN, maxLeft)
      top = clamp(centerY - balloon.height / 2, TOUR_MARGIN, maxTop)
      break
    default:
      left = clamp(target.left - TOUR_GAP - balloon.width, TOUR_MARGIN, maxLeft)
      top = clamp(centerY - balloon.height / 2, TOUR_MARGIN, maxTop)
      break
  }

  const insetX = Math.min(TOUR_ARROW_INSET, balloon.width / 2)
  const insetY = Math.min(TOUR_ARROW_INSET, balloon.height / 2)

  const horizontal = side === 'boven' || side === 'onder'
  const arrowLeft = horizontal
    ? clamp(centerX, left + insetX, left + balloon.width - insetX)
    : side === 'rechts'
      ? left
      : left + balloon.width
  const arrowTop = horizontal
    ? side === 'onder'
      ? top
      : top + balloon.height
    : clamp(centerY, top + insetY, top + balloon.height - insetY)

  return { side, left, top, arrowLeft, arrowTop }
}
