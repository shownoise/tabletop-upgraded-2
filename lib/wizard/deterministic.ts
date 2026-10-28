import type { WizardConfig } from "./config"
import { specialConditionById } from "./config"
import type {
  DynamicFillToken,
  InjectNodeData,
  OutcomeVector,
  RoleBriefing,
  RoundNodeData,
  ScenarioGraph,
} from "@/lib/graph/types"
import { DYNAMIC_FILL_TOKENS, EYE_SECURITY_RETAINER } from "@/lib/graph/types"
import {
  planToGraph,
  type WizardPlan,
  type WizardPlanDecision,
  type WizardPlanInject,
  type WizardPlanRound,
} from "@/lib/graph/wizard-plan"
import type { ChoiceQuality, Role } from "@/lib/types"
import { ROLE_META, ROLE_ORDER } from "@/lib/types"

// Deterministische conceptgenerator — het pad zonder LLM.
//
// WAAROM: runWizardPipeline doet tien of meer LLM-aanroepen in één HTTP-request
// en haalt bij vier rondes de 5-minuten-grens van de route niet. Dit pad bouwt
// hetzelfde soort graph in code: dezelfde config levert dezelfde graph, altijd
// binnen een paar milliseconden, en haalt alle regels uit framework.ts zonder
// repair-pass. Het resultaat is een bruikbaar CONCEPT — de facilitator scherpt
// de teksten in de builder aan. Het LLM-pad blijft bestaan voor wie wil wachten
// op uitgeschreven verhaal.
//
// Puur: geen I/O, geen Date.now(), geen Math.random(). De tijdstempel komt via
// options.now zodat de route een echte tijd kan meegeven en tests niet.

// ───────────────────────────────────────────────────────────────────────────
// Vocabulaire-discipline (rule13_situation_no_spoiler)
//
// rule13 rekent het aan als de situatieschets van een ronde een woord van 7+
// letters deelt met precies één inject van diezelfde ronde (vier of meer van
// die woorden = vooruitvertellen), of als er een letterlijk fragment van vijf
// woorden overlapt. Daarom geldt hier één harde regel: een situatieschets
// gebruikt alleen woorden van maximaal zes letters, plus de lange woorden
// hieronder. Elk woord in deze lijst moet uit álle inject-teksten blijven —
// inclusief de beslisvraag, want die wordt letterlijk in de setup-inject
// geciteerd. De test in __tests__/deterministic.test.ts bewaakt beide kanten.
// ───────────────────────────────────────────────────────────────────────────
export const SITUATION_LONG_WORDS: readonly string[] = [
  'aanwijzing', 'blijven', 'buitenwereld', 'gebracht', 'gekregen', 'grijpen',
  'organisatie', 'overleg', 'vastlegt', 'verleidelijk', 'verstreken',
  'verwacht', 'wachten', 'woorden',
]

// ───────────────────────────────────────────────────────────────────────────
// Fase-opbouw
//
// Een crisis-tabletop volgt dezelfde boog, los van de klant: signalen →
// beeldvorming → beheersen → melden → naar buiten → doorwerken → herstellen →
// verantwoorden. Elke fase levert de ronde-kop, de beslisvraag en het
// vocabulaire waaruit de injects worden opgebouwd.
//
// `echo` is de rode draad tussen rondes: hij opent de lessonLearned van de
// "geen besluit"-optie van déze ronde en komt letterlijk terug in de schets van
// de vólgende ronde. Daar leeft rule5_cross_round_lesson op.
// ───────────────────────────────────────────────────────────────────────────
interface PhaseSpec {
  key: string
  /** Ronde-titel (niet aan rule13 onderworpen). */
  title: string
  /** Rode draad naar de volgende ronde. Alleen korte woorden. */
  echo: string
  /** Stand van zaken — korte woorden. */
  state: string
  /** Waar de druk zit — korte woorden. */
  pressure: string
  /** De beslisvraag in algemene termen — korte woorden. */
  closing: string
  /** De beslisvraag van de ronde. Eindigt op een vraagteken. */
  prompt: string
  /** Korte aanduiding achter elke optie-label. */
  focus: string
  /** facilitatorNotes.discussionGoal — geen cijfers, geen hoofdletters midden in de zin (rule10). */
  goal: string
  opening: readonly [string, string]
  review: readonly [string, string]
  /** Wat er technisch te zien is. */
  signal: string
  /** Wat de monitoring los daarvan ziet — mag de setup-inject niet herhalen. */
  probe: string
  /** Wat het bedrijfsmatig betekent. */
  impact: string
  /** Wat er van buiten komt. */
  external: string
  /** Wat de beheerpartij meldt. */
  supplier: string
  /** Wat juridisch speelt. */
  legal: string
}

