import type { GoalPlugin } from "./types"

export const decisionMakingGoal: GoalPlugin = {
  id: 'decision_making',
  name: 'Decision-Making Under Pressure',
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

**Waar je op let:**
- Worden besluiten genomen door wie ze hoort te nemen?
- Escaleert het team op het juiste moment, of wacht het te lang?
- Houdt het team één werkwijze vast, of springt het heen en weer?

**Vóór de sessie:**
- Laat deelnemers hun rol kiezen in de lobby; je ziet daar wie nog geen rol heeft en wie klaar is
- Print of open de rolkaarten via /admin/role-cards om bevoegdheden door te nemen
- Loop de BOB-fasen door, zodat je weet wanneer je een fase afsluit

**Tijdens de sessie:**
- Je schuift zelf per fase door met de knop rechtsboven: inject → overleg → keuze → review
- Besluitverlamming: het team praat zonder dat iemand de keuze pakt
- Te vroeg escaleren: de CEO of board erbij halen voordat de feiten staan
- Komt een rol niet tot een keuze, gebruik dan **Beslissing afsluiten** — onbeantwoorde rollen krijgen een impliciete "geen besluit", en de ronde kan door
- Nodig een extra prikkel? Zet een noise-inject in vanuit het paneel in de zijbalk
- Terug kan ook: **Vorige fase** en **Vorige ronde**

**Afsluiten:**
- **Beëindig oefening** zet de sessie op afgerond; deelnemers krijgen hun eindscherm met scores en de sessie blijft bewaard
- **Sessie verwijderen** gooit alles weg — keuzes, scores en de terugblik. Gebruik dat pas na het debrief

**Voor het debrief:**
- Het paneel **Terugblik deelnemers** toont per ronde wat deelnemers zelf opschreven over wat werkte, wat niet, en welk hiaat ze zagen
- Het factcheck-paneel toont per ronde wie feit en aanname goed inschatte
- Vraag door op: welke besluiten waren helder en welke betwist, waar schuurde de mandaatgrens, en wat verandert er hierdoor in jullie crisisplan?`,
  // Plain lines, no markdown: the intro overlay renders this split on newlines,
  // so any ## or ** would show up literally on a participant's screen.
  participantBriefing: `Jullie team krijgt een realistisch cyberincident voor de kiezen. Het doel is niet om technisch het juiste te doen — het is om onder tijdsdruk, met onvolledige informatie, heldere en verdedigbare keuzes te maken.

Wat je oefent: wie mag welk besluit nemen, hoe je tot een besluit komt als je het oneens bent, en wanneer escaleren aan de orde is.

Wat je zelf doet tijdens de oefening:
Lees eerst je bevoegdheden — rechts op je scherm staat wat jouw rol wél mag besluiten en wat uitdrukkelijk niet jouw verantwoordelijkheid is. Die grens is de helft van de oefening.
Open je documenten. Daar staat wat jouw rol bij de hand heeft: polis, protocol, draaiboek. Ook wat erin ontbreekt, want dat is in een echte crisis net zo bepalend.
Weeg per inject of het een feit is of een aanname. Je legt dat zelf vast; bij de terugblik zie je of je het goed had. Een team dat een aanname als feit behandelt, beslist slecht.
Zeg het hardop als een besluit niet bij jou hoort. Doorschuiven naar de juiste rol is een goede zet, geen zwakte.

Er is geen enkel juist antwoord. Hoe jullie tot een besluit komen weegt zwaarder dan de uitkomst.`,
}
