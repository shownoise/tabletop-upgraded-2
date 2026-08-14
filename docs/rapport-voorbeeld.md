# Rapport tabletop-oefening — GGZ De Waterhof

**Datum sessie**: 12 maart 2026
**Duur**: 3 uur 15 minuten (inclusief BOB en nabespreking)
**Scenario**: ransomware-inschakeling met EPD-verlies
**Facilitator**: [naam]
**Klant**: GGZ De Waterhof (fictief — zie `docs/kwaliteit/testklanten.md`)

> Dit is een **voorbeeldrapport** met verzonnen uitkomsten. Bedoeld als
> ontwerpblauwdruk voor de daadwerkelijke rapportage-feature.
> **Onderdelen gemarkeerd met 🟡** vereisen data die de app op dit
> moment niet vastlegt — die staan onderaan.

---

## Samenvatting in één alinea

Het crisisteam van De Waterhof heeft de eerste 6 uur van een ransomware-
inschakeling doorlopen waarbij het EPD (User) en de roosterplanning onbereikbaar
werden. Het team scoorde bovengemiddeld op juridische zorgvuldigheid (meldplicht
werd op tijd geopend richting AP en CSIRT) en op stakeholderbeheer (transparante
communicatie naar cliënten en behandelaars). Zwak was de bedrijfscontinuïteit:
er bleek geen alternatief proces voor de crisisdienst-inplanning, en het team
verloor circa 90 minuten aan discussie voor het EPD-alternatief in gang werd
gezet. Kritiekste blind spot: de aanname dat de back-up-set 'schoon' was, is als
feit behandeld en heeft de herstelbeslissing gestuurd. Toen die aanname later
sneuvelde, moest de hele herstelplanning opnieuw.

**Totaalscore**: 62 / 100 (over de zes dimensies gemiddeld gewogen). Zie sectie
"Zes dimensies" voor de uitsplitsing.

---

## Team en rolverdeling

Deelnemers uit De Waterhof, allen aanwezig:

| Rol | Naam | Positie in de organisatie |
|---|---|---|
| CEO | 🟡 [naam] | Bestuurder |
| CISO | 🟡 [naam] | Security-adviseur (0,4 fte) |
| CFO | 🟡 [naam] | Financieel directeur |
| Legal | 🟡 [naam] | Bestuurssecretaris + FG |
| Hoofd Comms | 🟡 [naam] | Communicatiemanager |
| HR-manager | 🟡 [naam] | Directeur HR |
| Operationeel manager | 🟡 [naam] | Zorgmanager |
| IT-manager | 🟡 [naam] | Manager IT & informatievoorziening |

🟡 Deelnemer-namen worden nu niet in het rapport-object opgeslagen — alleen de
`participantId` en `role`. Zie "Wat de app niet vastlegt" onderaan.

---

## Scenario in vier zinnen

Op dinsdagochtend 07:15 meldt een behandelaar dat het EPD "traag" is en niet
alle cliëntdossiers wil laden. Om 08:12 detecteert de externe MSP versleutelde
bestanden in het EPD-cluster en zet het team in een crisisvergadering.
Roosterplanning valt binnen 20 minuten uit; behandelaars kunnen crisisdienst-
diensten niet meer plannen. Het team krijgt binnen 6 uur simulatie-tijd vier
beslismomenten voorgeschoteld, tegen een tikkende AVG 72-uur klok en een NIS2
24-uur klok naar het CSIRT.

Gebruikte special conditions: `single_knowledge_holder` (de EPD-beheerder is
op vakantie in Portugal en pas via een tweede lijn bereikbaar).

---

## Ronde 1 — Detectie en eerste containment

**Situatie (0:00–1:15)**: De MSP heeft de infectie bevestigd. De omvang is nog
onduidelijk — het is nog niet zeker of het alleen het EPD-cluster is of ook de
identity-provider. De IR-partner (Eye Security) is nog niet geactiveerd.

**Beslissing die voorlag**: containment-strategie kiezen. Vier opties per
relevante rol.

### Wat is er gekozen

- **CISO** koos: *"Isoleer het EPD-cluster van het netwerk, breek de VPN naar
  de leverancier af, activeer Eye Security-retainer voor forensics."*