const PHASES: readonly PhaseSpec[] = [
  {
    key: 'signalen',
    title: 'Eerste signalen',
    echo: 'Het eerste beeld',
    state: 'Het is kort na negen uur op een gewone dag.',
    pressure: 'Van meer kanten komen korte vragen over werk dat niet lukt.',
    closing: 'Niets is hard en de losse delen passen nog niet op elkaar. Aan het eind van deze ronde ligt er één vraag op tafel: wat zet u nu in, en wat nog niet?',
    prompt: 'Welke eerste stap zet je nu, met een beeld dat nog niet rond is?',
    focus: 'eerste signalen',
    goal: 'Bespreek of het team durft te handelen op een beeld dat nog niet rond is, en wie dat mag beslissen.',
    opening: [
      'Wat weten we nu echt, en wat nemen we aan?',
      'Wie mag deze ronde handelen zonder eerst af te stemmen?',
    ],
    review: [
      'Welke aanname is onbewust als feit behandeld?',
      'Welke stap had een uur eerder gezet kunnen worden?',
    ],
    signal: 'twee losse storingstickets op dezelfde fileserver, binnen tien minuten aangemaakt',
    probe: 'een reeks mislukte aanmeldingen vanaf één werkplek, buiten werktijd begonnen',
    impact: 'twee afdelingen kunnen hun planning van vandaag niet openen',
    external: 'een vaste afnemer vraagt per mail waarom de bestelportal eruit ligt',
    supplier: 'de beheerpartij ziet de tickets ook, maar noemt het patroon voorlopig normaal onderhoud',
    legal: 'de functionaris gegevensbescherming wil weten of er persoonsgegevens in het spel zijn',
  },
  {
    key: 'beeldvorming',
    title: 'Beeldvorming',
    echo: 'De eerste harde aanwijzing',
    state: 'Er is ruim een uur verstreken sinds het eerste alarm.',
    pressure: 'Het beeld is iets helder, maar nog lang niet rond, en de tijd loopt door.',
    closing: 'Aan het eind van deze ronde kiest elke rol wat zij nu vastlegt en wat zij nog laat wachten. Wat weegt nu meer: snel of zeker?',
    prompt: 'Leg nu vast wat je weet, of wacht u op harde bevestiging?',
    focus: 'beeldvorming',
    goal: 'Bespreek hoe het team feit en aanname uit elkaar houdt zonder het tempo te verliezen.',
    opening: [
      'Welk signaal van dit uur is hard, en welk signaal is nog een aanname?',
      'Wie houdt het logboek bij, en vanaf welk moment?',
    ],
    review: [
      'Welke bron bleek later minder hard dan gedacht?',
      'Wat zou een extern onderzoek nu van dit logboek vinden?',
    ],
    signal: 'versleutelde bestanden op een tweede server en een losgeldbrief in dezelfde map',
    probe: 'een onbekend proces dat op drie machines tegelijk draait onder een beheeraccount',
    impact: 'de orderstroom van vandaag loopt handmatig door, met vertraging op elke stap',
    external: 'een regionale redactie belt met de vraag of er een datalek speelt rond {{crownJewels}}',
    supplier: 'de beheerpartij bevestigt dat de monitoring het patroon vanochtend al zag staan',
    legal: 'de huisjurist wijst erop dat de termijn voor een melding vandaag al kan starten',
  },
  {
    key: 'beheersen',
    title: 'Beheersen',
    echo: 'De keuze om in te grijpen',
    state: 'Het is nu middag en de crisis heeft een naam gekregen.',
    pressure: 'Elke keuze om iets plat te leggen raakt direct het werk van mensen.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: hoe ver ga je nu, en wat laat je met rust?',
    prompt: 'Hoe ver ga je met afsluiten, wetend dat het werk er direct onder lijdt?',
    focus: 'beheersing',
    goal: 'Bespreek de ruil tussen snel afsluiten en doorwerken, en wie die ruil mag maken.',
    opening: [
      'Wat mag er vandaag stil, en wat absoluut niet?',
      'Welke partij voert de maatregel uit, en binnen welke tijd?',
    ],
    review: [
      'Welke maatregel raakte meer werk dan verwacht?',
      'Wat was er nodig om deze stap een uur eerder te zetten?',
    ],
    signal: 'nieuwe aanmeldpogingen vanaf een beheeraccount dat niemand vandaag gebruikt',
    probe: 'uitgaand verkeer naar een adres in een land waar wij geen zaken doen',
    impact: 'de productie kan nog een halve dag door op voorraad, daarna stokt de keten',
    external: 'een grote klant vraagt schriftelijk om bevestiging dat zijn gegevens veilig zijn',
    supplier: 'de beheerpartij kan pas morgen extra mensen leveren; de afspraak dekt dit niveau niet',
    legal: 'de verzekeraar wil binnen een dag een eerste schriftelijke schademelding zien',
  },
  {
    key: 'melden',
    title: 'Melden en verantwoorden',
    echo: 'De keuze om te melden',
    state: 'De eerste dag loopt op zijn eind en de klok tikt door.',
    pressure: 'Wat u nu vastlegt, leest straks iemand anders terug.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: wie wordt nu op de hoogte gebracht, en met welke woorden?',
    prompt: 'Wie breng je nu op de hoogte, en wat zet je daarbij op papier?',
    focus: 'meldplicht',
    goal: 'Bespreek wanneer de klok is gaan lopen en wat het team op papier durft te zetten.',
    opening: [
      'Vanaf welk moment loopt de termijn volgens ons, en waarom?',
      'Wat weten we zeker genoeg om op te schrijven?',
    ],
    review: [
      'Zou een toezichthouder onze tijdlijn volgen?',
      'Welke melding is uit het oog verloren?',
    ],
    signal: 'een lijst met namen en rekeningnummers blijkt gekopieerd naar een adres buiten het netwerk',
    probe: 'een grote hoeveelheid data die gisteravond het netwerk uit is gegaan',
    impact: 'de vraag van afnemers verschuift van storing naar vertrouwen',
    external: 'een journalist heeft de losgeldbrief in handen en vraagt om een reactie voor morgen',
    supplier: 'de beheerpartij levert de logbestanden aan, met gaten in de laatste weken',
    legal: 'juridisch ligt er nu een termijn: de toezichthouder wil een eerste bericht zien',
  },
  {
    key: 'buiten',
    title: 'Het woord naar buiten',
    echo: 'Het woord naar buiten',
    state: 'Het is de tweede dag en de buitenwereld kijkt mee.',
    pressure: 'Intern en extern verwacht men nu één taal uit één mond.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: wie is onze stem naar buiten, en wat zegt die wel en niet?',
    prompt: 'Wie spreekt namens de klant, en welke boodschap gaat als eerste naar buiten?',
    focus: 'communicatie',
    goal: 'Bespreek wie namens de klant spreekt en hoe eerlijk de eerste boodschap kan zijn.',
    opening: [
      'Wat kan er nu naar buiten zonder dat we het morgen moeten terugnemen?',
      'Wie hoort het eerst: eigen mensen, afnemers of de pers?',
    ],
    review: [
      'Welke tekst zou u nu anders opschrijven?',
      'Wie kwam erachter via de pers in plaats van via ons?',
    ],
    signal: 'een deel van de gestolen gegevens staat op een lekpagina van de aanvaller',
    probe: 'verkeer tussen ons netwerk en de lekpagina van de aanvaller',
    impact: 'eigen medewerkers lezen het nieuws eerder dan de interne mail',
    external: 'de regionale krant komt vanavond online met een artikel over het incident',
    supplier: 'de beheerpartij wijst verzoeken van de pers door naar de klant zelf',
    legal: 'de huisjurist wil elke externe tekst eerst langs de verzekeraar leiden',
  },
  {
    key: 'doorwerken',
    title: 'Doorwerken onder druk',
    echo: 'De weg terug naar werk',
    state: 'De derde dag begint en de rek is uit het team.',
    pressure: 'Het werk gaat half door, de kosten lopen op en de mensen zijn moe.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: waar leg je je geld en je uren nu op in?',
    prompt: 'Waar zet je geld en mensen nu op in, nu niet alles tegelijk kan?',
    focus: 'continuïteit',
    goal: 'Bespreek welke keten als eerste weer moet lopen en wat dat mag kosten.',
    opening: [
      'Welk proces moet morgen weer lopen, en welk proces kan wachten?',
      'Wie houdt de mensen overeind die nu dubbel draaien?',
    ],
    review: [
      'Welke tijdelijke oplossing is stilletjes vast beleid geworden?',
      'Waar ging de rek er in het team uit?',
    ],
    signal: 'de terugzetpoging van de reservekopie breekt af op de helft van {{criticalSystems}}',
    probe: 'een reservekopie die wel bestaat maar bij uitlezen fouten geeft',
    impact: 'de kosten van de noodoplossing lopen harder op dan de schade van een dag stilstand',
    external: 'twee afnemers kondigen aan hun order elders te plaatsen als het morgen niet loopt',
    supplier: 'de beheerpartij rekent meerwerk door en vraagt om opdracht per mail',
    legal: 'juridisch moet elk uitwijkbesluit vastgelegd worden voor de latere schadeclaim',
  },
  {
    key: 'herstel',
    title: 'Herstel en hervatten',
    echo: 'De vraag wie er stuurt',
    state: 'Het is de vierde dag en er ligt zicht op een weg terug.',
    pressure: 'Snel weer open zijn is verleidelijk, maar het huis is nog niet schoon.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: is het huis schoon genoeg om de deur te openen?',
    prompt: 'Verklaar je de omgeving nu schoon en ga je weer open, of nog niet?',
    focus: 'hervatten',
    goal: 'Bespreek welk bewijs nodig is om te durven zeggen dat de omgeving schoon is.',
    opening: [
      'Welk bewijs hebben we dat de aanvaller eruit is?',
      'Wie durft het besluit te nemen dat we weer open gaan?',
    ],
    review: [
      'Welk bewijs ontbrak toen we weer opengingen?',
      'Wie had het laatste woord, en hoorde dat zo?',
    ],
    signal: 'de nieuwe omgeving staat klaar, maar twee oude beheeraccounts zijn nooit afgesloten',
    probe: 'twee beheeraccounts die nog actief zijn in de nieuwe omgeving',
    impact: 'de keten kan weer draaien op halve kracht, met handwerk op de controles',
    external: 'de aanvaller stuurt een laatste bericht met een nieuwe termijn',
    supplier: 'de beheerpartij levert de nieuwe omgeving op zonder schriftelijke oplevertest',
    legal: 'juridisch is een eindrapport aan de toezichthouder nog open',
  },
  {
    key: 'nazorg',
    title: 'Nazorg en les',
    echo: 'De les van deze dagen',
    state: 'Het is een week later en de rust is terug.',
    pressure: 'Nu moet er iets blijven hangen, anders was dit alleen een dure week.',
    closing: 'Aan het eind van deze ronde ligt er één vraag op tafel: wat blijft hier straks van over?',
    prompt: 'Wat legt u nu vast zodat deze week volgende keer anders verloopt?',
    focus: 'nazorg',
    goal: 'Bespreek welke les van deze week morgen nog ergens staat opgeschreven.',
    opening: [
      'Wat is de duurste les van deze week?',
      'Wie is eigenaar van de verbetering, met welke termijn?',
    ],
    review: [
      'Welke les verdwijnt zonder eigenaar?',
      'Wat zou een toezichthouder van ons eindverhaal vinden?',
    ],
    signal: 'het forensisch rapport legt de eerste toegang weken voor het alarm',
    probe: 'een eerste toegang die weken voor het alarm al in de logbestanden staat',
    impact: 'de schade in uren en omzet is groter dan de eerste schatting van dag een',
    external: 'een afnemer vraagt om bewijs dat de maatregelen nu echt staan',
    supplier: 'de beheerpartij stelt een nieuwe afspraak voor, met een hoger tarief',
    legal: 'het eindrapport aan de toezichthouder moet binnen een maand de deur uit',
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Rol-specifieke keuzes
//
// Zes handelingsrichtingen per rol, oplopend van "nu zelf knopen doorhakken"
// naar "wachten of grof ingrijpen". De index bepaalt de scorevector, dus de
// volgorde is betekenisvol: 0 is de scherpste keuze, 5 de valkuil.
// ───────────────────────────────────────────────────────────────────────────
const ROLE_ACTION_COUNT = 6

const ROLE_ACTIONS: Record<Role, readonly string[]> = {
  ceo: [
    'Nu zelf de knoop doorhakken en het mandaat vastleggen',
    'Het crisismandaat bij één persoon leggen en zelf afstand nemen',
    'De raad van toezicht meteen bijpraten',
    'Vasthouden aan het bestaande draaiboek',
    'Wachten tot het beeld compleet is',
    'De externe partij laten voorgaan en zelf volgen',
  ],
  ciso: [
    'De getroffen omgeving nu afsluiten',
    'Eerst sporen vastleggen en daarna ingrijpen',
    'De retainer laten overnemen',
    'Het draaiboek stap voor stap volgen',
    'Wachten op bevestiging uit de monitoring',
    'Alles tegelijk dichtzetten',
  ],
  cfo: [
    'Een noodbudget vrijmaken zonder tekenronde',
    'De verzekeraar meteen aan tafel vragen',
    'Alleen uitgaven goedkeuren die al begroot zijn',
    'Nu doorpakken en de kosten later verantwoorden',
    'Wachten op een onderbouwde raming',
    'Het bedrag eerst langs de accountant halen',
  ],
  legal: [
    'De meldklok nu formeel laten starten',
    'Een logboek openen en elk moment vastleggen',
    'De meldplicht in de leverancierscontracten nalopen',
    'Eerst extern juridisch advies inwinnen',
    'Pas melden na harde bevestiging',
    'De melding bij de toezichthouder uitstellen',
  ],
  head_of_comms: [
    'Nu zelf het eerste bericht naar buiten brengen',
    'Eigen mensen eerst informeren, pers daarna',
    'Een korte eerste verklaring klaarzetten en wachten',
    'De pers doorverwijzen naar de retainer',
    'Alleen intern laten weten wat er speelt',
    'Geen reactie geven tot het beeld rond is',
  ],
  hr_lead: [
    'Medewerkers meteen eerlijk bijpraten',
    'Een vast aanspreekpunt inrichten voor vragen van personeel',
    'Alleen de direct getroffen teams informeren',
    'Wachten op een afgestemde tekst van communicatie',
    'Mensen vrijaf geven zolang het werk stilligt',
    'Extra handen inhuren voor de duur van de crisis',
  ],
  ops_manager: [
    'De meest kritieke keten als eerste weer opstarten',
    'Het werk voortzetten op papier',
    'Afnemers zelf bellen over de vertraging',
    'Een omweg inrichten buiten de getroffen omgeving om',
    'Wachten op een datum van de techniek',
    'Alles stilleggen tot er groen licht is',
  ],
  it_manager: [
    'De besmette machines van het net halen',
    'Eerst een volledige kopie veiligstellen',
    'De reservekopie terugzetten op schone hardware',
    'Externe hulp inschakelen voor het onderzoek',
    'Wachten tot de leverancier beschikbaar is',
    'Alle accounts in één keer opnieuw instellen',
  ],
}

// Per index: kwaliteit, les en de vorm van de ruil. Index-gebonden en niet
// rol-gebonden, omdat de scorevector dat ook is — zo zeggen tekst en cijfer
// hetzelfde.
interface StanceSpec {
  quality: ChoiceQuality
  lesson: string
  commentary: string
  /** Twee assen omhoog, twee omlaag. NV1 en NV2 zijn altijd negatief: dat maakt
   *  dominantie tussen opties van dezelfde rol onmogelijk (rule3). */
  pv1: number
  pv2: number
  nv1: number
  nv2: number
}

const STANCES: readonly StanceSpec[] = [
  { quality: 'best',  pv1: 2, pv2: 1, nv1: -1, nv2: -1, lesson: 'Snel kiezen levert grip, maar je neemt een risico op een punt dat je nu niet overziet.',   commentary: 'De scherpste keuze van dit rijtje: hij wint op twee vlakken en kost op twee.' },
  { quality: 'good',  pv1: 2, pv2: 0, nv1: -1, nv2: -1, lesson: 'Deze keuze wint vooral op één vlak; benoem hardop wat hij elders kost.',                   commentary: 'Verdedigbaar. Vraag het team welk verlies zij hiermee bewust accepteren.' },
  { quality: 'good',  pv1: 1, pv2: 1, nv1: -1, nv2: -1, lesson: 'Een brede keuze: kleine winst op twee vlakken, kleine prijs op twee andere.',               commentary: 'Veilige middenweg. Prima keuze, zolang het team weet dat het weinig grip oplevert.' },
  { quality: 'poor',  pv1: 1, pv2: 0, nv1: -1, nv2: -2, lesson: 'Dit voelt zorgvuldig, maar het verlies zit in de tijd die het kost.',                       commentary: 'Zorgvuldigheid als uitstel. Vraag wat het team met de gewonnen tijd doet.' },
  { quality: 'poor',  pv1: 1, pv2: 0, nv1: -2, nv2: -1, lesson: 'Deze route kost meer dan hij oplevert; de aantrekkingskracht zit in de rust die hij geeft.', commentary: 'Begrijpelijke reflex onder druk, maar de rekening komt een ronde later.' },
  { quality: 'wrong', pv1: 1, pv2: 0, nv1: -2, nv2: -2, lesson: 'Dit is de valkuil: het voelt beheerst, maar je raakt op meerdere vlakken terrein kwijt.',    commentary: 'De valkuil van deze ronde. Laat het team zelf benoemen wat hier misgaat.' },
]

const AXES: readonly (keyof OutcomeVector)[] = ['CONT', 'FOR', 'BC', 'JUR', 'VER', 'KOS']

// Vier van de zes assen bewegen, op opeenvolgende posities vanaf `offset`.
// Zie STANCES: de twee negatieve assen zijn altijd echt negatief, waardoor
// geen enkele optie een andere van dezelfde rol op álle assen verslaat.
function outcomeVectorFor(stanceIndex: number, offset: number): OutcomeVector {
  const stance = STANCES[stanceIndex % STANCES.length]
  const vector: OutcomeVector = { CONT: 0, FOR: 0, BC: 0, JUR: 0, VER: 0, KOS: 0 }
  vector[AXES[(offset + 0) % 6]] = stance.pv1
  vector[AXES[(offset + 1) % 6]] = stance.nv1
  vector[AXES[(offset + 2) % 6]] = stance.pv2
  vector[AXES[(offset + 3) % 6]] = stance.nv2
  return vector
}

// ───────────────────────────────────────────────────────────────────────────
// Injects
//
// Zes invalshoeken. De eerste is altijd de setup-inject: die kondigt de
// beslisvraag van de ronde aan, eindigt op een vraagteken en is via
// setsUpDecisionNodeId aan de beslissing van die ronde gekoppeld (rule1).
// ───────────────────────────────────────────────────────────────────────────
interface InjectContext {
  phase: PhaseSpec
  roundNumber: number
  clientName: string
  itArrangement: string
  decisionAuthorId: string
}

type InjectAngle = (ctx: InjectContext) => Omit<WizardPlanInject, 'id' | 'classification'>

const INJECT_ANGLES: readonly InjectAngle[] = [
  ({ phase, roundNumber, clientName, decisionAuthorId }) => ({
    type: 'internal',
    channel: 'teams',
    title: `Crisiscoördinator: knoop voor ronde ${roundNumber}`,
    senderName: 'Crisiscoördinator',
    urgency: 'high',
    setsUpDecisionNodeId: decisionAuthorId,
    facilitatorNote: 'Setup-inject: legt de beslisvraag van deze ronde op tafel. Laat hem als eerste los.',
    // De beslisvraag zelf komt er in buildDraftGraph achteraan, ná eventuele
    // meldplicht- of omstandigheidstekst, zodat de vraag altijd de laatste zin
    // van deze inject is.
    content: `Team, de stand: ${phase.signal}. Bij ${clientName} is hier nog geen keuze over gemaakt en ik wil dat besluit hebben voordat de volgende update komt.`,
  }),
  ({ phase }) => ({
    type: 'technical',
    channel: 'siem',
    title: `Monitoring — afwijkend patroon op {{criticalSystems}}`,
    senderName: 'Monitoring',
    urgency: 'critical',
    content: `Uit de monitoring op {{criticalSystems}}: ${phase.probe}. Deze melding staat op naam van het systeem en niet van een mens; er is nog geen ticket van gemaakt.`,
  }),
  ({ phase, clientName }) => ({
    type: 'alert',
    channel: 'whatsapp',
    title: 'Vanaf de vloer: het werk loopt vast',
    senderName: 'Teamleider',
    urgency: 'high',
    content: `Even kort: ${phase.impact}. Mensen bij ${clientName} vragen mij wat ze tegen bellende afnemers moeten zeggen. Ik heb nu geen antwoord voor ze.`,
  }),
  ({ phase }) => ({
    type: 'media',
    channel: 'news',
    title: 'Van buiten: er worden vragen gesteld',
    senderName: 'Redactie',
    urgency: 'medium',
    content: `${capitalize(phase.external)}. De vraag ligt er en gaat niet weg door te zwijgen.`,
  }),
  ({ phase, clientName }) => ({
    type: 'regulatory',
    channel: 'email',
    title: 'Juridisch: dit moet vastgelegd worden',
    senderName: 'Huisjurist',
    urgency: 'high',
    content: `Beste collega's, ${phase.legal}. Ik leg nu een dossier aan voor ${clientName} en heb van jullie de tijdstippen nodig waarop iets bekend werd.`,
  }),
  ({ phase, itArrangement }) => ({
    type: 'intel',
    channel: 'phone',
    title: 'Beheerpartij aan de lijn',
    senderName: 'Beheerpartij',
    urgency: 'medium',
    content: `Telefonisch doorgegeven: ${phase.supplier}. De inrichting is ${itArrangement || 'deels bij een externe partij belegd'}, dus elke stap loopt via hen.`,
  }),
]

// De meldplicht-inject. rule9 eist minstens één inject met
// triggersRegulatoryNotification én een verwijzing naar de toezichthouder.
const REGULATORY_PARAGRAAF =
  'Nog iets, en ik weet niet of dit bij mij hoort: valt dit onder de meldplicht? Onder de AVG geldt een termijn van 72 uur naar de Autoriteit Persoonsgegevens, onder NIS2 een vroege waarschuwing binnen 24 uur aan het CSIRT/NCSC. De klok begint bij het eerste signaal, niet bij de bevestiging.'

// Invalshoeken met een menselijke afzender, op voorkeur: juridisch, pers,
// werkvloer, beheerpartij, crisiscoordinator. Index 1 (monitoring) ontbreekt
// bewust — een systeemmelding heeft geen stem.
const HUMAN_VOICE_ORDER: readonly number[] = [4, 3, 2, 5, 0]

// ───────────────────────────────────────────────────────────────────────────
// Opbouw
// ───────────────────────────────────────────────────────────────────────────

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1)
}

