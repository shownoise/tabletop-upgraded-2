# IR-retainer scope — wat wij doen vs wat de klant beslist

De fundamentele constraint die de scenario-generator moet respecteren: wij zijn de Incident Response retainer. Bij een echte aanval doen wij grote delen van het technische werk. De oefening moet dus geen beslissingen genereren die in onze scope vallen, want dan oefenen klanten dingen die ze in werkelijkheid nooit zelf zullen doen.

Dit document is de scope-definitie die als constraint in de AI-prompt moet zitten.

## Wat wij (de retainer) doen bij een echte aanval

**Forensisch en technisch onderzoek:**

- Log preservation en chain-of-custody
- Malware analyse, reverse engineering
- Threat intel, IOC-extractie
- Attribution-analyse
- Dark web monitoring (gelekte data, verkoop, vermelding)
- Timeline reconstructie van de attack chain

**Containment en eradication:**

- EDR-isolatie van endpoints
- Account-disablement, password resets
- Netwerk-segmentatie aanpassingen
- Malware-eradication, persistence-removal
- Vulnerability patching tijdens incident

**Coördinatie:**

- Technische communicatie met NCSC/RDI op operationeel niveau
- IOC-sharing met sector-ISACs
- Coördinatie met andere IR-partijen bij multi-party incidenten
- Technische input voor verzekeraar en advocaat

## Wat de klant beslist

**Governance:**

- CMT samenstelling, voorzitter, mandaat
- Escalatie naar directie, RvC, OR
- Activatie crisisniveaus (geel, oranje, rood)
- Activatie cyberverzekeraar
- Inhuren externe partijen (= waar wij vaak al voor staan)

**Business continuity:**

- Welke processen krijgen prioriteit
- Geaccepteerde uitvaltijd per kritiek proces
- Handmatige workarounds (papier, alternatieve software, dienstverleners overnemen)
- Communicatie naar medewerkers
- Sluiting/openhouden van locaties

**Communicatie:**

- Welke stakeholders eerst (medewerkers, klanten, leveranciers, pers)
- Woordvoering (CEO, CISO, persvoorlichter)
- Boodschap-strategie (victim framing, verantwoordelijkheid, herstel)
- Pers actief informeren vs reactief reageren
- Sociale media management
- Toon en frequentie van updates

**Juridisch en compliance:**

- AVG-meldplicht aan AP (binnen 72u na ontdekking datalek)
- NIS2 early warning aan RDI (24u), incident notification (72u), final report (1 maand)
- Sectorale meldplichten (DNB, AFM, NVWA, etc.)
- Contractuele meldplichten richting klanten
- Aangifte bij politie
- Aansprakelijkheid-vragen, schade-claims

**Strategische besluiten:**

- Wel of niet betalen van ransom
- Wel of niet onderhandelen (en namens wie)
- Wel of niet aangifte doen
- Welke klanten actief informeren over (mogelijk) gelekte data
- Welke aanpassingen aan cyber-crisis-plan na afloop
- Welke investeringen worden aangevraagd

## Grijze zone — beslissingen waar samenwerking is

Sommige beslissingen worden gezamenlijk genomen. Hier zien klanten en wij elkaar:

- Containment-acties met grote operationele impact (bv. hele AD platleggen): wij stellen voor, klant autoriseert
- Communicatie naar toezichthouder over technische details: wij leveren de technische tekst, klant tekent
- Schorsen/ontslaan insider tijdens onderzoek: wij leveren bewijs, HR/Legal beslist
- Forensic preservation versus snelle recovery: wij waarschuwen, klant prioriteert

Deze grijze zone kan **wel** in oefeningen voorkomen, maar dan moet de inject duidelijk maken dat wij naast de klant staan, niet erbuiten.

## Constraint voor de AI-prompt

Voeg deze tekst toe aan de scenario-generator prompt:

```
SCOPE-CONSTRAINT — IR RETAINER

Bij elke decision-prompt die je genereert, check: valt deze beslissing binnen de 
scope van wat wij als IR-retainer al voor de klant doen?

VERBODEN decision-categorieën (deze beslissen wij, niet de klant):
- Welke server isoleren, welke endpoint platleggen, welke processen killen
- Wanneer forensisch onderzoek starten of in welke volgorde
- Hoe malware reverse engineeren
- Welke IOC's delen met ISAC
- Hoe attribution-analyse uitvoeren
- Welke logs preserveren en in welk format
- Welke EDR-policy aanpassen

TOEGESTANE decision-categorieën:
- Governance: CMT, mandaat, escalatie, activatie verzekeraar
- Business continuity: prioritering, uitvaltijd, workarounds, communicatie naar 
  medewerkers
- Communicatie: stakeholder-prio, woordvoering, boodschap, pers
- Juridisch: meldplichten (AP, RDI, sectoraal), aangifte, aansprakelijkheid
- Strategisch: betalen, onderhandelen, klanten informeren, lessons learned

GRIJZE ZONE (mag, maar formuleer als gezamenlijk besluit):
- Containment-acties met grote operationele impact ("ons IR-team stelt voor om X 
  te isoleren wat Y uur downtime kost — autoriseren?")
- Communicatie naar toezichthouder over technische details
- Schorsen/ontslag insider tijdens onderzoek

Frasering voor technische injects: gebruik altijd "Het IR-team van [retainer] meldt:" 
of "Onze SOC heeft het volgende vastgesteld:" — daarna iets wat de klant moet 
INTERPRETEREN en op ACTEREN (BC-impact, communicatie, escalatie), niet zelf moet 
ONDERZOEKEN.
```

## Validatie

Voeg een validator toe die elke gegenereerde decision-prompt classificeert:

```typescript
type DecisionScope = 'client' | 'shared' | 'retainer' | 'invalid'

function classifyDecision(prompt: string): DecisionScope {
  // 'retainer': bevat termen als "isoleren", "forensisch onderzoek starten",
  //             "malware analyseren" — moet weggefilterd worden
  // 'shared':   bevat "samen met ons IR-team", "autoriseren", "wij stellen voor"
  // 'client':   gaat over governance, BC, comms, legal, strategie
  // 'invalid':  onduidelijke scope — markeer voor handmatige review
}
```

Decisions met scope `retainer` worden weggefilterd of geherformuleerd voor ze in de output komen.