- **IT-manager** koos: *"Draai alle sessions dood en dwing password-reset af
  op alle admin-accounts."*
- **CEO** koos: *"Roep intern crisis-noodsituatie uit, informeer bestuur direct."*
- **Ops manager** koos: *"Zet cliëntdossiers over op paperbased-noodproces voor
  de crisisdienst."*

### Alternatieven en hun scoring

| Rol | Optie gekozen | CONT | FOR | BC | JUR | VER | KOS |
|---|---|---|---|---|---|---|---|
| CISO | Isoleer + retainer aan | **+2** | **−1** | 0 | +1 | +1 | −1 |
| CISO — alternatief | Log en observeer 30 min | 0 | +2 | 0 | −1 | −1 | 0 |
| CISO — alternatief | Alleen retainer, geen isolatie | −1 | +1 | +1 | 0 | 0 | 0 |
| CISO — alternatief | Volledige shutdown netwerk | +2 | 0 | **−2** | 0 | −1 | −1 |
| IT | Dood sessies + admin-reset | +1 | 0 | −1 | 0 | 0 | 0 |
| IT — alternatief | Alleen sessies dood | 0 | +1 | 0 | 0 | 0 | 0 |
| Ops | Paperbased noodproces | 0 | 0 | **+2** | 0 | +1 | −1 |
| Ops — alternatief | Wachten op EPD-herstel | 0 | 0 | −2 | 0 | −2 | 0 |

**Waarom deze scores** — de kernafweging in ronde 1:

- **Isolatie is goed voor containment** (verhindert lateraal), **kost
  forensics** (verbindingen weg = verloren procesactiviteit die de aanvaller
  had kunnen tonen).
- **Paperbased noodproces** kost tijd (opzetten) maar redt continuïteit voor
  de crisisdienst — de meest tijdkritische zorgtaak.

**Team-totaal ronde 1**: CONT **+3**, FOR **−1**, BC **+1**, JUR **+1**, VER **+1**, KOS **−2**.

### Stuurvragen die op tafel lagen

1. Wat kies je eerst: containment of forensics? Wat verliezen we door de ander uit te stellen?
2. Wat is jullie minimaal geaccepteerde crisisdienst-uitvoering — hoe lang mogen we zonder EPD?
3. Wie beslist er over het activeren van de retainer, en wie krijgt daarvan een seintje?

🟡 De discussie zelf wordt nu niet opgeslagen — alleen de finale keuzes per rol.
Wat er in de discussie is gezegd (waardevol voor het rapport!) staat niet in
het datamodel.

---

## Ronde 2 — Meldplichten en interne communicatie

**Situatie (1:15–2:30)**: De AVG 72-uur klok tikt sinds 08:12. Er is geen
zekerheid over data-exfiltratie, wél over versleuteling. Het CSIRT-loket
(NIS2, 24 uur) wordt ook actief. De MSP meldt "back-ups lijken schoon" —
dit blijkt later een aanname te zijn.

**Beslissing die voorlag**: welke meldingen doen en welke communicatie starten.

### Wat is er gekozen

- **Legal**: *"Initiële melding aan AP binnen 2 uur, initiële melding aan CSIRT
  binnen 4 uur, houd IGJ standby maar wacht op behandelverstoring-bevestiging."*
- **Hoofd Comms**: *"Interne mededeling naar alle medewerkers via WhatsApp
  crisiskanaal binnen 30 minuten. Externe communicatie later, alleen als
  behandeling écht stilstaat."*
- **HR-manager**: *"Crisis-opvangkamer voor de nachtdienst-behandelaars die
  om 07:30 met een lege agenda kwamen. Woordvoerder aanwezig."*
- **CEO**: *"Ondertekening initiële AP-melding, delegatie externe woordvoering
  aan Hoofd Comms."*

### Alternatieven en hun scoring