// Rollen in de vaste weergave-orde, zonder dubbelingen. Zo levert dezelfde
// selectie altijd dezelfde graph, ook als de gebruiker ze in een andere
// volgorde aanvinkt.
function normalizeRoles(roles: readonly Role[]): Role[] {
  const wanted = new Set(roles)
  const ordered = ROLE_ORDER.filter(r => wanted.has(r))
  return ordered.length > 0 ? [...ordered] : ['ceo', 'ciso', 'legal']
}

// Fases gelijkmatig over het aantal rondes verdelen. De eerste ronde is altijd
// de detectiefase. De nazorgfase doet alleen mee vanaf zeven rondes: bij een
// korte oefening eindigt het scenario liever op herstel, omdat de rolkeuzes
// dan nog over de crisis zelf gaan.
function pickPhases(rounds: number): PhaseSpec[] {
  if (rounds <= 1) return [PHASES[0]]
  const last = rounds >= 7 ? PHASES.length - 1 : PHASES.length - 2
  return Array.from({ length: rounds }, (_, index) => {
    const position = Math.round((index * last) / (rounds - 1))
    return PHASES[Math.min(position, last)]
  })
}

// Welke handelingsrichtingen een rol in een ronde krijgt. De scherpste keuze
// (index 0) en de valkuil (index 5) staan er altijd bij; het middenveld
// roteert per ronde, zodat een rol niet vier rondes lang dezelfde lijst ziet.
function actionIndices(optionCount: number, roundIndex: number): number[] {
  const total = ROLE_ACTION_COUNT
  if (optionCount <= 1) return [0]
  if (optionCount >= total) return Array.from({ length: total }, (_, i) => i)
  const middle = [1, 2, 3, 4]
  const rotated = middle.map((_, i) => middle[(i + roundIndex) % middle.length])
  return [0, ...rotated.slice(0, optionCount - 2), total - 1]
}

