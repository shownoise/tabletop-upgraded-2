# Claude Code Brief — Implementatie van de logica-upgrade

Plak deze hele tekst in Claude Code als eerste prompt, vanaf de root van je `tabletop-upgraded-2` repo. Claude Code leest dan zelf de docs en je bestaande code, en stelt een plan op.

---

## De prompt

```
Ik wil de scenario-generatie-logica van deze app fundamenteel verbeteren. De 
volledige inhoudelijke uitleg staat in docs/architecture/ en docs/library/. Lees 
die eerst.

Doe dan een grondige verkenning van de bestaande codebase. Focus op:

1. lib/template-types.ts — hoe templates nu gestructureerd zijn
2. De scenario-generatie laag (waar de Anthropic API wordt aangeroepen voor 
   inject-generatie) — meestal in app/api/ of lib/scenario/
3. De format builder UI (components/format-builder/ of vergelijkbaar)
4. De twee builtin templates (Ransomware Full Crisis en BEC/CFO Fraud) — hoe zijn 
   die nu opgebouwd?
5. De renderer/runtime die de templates omzet naar de live exercise

Schrijf vervolgens een implementatieplan met:

- Welke bestaande types worden uitgebreid (niet vervangen)
- Welke nieuwe bestanden komen erbij
- Een migratiepad voor de twee bestaande templates
- Een fasering: welke upgrade eerst, welke later
- Welke tests / validators nodig zijn

Wacht op mijn akkoord op het plan voordat je implementeert.

DE DRIE FUNDAMENTELE UPGRADES (volgorde van prioriteit):

UPGRADE 1 — Attack-chain templates per scenario-type
De huidige scenariogeneratie produceert one-size-fits-all chains. Dit moet veranderen 
in scenario-type-specifieke chains. Begin met deze vier:

- ransomware_double_extortion (docs/library/chains/ransomware_double_extortion.md)
- insider_threat (docs/library/chains/insider_threat.md)
- bec_cfo_fraud (docs/library/chains/bec_cfo_fraud.md)
- supply_chain_compromise (docs/library/chains/supply_chain_compromise.md)

Maak de chain-definities als data (TypeScript const exports), niet hardcoded in 
prompts. Een nieuwe scenario-type toevoegen moet betekenen: een nieuw bestand 
toevoegen aan lib/chains/, en het registreren in een index.

UPGRADE 2 — Module library in plaats van vaste rondes
Vervang de aanname "elke oefening heeft 4-5 rondes" door een module-library waaruit 
per template wordt gekozen. De tien modules staan in docs/architecture/02_module_library.md. 
Per template kies je 2-8 modules in volgorde.

De format builder moet:
- Een module-picker krijgen waar de gebruiker modules kan toevoegen, verwijderen, 
  en herordenen
- Per module de default kanalen, duur en lens overschrijven kunnen
- Default module-sets per scenario-type aanbieden (zie docs/architecture/02_module_library.md 
  sectie "Default module-combinaties per scenario-type")

UPGRADE 3 — Decision framework keuze
Maak het BOB-model één van vijf opties: BOB, OODA, DAIR, NIST-IR, of vrij. Per 
framework: verschillende facilitator-prompt-stijlen, verschillende decision-question 
framing. Default per scenario-type: BOB.

Zie docs/architecture/03_decision_frameworks.md voor de details.

UPGRADE 4 — IR-retainer scope-constraint
Voeg een hard validator toe die decisions filtert die buiten klant-scope vallen 
(forensisch onderzoek, EDR-isolatie, malware analyse, etc.). Wij doen die als 
retainer, de klant beslist over governance/BC/comms/legal/strategie. Zie 
docs/architecture/04_ir_retainer_scope.md voor de complete scope-definitie.

Voeg dezelfde constraint toe aan de scenario-generator prompt (zie 
docs/library/prompts/scenario_generator.md).

== ALGEMENE PRINCIPES ==

- Behoud de huidige IBM Plex Mono terminal-aesthetic in de output
- Behoud de live-like inject-rendering (chauffeur-WhatsApp, klantmail, SIEM-alert, etc.)
- Behoud de huidige auth, KV-storage, en i18n-systeem
- Migreer de twee bestaande builtin templates naar het nieuwe model — niet weggooien
- Voeg validators toe die tussen AI-generatie en render draaien (zie 
  docs/architecture/05_data_model.md voor de zes validators)
- Schrijf TypeScript types eerst, dan de logica, dan de UI

== FASERING-SUGGESTIE ==

Fase 1 — Data model en types (lib/types/)
Fase 2 — Attack chain library (lib/chains/) met de vier scenario-types
Fase 3 — Module library (lib/modules/)
Fase 4 — Validators (lib/validators/)
Fase 5 — Scenario generator (lib/scenario/generator.ts) — herziening van bestaande 
         AI-aanroep met nieuwe constraints
Fase 6 — Format builder UI — uitbreiding voor module-picker en framework-keuze
Fase 7 — Migratie van bestaande templates
Fase 8 — Tests en handmatige verificatie met een echte oefening

Start met fase 1. Bij elke fase: tonen wat je hebt gedaan, wachten op feedback 
voordat je verder gaat.

Geen wijzigingen aan de auth-, KV- of i18n-laag tenzij ze de upgrades direct 
in de weg zitten.

Begin met de verkenning en het plan.
```

---

## Wat je doet na het inplakken

1. Claude Code leest de docs en verkent je code (paar minuten)
2. Hij komt terug met een gestructureerd plan in fasen
3. Je leest het plan, geeft feedback of akkoord
4. Hij begint met fase 1 (types), laat zien wat hij heeft gedaan
5. Jij keurt goed of vraagt aanpassingen, dan fase 2
6. Etc.

## Tips voor het traject

- **Laat hem niet alles in één keer doen.** De fasering is belangrijk — anders krijg je een grote brok code waar je geen overzicht meer in hebt.
- **Test na elke fase.** Vooral fase 5 (de generator) — laat een test-scenario genereren en check of de validators werken.
- **Behoud de templates.** Bij fase 7 moeten de twee bestaande builtin-templates blijven werken, alleen in het nieuwe model. Verlies hier geen functionaliteit.
- **Commit per fase.** Na elke goedgekeurde fase: git commit. Zo kun je terug naar een werkende staat als iets fout gaat.

## Wat als Claude Code afwijkt van het plan

Soms ziet Claude Code in je echte codebase iets dat de docs niet weten. Bijvoorbeeld dat je al ergens een vergelijkbare abstractie hebt waarop hij kan voortbouwen. Dat is goed — laat hem in dat geval afwijken en aan jou uitleggen waarom. De docs zijn richting, niet wet.

Wat wel hard is:
- De drie-laags logica (chain → module-projectie → injects) blijft staan
- De IR-retainer scope-constraint blijft hard
- De vier scenario-types als startpunt blijven staan
- BOB blijft default maar is niet meer de enige optie
