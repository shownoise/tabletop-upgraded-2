# Rubric — scenariokwaliteit

Tien beoordelingspunten, 0/1/2 per punt. Maximumscore = 20. Ik ben streng —
een 15 is écht goed, een 20 heb ik nog nooit gezien. Doel: in 5 minuten een
scenario scoren.

## Hoe te gebruiken

1. Genereer een scenario voor één van de vijf testklanten (zie `testklanten.md`)
2. Open het scenario in de builder én lees de eindtekst zoals een deelnemer die zou zien
3. Loop de rubric door — één regel per punt in een tabelrij van
   `nulmeting/<klantnummer>-<datum>.md`
4. Totaal is de nulmeting-score. Structureel lage punten zijn prompt-verbeteringen (P6).

Streng scoren betekent: bij twijfel de lagere score. Als je een score met
"nou ja, min of meer" beargumenteert, is het geen 2.

---

## De tien punten

### 1. Elke beslissing is vooraf aangekondigd

Waarom: keuzes moeten uit signaal komen, niet uit het niets — anders is het
raden en niet oefenen.

- **0** — één of meer beslissingen komen zonder inject die het onderwerp opzet
- **1** — alle beslissingen aangekondigd via minimaal één inject
- **2** — alle beslissingen door minstens één inject aangekondigd, en de
  aankondiging is inhoudelijk relevant (niet cosmetisch, niet ná de
  beslissing pas duidend)

### 2. Meer dan twee opties per beslissing per rol

Waarom: een ja-nee-keuze levert geen inhoudelijk gesprek op tussen mensen die
al 15 jaar in de branche zitten.

- **0** — één of meer beslissingen met 2 of minder opties voor een bezette rol
- **1** — alle beslissingen minimaal 3 opties per rol, maar in minstens één
  geval is één optie duidelijk beste
- **2** — alle beslissingen minimaal 3 opties per rol, met échte trade-offs
  bij elke optie

### 3. Geen voor de hand liggend goed antwoord

Waarom: dilemma's ontstaan waar niemand ongeschonden uit komt. Als het "juiste"
antwoord evident is, oefen je alleen dat mensen kunnen lezen.

- **0** — de goede keuze is triviaal aan te wijzen zonder discussie
- **1** — één beslissing heeft een dominante optie; andere zijn echte dilemma's
- **2** — elke beslissing heeft tegenspraak: containment kost forensics,
  snelheid kost accuratesse, transparantie kost onderhandelingspositie

### 4. Sectorcontext echt gebruikt

Waarom: als je "school" of "productie" uit het scenario kunt wegstrepen zonder
verlies, is de context alleen decor.

- **0** — sectornaam en kroonjuwelen worden niet substantief geraakt
- **1** — kroonjuwelen worden geraakt maar de sector-specifieke actoren
  (koepel, toezichthouder, keten) blijven generiek
- **2** — kroonjuwelen worden geraakt, sector-specifieke actoren zijn concreet
  benoemd (IGJ voor zorg, AFM voor VmB, KDD-clausule voor defensie-toelevering)
  en beïnvloeden ten minste één beslissing

### 5. Tijdlijn klopt

Waarom: AVG 72u en NIS2 24u zijn hard; RTO/RPO ook. Verkeerde termijnen
demonstreren dat de AI de wet niet snapt en dat is dodelijk voor de credibility.