// Verdeelt `feit` en `aanname` over alle injects zodat het aandeel feiten zo
// dicht mogelijk bij config.factsNoiseRatio ligt (rule7, marge ±0.15).
function classificationAt(globalIndex: number, ratio: number): 'feit' | 'aanname' {
  const before = Math.round(globalIndex * ratio)
  const after = Math.round((globalIndex + 1) * ratio)
  return after > before ? 'feit' : 'aanname'
}

export interface BuildDraftOptions {
  /** Tijdstempel voor createdAt/updatedAt. Laat weg voor een reproduceerbare graph. */
  now?: number
}

// Vaste tijdstempel zodat twee aanroepen met dezelfde config byte-identiek
// zijn. De route geeft een echte tijd mee.
const FIXED_TIMESTAMP = 0

export function buildDraftGraph(config: WizardConfig, options: BuildDraftOptions = {}): ScenarioGraph {
  const roles = normalizeRoles(config.rolesIncluded)
  const roundCount = Math.max(1, Math.floor(config.rounds))
  const injectsPerRound = Math.max(1, Math.floor(config.injectsPerRound))
  const optionsPerRole = Math.max(1, Math.min(ROLE_ACTION_COUNT, Math.floor(config.optionsPerRolePerRound)))
  const phases = pickPhases(roundCount)
  const clientName = config.clientName.trim() || 'de klant'
  const itArrangement = config.itArrangement.trim()
  const seed = config.seed?.trim() || defaultSeed(config, roles)

  // Welke ronde de meldplicht opent: een middenronde, zodat er daarvoor al
  // beeld is opgebouwd en erna nog tijd is om te handelen.
  const regulatoryRound = Math.floor((roundCount - 1) / 2)

  // Welke ronde(s) elke bijzondere omstandigheid moet dragen (rule8).
  const conditionsByRound = new Map<number, string[]>()
  config.specialConditions.forEach((id, conditionIndex) => {
    const condition = specialConditionById(id)
    if (!condition) return
    for (let k = 0; k < Math.max(1, condition.roundsRequired); k++) {
      const round = (conditionIndex + k) % roundCount
      conditionsByRound.set(round, [...(conditionsByRound.get(round) ?? []), condition.narrativePrompt])
    }
  })

  const decisionAuthorIds = phases.map((phase, index) => `dec-${index + 1}-${phase.key}`)

  let injectCounter = 0
  const rounds: WizardPlanRound[] = phases.map((phase, index) => {
    const roundNumber = index + 1
    const ctx: InjectContext = {
      phase,
      roundNumber,
      clientName,
      itArrangement,
      decisionAuthorId: decisionAuthorIds[index],
    }

    const injects: WizardPlanInject[] = Array.from({ length: injectsPerRound }, (_, slot) => {
      const angle = INJECT_ANGLES[slot % INJECT_ANGLES.length]
      const base = angle(ctx)
      const repeat = Math.floor(slot / INJECT_ANGLES.length)
      const classification = classificationAt(injectCounter, config.factsNoiseRatio)
      injectCounter += 1
      return {
        ...base,
        id: `r${roundNumber}-i${slot + 1}`,
        title: repeat > 0 ? `${base.title} (vervolg ${repeat})` : base.title,
        classification,
      }
    })

    // Meldplicht en bijzondere omstandigheden hangen we aan een inject met een
    // menselijke stem — een monitoringmelding die over de meldplicht begint
    // klinkt vals. HUMAN_VOICE_ORDER noemt de invalshoeken op voorkeur; de
    // setup-inject (index 0) is de laatste optie en dat werkt ook bij één
    // inject per ronde, want de beslisvraag komt daar later nog achteraan.
    const carrier = injects[HUMAN_VOICE_ORDER.find(i => i < injects.length) ?? injects.length - 1]
    if (index === regulatoryRound) {
      carrier.content = `${carrier.content}\n\n${REGULATORY_PARAGRAAF}`
      carrier.triggersRegulatoryNotification = true
      carrier.nis2Relevant = true
    }
    const extraConditions = conditionsByRound.get(index) ?? []
    if (extraConditions.length > 0) {
      carrier.content = `${carrier.content}\n\nWat hierbij meespeelt: ${extraConditions.join(' ')}`
    }
    // De setup-inject sluit af met de beslisvraag van deze ronde — dat is wat
    // hem tot aankondiging maakt in plaats van tot mededeling (rule1).
    injects[0].content = `${injects[0].content}\n\n${phase.prompt}`

    const previousEcho = index > 0 ? phases[index - 1].echo : null
    const situation = [
      previousEcho ? `${previousEcho} werkt door in wat er nu op tafel ligt.` : null,
      phase.state,
      phase.pressure,
      phase.closing,
    ].filter(Boolean).join(' ')

    return {
      title: `Ronde ${roundNumber} — ${phase.title}`,
      situation,
      timerMinutes: 15,
      injects,
      decisionAuthorId: decisionAuthorIds[index],
      discussionGoal: phase.goal,
      keyQuestions: [...phase.opening],
      hints: ['Concept-ronde: scherp de teksten aan met wat je van deze klant weet.'],
      expectedDecisions: [phase.prompt],
      redFlags: ['Een aanname die als feit de volgende ronde in gaat.'],
      openingPrompts: [...phase.opening],
      reviewPrompts: [...phase.review],
      facilitatorPerspective: `Concept: deze ronde draait om ${phase.focus}. Als IR-begeleider let je hier vooral op het tempo en op wie de keuze pakt.`,
    }
  })

  const decisions: WizardPlanDecision[] = phases.map((phase, index) => ({
    afterRoundIndex: index,
    authorId: decisionAuthorIds[index],
    prompt: phase.prompt,
    perRole: true,
    options: [
      ...roles.flatMap((role, roleIndex) =>
        actionIndices(optionsPerRole, index).map((actionIndex, slot) => {
          const stance = STANCES[actionIndex]
          // De as-rotatie hangt aan de plek in de lijst, niet aan de kwaliteit:
          // dat houdt de assen binnen één rol uniek en maakt dominantie
          // onmogelijk (rule3).
          const offset = (roleIndex + index + slot) % 6
          return {
            label: `${ROLE_ACTIONS[role][actionIndex]} — ${phase.focus}`,
            allowedRole: role,
            outcomeVector: outcomeVectorFor(actionIndex, offset),
            qualityRank: stance.quality,
            facilitatorCommentary: `${stance.commentary} Concept-tekst: vul aan met wat dit bij ${clientName} betekent.`,
            lessonLearned: stance.lesson,
          }
        }),
      ),
      {
        // Deel B §7.1 — de impliciete "geen besluit"-optie. Zonder allowedRole,
        // zodat hij voor elke rol zichtbaar is en niet meetelt in het
        // optie-aantal per rol (rule2). De lessonLearned opent met de echo van
        // deze fase; de volgende ronde grijpt daarop terug (rule5).
        label: 'Geen besluit binnen de tijd',
        implicit: true,
        outcomeVector: { CONT: -1, FOR: -1, BC: -1, JUR: -1, VER: -1, KOS: 0 },
        lessonLearned: `${phase.echo} bleef liggen. Niet kiezen is ook een keuze, en de rekening komt een ronde later.`,
      },
    ],
  }))

  const plan: WizardPlan = {
    name: `${clientName} — concept (${roundCount} rondes)`,
    scenarioType: 'ransomware_double_extortion',
    rounds,
    decisions,
    outcomes: [
      {
        key: 'beheerst',
        label: 'Beheerst verloop',
        narrative: `Het team bij ${clientName} koos vroeg, legde vast wat het wist en hield de buitenwereld bij. De schade bleef binnen de verwachting.`,
        lessonLearned: 'Vroeg kiezen met een half beeld levert meer op dan laat kiezen met een compleet beeld.',
        scoreRange: { min: roundCount },
      },
      {
        key: 'rommelig',
        label: 'Rommelig maar overleefd',
        narrative: `Bij ${clientName} werd uiteindelijk alles gedaan wat nodig was, maar steeds een slag te laat en zonder vaste hand.`,
        lessonLearned: 'Een crisis zonder duidelijke eigenaar kost tijd op elk besluit.',
        scoreRange: { min: -roundCount, max: roundCount - 1 },
      },
      {
        key: 'ontspoord',
        label: 'Ontspoord',
        narrative: `Bij ${clientName} bleef het team wachten op zekerheid. De buitenwereld bepaalde het verhaal en de kosten liepen op.`,
        lessonLearned: 'Wachten op zekerheid is in een crisis zelf een besluit, met een prijs.',
        scoreRange: { max: -roundCount - 1 },
      },
    ],
    irPlaybook: buildPlaybook(clientName, itArrangement),
    roleBriefings: buildRoleBriefings(roles, clientName, config),
  }

  const graph = planToGraph(plan, {
    seed,
    now: options.now ?? FIXED_TIMESTAMP,
    publishStatus: 'draft',
  })

  return withDynamicTokens({
    ...graph,
    expectedOptionsPerRole: optionsPerRole,
  })
}