| Rol | Optie gekozen | CONT | FOR | BC | JUR | VER | KOS |
|---|---|---|---|---|---|---|---|
| Legal | Vroege AP + CSIRT, IGJ standby | 0 | 0 | 0 | **+2** | +1 | 0 |
| Legal — alternatief | Wachten op omvang-zekerheid, dan melden | 0 | 0 | 0 | **−2** | 0 | 0 |
| Legal — alternatief | Alleen AP, geen NIS2 (niet bewust) | 0 | 0 | 0 | −2 | 0 | 0 |
| Comms | Intern eerst, extern later | 0 | 0 | 0 | 0 | **+2** | 0 |
| Comms — alternatief | Persverklaring proactief | 0 | 0 | 0 | 0 | 0 | −1 |
| Comms — alternatief | Alles stilhouden tot herstel | 0 | 0 | 0 | −1 | **−2** | 0 |
| HR | Crisis-opvang + woordvoerder | 0 | 0 | 0 | 0 | +1 | 0 |
| HR — alternatief | Medewerkers naar huis | 0 | 0 | −1 | 0 | 0 | 0 |

**Waarom deze scores** — de kernafweging in ronde 2:

- **Vroeg melden is juridisch veilig** (JUR +2) maar wettelijk verplicht — er
  is geen "goed nieuws"-scenario door te wachten.
- **Interne communicatie eerst, extern later** is een gebalanceerde
  stakeholder-strategie. Persoonlijke communicatie naar behandelaars redt
  vertrouwen (VER +2).

**Team-totaal ronde 2**: CONT **0**, FOR **0**, BC **0**, JUR **+2**, VER **+4**, KOS **−1**.

### Stuurvragen

1. Wat is jullie criterium voor "AVG datalek — melden" versus "cyberincident
   zonder persoonsgegevens — niet melden onder AVG"?
2. Wanneer schakel je de IGJ in? Wat is het criterium voor "behandeling verstoord"?
3. Wat vertel je de crisisdienst-behandelaars die net begonnen zijn?

---

## Ronde 3 — Herstel en de losgeld-vraag

**Situatie (2:30–4:00)**: De ransomware-groep heeft een decryptie-tool
aangeboden voor 1,8 bitcoin (~€90k). Eye Security heeft na 2 uur forensics een
rapport: het is een Play-variant, back-ups blijken achteraf ook aangetast (het
"back-ups lijken schoon" van de MSP eerder was voorbarig — de MSP had alleen
gekeken naar de mount-status, niet naar de bestandsinhoud).

**Beslissing die voorlag**: hoe herstellen we en betalen we?

### Wat is er gekozen

- **CEO**: *"Niet betalen. Herstel uit oudere back-up-set (28 dagen terug) én
  parallel de patiënt-noodadministratie doorlopen."*
- **CFO**: *"Cyberverzekering activeren, geen betaling zonder juridisch
  advies over sanction-lists."*
- **CISO**: *"Herstel op geïsoleerde omgeving eerst, hardening ronde voor
  terug-migratie, extra logging aan."*
- **Ops manager**: *"EPD-alternatief 'read-only cache van gisteren' opzetten
  voor niet-crisisdienst behandelaars, zodat zij verder kunnen zonder
  volledige EPD-toegang."*

### Alternatieven en hun scoring

| Rol | Optie gekozen | CONT | FOR | BC | JUR | VER | KOS |
|---|---|---|---|---|---|---|---|
| CEO | Niet betalen, oude back-up + noodadm | 0 | +1 | +1 | +1 | +1 | **−1** |
| CEO — alternatief | Betalen om snel te herstellen | 0 | −2 | +1 | −2 | −2 | −2 |
| CEO — alternatief | Wachten op forensics vóór besluit | 0 | +1 | −2 | 0 | 0 | −1 |
| CFO | Verzekering activeren, geen betaling | 0 | 0 | 0 | +1 | 0 | +1 |
| Ops | Read-only cache voor niet-crisisdienst | 0 | 0 | **+2** | 0 | +1 | 0 |
| Ops — alternatief | Alles offline houden | 0 | 0 | −2 | 0 | −1 | −1 |

**Kernafweging** — een klassieke driehoek:
- **Betalen** koopt tijd (BC +1) maar kost forensische bewijskracht (attack
  chain wordt niet gereconstrueerd → FOR −2), juridische risico's
  (sanction-lists → JUR −2) en reputatie bij verzekeraar en toezichthouder
  (VER −2).
- **Wachten op forensics** klinkt veilig maar de zorgcontinuïteit lijdt
  (BC −2).
