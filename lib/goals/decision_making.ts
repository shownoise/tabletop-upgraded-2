import type { GoalPlugin } from "./types"

export const decisionMakingGoal: GoalPlugin = {
  id: 'decision_making',
  name: 'Besluiten onder druk',
  description: 'Leer je team heldere besluiten nemen binnen het eigen mandaat, onder crisisdruk. De nadruk ligt op het moment van escaleren, wie waarover gaat, en vasthouden aan één werkwijze.',
  status: 'active',
  capabilities: [
    'governance_decisions',
    'crisis_communication',
    'legal_compliance',
  ],
  defaultScenarioTypes: [
    'ransomware_double_extortion',
    'insider_threat',
    'bec_cfo_fraud',
    'supply_chain_compromise',
  ],
  facilitatorGuide: `## Facilitatorhandleiding — Besluiten onder druk

**De kern van de oefening — zo loopt elke ronde:**
- Je opent de ronde met een korte algemene situatieschets; die verklapt bewust niet wat de injects brengen
- De injects komen binnen bij de rollen voor wie ze bedoeld zijn
- Het team overlegt: wat is er aan de hand, en wie gaat hierover
- Elke gemandateerde rol legt één keuze vast, binnen de eigen bevoegdheid
- Je opent de review en bespreekt per keuze de beweging op de zes dimensies
- Daarna de volgende ronde; na de laatste ronde volgt de gedeelde eindbespreking

**De zes dimensies waarop elke keuze scoort:**
- **Containment** — hoe snel de aanvaller geen nieuwe schade meer kan maken
- **Forensische positie** — of je straks nog kunt aantonen wat er is gebeurd
- **Bedrijfscontinuïteit** — of het primaire proces blijft lopen
- **Juridisch & meldplicht** — of de wettelijke en contractuele klokken worden gehaald
- **Verantwoording & communicatie** — of je dit besluit later kunt uitleggen
- **Kosten & schade** — wat de keuze kost, nu en later
- Geen enkele optie scoort op alle zes goed. Welke as het team bewust laat liggen, is het eigenlijke gesprek

**Waar je op let:**
- Wordt het besluit genomen door wie het hoort te nemen?
- Escaleert het team op het juiste moment, of wacht het te lang?
- Zegt iemand hardop wat hij níet mag besluiten, of schuift het mandaat stilzwijgend op?
- Blijft er één as structureel liggen, ronde na ronde?

**Vóór de sessie:**
- Laat deelnemers hun rol kiezen in de lobby; je ziet daar wie nog geen rol heeft en wie klaar is
- Print of open de rolkaarten via /admin/role-cards om bevoegdheden door te nemen
- Lees per ronde de beslisvraag door, zodat je weet waar je het gesprek naartoe stuurt

**Onbezette rollen:**
- Een rol die niemand heeft geclaimd en die ook niemand erbij speelt, is onbezet
- Niemand dekt die rol; zijn keuze wordt afgesloten als "geen besluit", met de reden erbij
- De ronde blokkeert daar niet op — je wacht niet op iemand die er niet is
- Het rolbezettingsoverzicht laat zien welke rollen bezet, overgenomen of onbezet zijn
- Benoem een onbezette rol wel in de nabespreking: in een echte crisis is dat een gat, niet een instelling

**Tijdens de sessie:**
- Besluitverlamming: het team praat zonder dat iemand de keuze pakt
- Te vroeg escaleren: de bestuurder of de toezichthouder erbij halen voordat er iets te besluiten valt
- Komt een bezette rol niet tot een keuze, sluit de beslissing dan af — die rol krijgt dan ook "geen besluit" en de ronde kan door
- Nodig een extra prikkel? Zet een losse inject of een special in vanuit het gereedschap
- Terug kan ook: je kunt een fase terugzetten

**Afsluiten:**
- Beëindig de oefening; deelnemers krijgen hun eindscherm met scores en de sessie blijft bewaard
- De sessie verwijderen gooit alles weg — keuzes, scores en de terugblik. Doe dat pas na de nabespreking

**Voor de nabespreking:**
- Het paneel **Terugblik deelnemers** toont per ronde wat deelnemers zelf opschreven over wat werkte, wat niet, en welk hiaat ze zagen
- Loop per ronde de keuzes langs met de zes dimensies ernaast, en vraag waarom die ruil toen acceptabel leek
- Heeft de auteur injects als feit of aanname gemarkeerd, dan vind je die vergelijking in het gereedschap. Dat is een extra, niet de kern van deze oefening
- Vraag door op: welke besluiten waren helder en welke betwist, waar schuurde de mandaatgrens, en wat verandert er hierdoor in jullie crisisplan?`,
  // Plain lines, no markdown: the intro overlay renders this split on newlines,
  // so any ## or ** would show up literally on a participant's screen.
  participantBriefing: `Jullie team krijgt een realistisch cyberincident voor de kiezen. Het doel is niet om technisch het juiste te doen — het is om onder tijdsdruk, met onvolledige informatie, heldere en verdedigbare keuzes te maken.

Wat je oefent: wie mag welk besluit nemen, hoe je tot een besluit komt als je het oneens bent, en wanneer escaleren aan de orde is.

Hoe een ronde verloopt: je leest eerst kort waar jullie staan. Daarna komen de injects binnen bij de rollen voor wie ze bedoeld zijn. Jullie overleggen, en dan legt elke rol met mandaat één keuze vast. Bij de review zien jullie wat die keuze deed. Dan volgt de volgende ronde, en aan het eind kijken jullie samen terug.

Elke keuze beweegt zes dimensies: containment, forensische positie, bedrijfscontinuïteit, juridisch en meldplicht, verantwoording en communicatie, en kosten en schade. Geen enkele optie wint op alle zes. Welke as jullie bewust laten liggen, is de eigenlijke keuze.

Wat je zelf doet tijdens de oefening:
Lees eerst je mandaat — op je scherm staat wat jouw rol wél mag besluiten en wat uitdrukkelijk niet jouw verantwoordelijkheid is. Die grens is de helft van de oefening.
Open je documenten. Daar staat wat jouw rol bij de hand heeft: polis, protocol, draaiboek. Ook wat erin ontbreekt, want dat is in een echte crisis net zo bepalend.
Je ziet niet alles wat je collega's zien. Komt een inject bij jou binnen, dan moet jij hem inbrengen — anders beslist het team op een half beeld.
Zeg het hardop als een besluit niet bij jou hoort. Doorschuiven naar de juiste rol is een goede zet, geen zwakte.

Er is geen enkel juist antwoord. Hoe jullie tot een besluit komen weegt zwaarder dan de uitkomst.`,
}