// Zonder eigen seed leiden we er één af uit de config, zodat de graph
// reproduceerbaar blijft zonder willekeur.
function defaultSeed(config: WizardConfig, roles: readonly Role[]): string {
  return [
    'concept',
    config.clientName.trim().toLowerCase(),
    config.rounds,
    config.injectsPerRound,
    config.optionsPerRolePerRound,
    roles.join('+'),
  ].join(':')
}

function buildPlaybook(clientName: string, itArrangement: string): string {
  return [
    `Crisisdraaiboek ${clientName} (versie van vorig jaar, nooit geoefend).`,
    '',
    '1. Melding komt binnen bij de servicedesk en gaat naar de IT-manager.',
    '2. De IT-manager bepaalt of er een crisisteam bijeen komt.',
    '3. Het crisisteam bestaat uit directie, IT, communicatie en juridische zaken.',
    `4. ${itArrangement || 'Het beheer van de omgeving is deels bij een externe partij belegd'}; die partij levert ondersteuning volgens de geldende afspraak.`,
    `5. Voor forensisch onderzoek en coördinatie is ${EYE_SECURITY_RETAINER.name} beschikbaar via ${EYE_SECURITY_RETAINER.activationNumber}; activeren gaat niet automatisch.`,
    '6. Communicatie naar buiten loopt altijd via de directie.',
    '',
    'Let op: dit draaiboek bevat bewust zowel harde afspraken als aannames die nooit zijn getoetst. Wie erop handelt zonder te verifiëren, komt bedrogen uit.',
  ].join('\n')
}