- **Read-only cache** was de creatieve keuze: geeft ~80% van de behandelaars
  volledige productiviteit terug voor bijna geen kostenimpact.

**Team-totaal ronde 3**: CONT **0**, FOR **+1**, BC **+4**, JUR **+2**, VER **+2**, KOS **−1**.

### Stuurvragen

1. Waarop baseren jullie de aanname dat de oude back-up-set schoon is?
2. Als de verzekeraar zegt "wij dekken de losgeldbetaling wel", verandert dat
   jullie oordeel?
3. Welke behandelaars krijgen als eerste hun toegang terug? Waar liggen de
   criteria?

---

## Ronde 4 — Nasleep, communicatie en lessons

**Situatie (4:00–6:00)**: Het EPD draait weer, zij het op een oudere versie.
De IGJ heeft na 5 uur bevestigd te willen worden ingelicht. Een journalist
van een regionale krant belt: er is een verband gelegd met een cliënt die
op sociale media melding heeft gemaakt dat "de GGZ down is".

**Beslissing die voorlag**: externe communicatie en cliënt-notificaties.

### Wat is er gekozen

- **CEO** + **Hoofd Comms**: *"Persbericht met feitelijke bevestiging,
  benoeming van FG-nummer voor cliënt-vragen, expliciete melding: nog
  onduidelijk of data is uitgelezen."*
- **Legal**: *"Individuele cliënt-notificaties opzetten voor de 400 cliënten
  wiens dossier tussen 03:00 en 08:00 laatst gemodificeerd was — die
  vallen mogelijk in het exfiltratie-venster."*
- **Ops manager**: *"Debriefing met crisisdienst-behandelaars binnen 24 uur,
  logging van welke behandelingen niet konden doorgaan."*

### Scoring

| Rol | Optie gekozen | CONT | FOR | BC | JUR | VER | KOS |
|---|---|---|---|---|---|---|---|
| CEO/Comms | Feitelijk persbericht met onzekerheid | 0 | 0 | 0 | 0 | **+2** | 0 |
| CEO/Comms — alt. | Geen persbericht, individuele contacts | 0 | 0 | 0 | 0 | −1 | 0 |
| CEO/Comms — alt. | Uitgebreide persverklaring met technisch detail | 0 | 0 | 0 | 0 | 0 | 0 |
| Legal | Doelgroep-specifieke cliënt-notificatie | 0 | 0 | 0 | **+2** | +1 | 0 |
| Legal — alt. | Blanket-notificatie alle 4200 cliënten | 0 | 0 | 0 | +1 | −1 | −2 |
| Legal — alt. | Alleen individuele contact bij vraag | 0 | 0 | 0 | −1 | 0 | 0 |

**Kernafweging**: **transparantie versus paniek**. Doelgroep-specifieke
notificatie (400 in plaats van 4200) beperkt onnodige zorg bij mensen die
niet geraakt zijn, en houdt de mededeling geloofwaardig voor wie het wél
betreft.

**Team-totaal ronde 4**: CONT **0**, FOR **0**, BC **0**, JUR **+2**, VER **+3**, KOS **0**.

### Stuurvragen

1. Wat is de communicatiestrategie voor cliënten met wie behandelaars nu
   contact opnemen?
2. Hoe voorkom je dat een journalist het narratief drijft?
3. Wanneer is het incident "gesloten"? Wat zijn jullie afsluitingscriteria?

---

## De zes dimensies — samenvatting

| Dimensie | Score (−10 tot +10) | Wat dreef dit? |
|---|---:|---|
| **Containment** — was de beheersing snel en volledig? | **+3** | Isolatie in R1 werkte; geen tweede infectie-run. Verlies: 3 uur werkbaar netwerk. |
| **Forensics** — wat weten we nu over wat er is gebeurd? | **0** | Retainer in R1 goed geactiveerd, maar door vroege isolatie zijn live-processen verloren. Reconstructie via schijf-forensics wél mogelijk. |
| **Business continuity** — kon de zorg blijven doorgaan? | **+5** | R3 read-only-cache was de winnende zet. Crisisdienst leed 90 minuten, daarna weer op noodproces. |
| **Juridisch** — meldplichten en aansprakelijkheid | **+7** | AP + CSIRT vroeg gemeld, IGJ correct laat betrokken, cliënt-notificatie doelgroep-specifiek. Beter dan gemiddeld. |
| **Stakeholders / verantwoording** — hoe komt de organisatie eruit? | **+10** | Interne communicatie snel + eerlijk, extern feitelijk. Cliënten hebben een concreet FG-nummer gekregen. Sterk. |
| **Kosten** — financiële en operationele schade | **−4** | 90 min crisisdienst-uitval, ~40 gemiste behandelingen, ~€30k verzekerd. Twee dagen achterstand in dossier-administratie. |