- **0** — wettelijke termijnen ontbreken of kloppen niet (bv. "AVG binnen 24
  uur")
- **1** — termijnen kloppen en zijn genoemd, maar tikken niet zichtbaar in
  het verhaal
- **2** — termijnen tikken zichtbaar (in de situatieschets of injects), en
  minstens één beslissing wordt door de klok geforceerd

### 6. Rollen komen uit de lijst en passen bij de klant

Waarom: als "IT-directeur" of "SOC-lead" opeens verschijnt terwijl die niet in
ROLE_META staan, verwart dat de deelnemer. Als de klant geen CISO heeft en
het scenario verwacht wel een CISO-beslissing, klopt de casting niet.

- **0** — één of meer rollen uit de fantasie (buiten de 8 in ROLE_META)
- **1** — alle rollen uit ROLE_META, maar rollen worden verwacht die bij de
  testklant niet bezet zijn
- **2** — alle rollen uit ROLE_META, en de wizard heeft de niet-bezette
  rollen expliciet geadresseerd (bijvoorbeeld: "de CEO neemt de
  communicatiebeslissing want er is geen head_of_comms")

### 7. Taal consistent

Waarom: NL/EN-mix breekt de immersie. Als deelnemers stoppen om over "urgency
= high" te lachen, is het onderwerp weg.

- **0** — losse Engelse woorden in NL-teksten of vice versa (bv. "critical
  event", "assumption failed", "handled")
- **1** — consistent NL of EN, met één of twee vaktermen in de andere taal
  (SLA, MSP, EPD acceptabel)
- **2** — volledig consistent, ook in labels en knopteksten

### 8. Eén standaard zwakte in het verhaal die later terugkomt

Waarom: elke sessie moet één "wij hebben dit nooit geoefend"-moment hebben —
back-ups nooit getest, crisisplan nooit geoefend, mandaat niet vastgelegd.
Dat is de haak waar leren zich aan hangt.

- **0** — geen zwakte in briefings of injects
- **1** — zwakte in briefing van één rol, maar komt niet terug in een keuze
- **2** — zwakte in briefing én die zwakte forceert of kleurt een latere
  beslissing, waardoor de discussie erdoor wordt beïnvloed

### 9. Balans ruis / signaal

Waarom: 20 injects zonder ruis is een oefenscript; 20 injects allemaal ruis
is chaos. In het echt is de mix onherkenbaar.

- **0** — minder dan 20% ruis of meer dan 70% ruis
- **1** — 20–40% of 50–70% ruis (dus scheef)
- **2** — 40–50% ruis, waarbij minstens één "ruis met verdekte waarde" —
  iemand appt dat hij misschien de back-up vergat, terwijl in werkelijkheid
  ransomware de back-up versleutelde

### 10. Feiten en aannames zijn onderscheidbaar en spanningsvol

Waarom: elke sessie moet een moment hebben waarop iemand een aanname als
feit behandelt en daar een besluit op baseert. Dat is de leermoment-parade.

- **0** — alle injects zijn feit, of alle aannames staan expliciet
  gelabeld als aanname
- **1** — mix van feit en aanname, maar niemand die de dyade tijdens de
  discussie zou verwarren
- **2** — minstens één aanname die verleidelijk voor een feit door kan gaan,
  en een beslissing die daarop leunt

---

## Scoring-vel

Per gegenereerd scenario, één blok in `nulmeting/<klant>-<datum>.md`:

```
# Nulmeting — <klant> — YYYY-MM-DD

| Punt | Score | Toelichting (1 regel) |
|---|---|---|
| 1. Beslissingen aangekondigd | 0/1/2 | ... |
| 2. >2 opties per rol | 0/1/2 | ... |
| 3. Geen voor de hand liggend antwoord | 0/1/2 | ... |
| 4. Sectorcontext gebruikt | 0/1/2 | ... |
| 5. Tijdlijn klopt | 0/1/2 | ... |
| 6. Rollen uit lijst en passend | 0/1/2 | ... |
| 7. Taal consistent | 0/1/2 | ... |
| 8. Zwakte komt terug | 0/1/2 | ... |
| 9. Ruis/signaal balans | 0/1/2 | ... |
| 10. Feiten/aannames spanningsvol | 0/1/2 | ... |
| **Totaal** | **N / 20** | |

**Wat opviel**: 2-3 regels observaties buiten de punten om.
**Wat de wizard opnieuw moet krijgen**: welke prompt-regels (P6) hier hun werk niet deden.
```