// Eén rol krijgt de verborgen zwakte in zijn briefing (rule11). We kiezen de
// rol die het meest geraakt wordt en die ook echt meedoet.
function weakestRole(roles: readonly Role[]): Role {
  return roles.find(r => r === 'ciso') ?? roles.find(r => r === 'it_manager') ?? roles[0]
}

function buildRoleBriefings(
  roles: readonly Role[],
  clientName: string,
  config: WizardConfig,
): Partial<Record<Role, RoleBriefing>> {
  const gapRole = weakestRole(roles)
  const briefings: Partial<Record<Role, RoleBriefing>> = {}
  for (const role of roles) {
    const meta = ROLE_META[role]
    const text = [
      `U bent ${meta.label} bij ${clientName}${config.sector.trim() ? ` (${config.sector.trim()})` : ''}.`,
      meta.mandateSummary,
      'Dit is een concept-briefing: vul aan wat deze rol bij deze klant werkelijk mag beslissen.',
    ].join(' ')
    briefings[role] = role === gapRole
      ? {
          text,
          playbookGaps: [
            'Het mandaat om een systeem plat te leggen is nergens vastgelegd',
            'De reservekopie is nooit volledig teruggezet in een test',
            'Het draaiboek bestaat, maar is nooit geoefend',
          ],
        }
      : { text }
  }
  return briefings
}

// Zet dynamic-fill aan op elk knooppunt dat een {{token}} bevat, zodat de
// sessie-config die velden daadwerkelijk invult (lib/graph/dynamic-fill.ts).
function withDynamicTokens(graph: ScenarioGraph): ScenarioGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      if (node.type !== 'inject' && node.type !== 'round') return node
      const texts: Array<string | undefined> = node.type === 'inject'
        ? [(node.data as InjectNodeData).title, (node.data as InjectNodeData).content]
        : [
            (node.data as RoundNodeData).title,
            (node.data as RoundNodeData).situation_update,
            ...((node.data as RoundNodeData).openingPrompts ?? []),
          ]
      const fillFrom: DynamicFillToken[] = DYNAMIC_FILL_TOKENS.filter(token =>
        texts.some(text => text?.includes(`{{${token}}}`)),
      )
      if (fillFrom.length === 0) return node
      return { ...node, data: { ...node.data, dynamic: { enabled: true, fillFrom } } }
    }),
  }
}