**Totaalscore**: 62 / 100 (gewogen gemiddelde met per-ronde wegingen).

De uitschieters — **stakeholder-communicatie (+10)** en **juridisch (+7)** —
zijn de sterkste kanten. **Business continuity (+5)** kwam laat op gang; als
het read-only-cache-idee eerder in R1 was geopperd was dit een +8 geweest.
**Forensics (0)** is de traditionele trade-off met containment.

---

## Feiten en aannames — waar liep het team tegen aan

**Kritiekste aanname als feit behandeld**: het MSP-bericht "back-ups lijken
schoon" in ronde 2 werd gebruikt als input voor de herstelplanning in
ronde 3. Achteraf: de MSP had alleen de mount-status gecontroleerd, niet de
bestandsinhoud. Toen dit in ronde 3 door Eye Security werd tegengesproken,
moest de herstelstrategie herbouwd worden — kostte ~45 minuten in de sessie
en zou in het echt 3–4 uur extra hebben gekost.

**Andere aannames die het team goed onderscheidde van feit**:
- Aanname: "geen data-exfiltratie omdat we geen ongewone uitgaande verbindingen
  zien". Team behandelde als aanname → doelgroep-specifieke cliënt-notificatie
  in R4, geen blanket-melding.
- Aanname: "de vakantie-EPD-beheerder kan vanavond bereikbaar zijn". Team
  behandelde als aanname → tweede-lijn-plan gemaakt.

**Wat had beter gekund**:
- Het "back-ups schoon"-bericht had bij binnenkomst als aanname geclassificeerd
  moeten worden. Het kwam uit één bron, één check, en zonder recovery-test.
  🟡 De app registreert nu niet welke informatie als feit/aanname behandeld
  is tijdens de discussie — alleen de authoring-classificatie op de inject.

---

## Lessons learned

### Wat goed ging

1. **Retainer-activatie was snel en gedelegeerd** — CISO nam initiatief zonder
   op autorisatie van het bestuur te wachten. Dat is precies wat een
   retainer moet doen.
2. **Interne communicatie eerst, extern later** — behandelaars kregen als
   eerste een menselijke boodschap via de communicatiemanager, niet via
   een technisch bericht. Dat is te vaak andersom.
3. **Read-only-cache in R3** — creatieve BC-oplossing die je op geen enkele
   plek in het draaiboek terug leest. Onthouden voor komende oefeningen.

### Wat de volgende keer beter moet

1. **Feit-versus-aanname discipline** — leer het team één minuut te nemen
   voordat een MSP-bericht als input voor een besluit gaat. Vraag: "hoe weet
   die persoon dat?"
2. **BC-alternatieven eerder benoemen** — het paperbased-noodproces in R1
   werkt, maar het duurde 90 minuten voor iemand het opperde. Doe een
   pre-mortem sessie voor de volgende oefening: welk noodproces per systeem?
3. **AVG-klok expliciet als tik-signaal** — de klok was er in de tekst, maar
   werd niet visueel bijgehouden. Facilitator zou 'm actief kunnen inzetten.

### Concrete aanbevelingen voor De Waterhof

1. **Back-up-restore quarterly test opnemen in de compliance-agenda**.
   Verantwoordelijke: IT-manager + MSP. Volgende test: uiterlijk juni 2026.
2. **EPD-noodproces documenteren**: read-only-cache + paperbased fallback
   voor crisisdienst. Zet dit in het IR-plan als eerste bijlage.
3. **FG-nummer voor cliëntvragen paraat houden** — nu improviseerd
   opgesteld, kan structureel als onderdeel van het communicatieprotocol.
4. **Herhaal deze oefening in Q4** met een insider-threat variant of
   supply-chain compromise via de EPD-leverancier — die twee zijn
   substantieel andere scenario's.

---

## Wat de app niet vastlegt (🟡)

Deze rapport-onderdelen vereisen data die op dit moment niet in het datamodel
zit. Voor de developers om te implementeren als het rapport in productie moet.

- **Deelnemer-namen** — sessie-state houdt `participantId` en `role` bij, maar
  de naam wordt niet in het rapport-object bewaard. Voor een klantrapport is
  dat nodig (of expliciet weggelaten met een uitleg).
- **Discussie-transcript** — de mondelinge discussie tussen deelnemers is
  waar het leren gebeurt. Nu wordt alleen de finale keuze per rol
  opgeslagen. Overweeg per beslissing een tekstvak "waarom" (het `reasoning`
  veld op `SubmittedDecision` bestaat al — maar het wordt niet in het rapport
  ge-included).
- **Real-time discussie-turns** — welke rol praatte wanneer over welk
  onderwerp. Kost een luister-feature die er nog niet is (bewust — dat is
  buiten scope).
- **Facilitator-observaties tijdens de sessie** — losse aantekeningen die
  de facilitator zou willen maken. Er bestaat geen "facilitator log"
  concept. Overweeg: `SessionState.facilitatorLog: { round, timestamp, note }[]`.
- **Welke informatie als feit vs. aanname is behandeld** — de
  authoring-classificatie op de inject staat vast (feit/aanname/fabel), maar
  hoe het team het *behandelde* is nu niet vastgelegd. Kan via een klik
  "markeer als aanname" op de inject-kaart tijdens de sessie.
- **Concrete tijdstip per keuze en per fase-overgang** — bestaat in de
  timeline (`SessionState.timeline`), maar de link tussen timeline-events en
  rapport-secties is nog niet gelegd.
- **Score per ronde geaggregeerd naar dimensies met per-optie-uitleg** — de
  scoring-engine (`lib/scoring/`) produceert wél de vectoren, maar de
  presentatie in "waarom die score voor deze dimensie" komt niet uit het
  datamodel. Het is nu iets wat de facilitator handmatig invult op basis van
  de gekozen opties. Voor het rapport moet dit templatable of
  automatisch-genereerbaar.
- **Zes-dimensie-totaalscore + gewogen gemiddelde weergave** — de per-ronde
  vectoren zijn er, maar de aggregatie naar "62/100" is een presentatie-
  keuze die nog niet is gemaakt.
- **Aanbevelingen-generator** — de "concrete aanbevelingen" in de
  Lessons-sectie zijn nu handwerk. Overweeg: elke special-condition of
  gekozen slechte-optie kan een aanbeveling triggeren. Nog niet geïmplementeerd.

## Structuur voor de developers

Als deze rapport-vorm het uitgangspunt is, dan is de gewenste rapport-schema
ongeveer:

```ts
interface SessionReport {
  session: { id, startedAt, duration, facilitator }
  client: { name, sector, roles }             // 🟡 nu niet volledig opgeslagen
  scenario: { title, summary, roundCount, specialConditions }
  participants: Array<{ id, name, role }>     // 🟡 name nu niet opgeslagen
  rounds: Array<{
    number, title, situation,
    decisionsByRole: Array<{
      role, participant, chosen: Option, alternatives: Option[],
      reasoning: string,                       // bestaat al, maar niet gerenderd
      scoreVector: OutcomeVector
    }>
    steeringQuestions: string[]                // bestaat via reviewPrompts
    scoreTotal: OutcomeVector
  }>
  dimensions: Record<OutcomeDimension, {
    score: number, rationale: string           // 🟡 rationale niet automatisch
  }>
  factsAndAssumptions: {                       // 🟡 volledig nieuw
    treatedAsFactButWasAssumption: Array<...>,
    decisionsRestingOn: Array<...>
  }
  lessons: {                                   // 🟡 volledig nieuw
    whatWentWell: string[],
    whatToImprove: string[],
    recommendations: string[]
  }
  notLogged: string[]                          // meta — welke velden ontbreken
}
```
