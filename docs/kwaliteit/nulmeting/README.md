# Nulmeting — hoe uit te voeren

Doel: voor elk van de vijf testklanten in `../testklanten.md` een scenario
laten genereren door de huidige AI-wizard, en scoren met `../rubric.md`. De
uitkomsten (per klant één markdown-bestand in deze directory) vormen de
nulmeting waaraan alle latere prompt-verbeteringen (P6) worden afgemeten.

## Waarom niet automatisch

De wizard-flow zit in `lib/wizard/framework.ts` en `lib/wizard/pipeline.ts` en
draait door de app heen — een meerstaps LLM-orchestratie met validatie en
regeneratie. Dat headless nabouwen zou het risico geven dat we een "nulmeting"
scoren op iets wat afwijkt van wat de app produceert. Dus wordt de nulmeting
in de app zelf gedraaid.

## Stappen

Herhaal per testklant (1 t/m 5):

1. **Start de app lokaal**
   ```
   pnpm run dev
   ```
   Ga naar `/admin`.

2. **Vul de wizard**
   Open in de builder (`/admin/builder`) de AI-wizard. Vul:
   - `clientName` — naam uit `../testklanten.md`
   - `sector` — sector-regel uit dezelfde bron
   - `companySize` — `small` (≤50), `mkbplus` (50–250) of `enterprise` (>250)
   - `crownJewels` — kroonjuwelen-blok, comma-separated
   - `criticalSystems` — IT-inrichting samengevat (SAP + M365 + OT, of
     M365 + private-cloud EPD, etc.)
   - Rollen: alleen de bezette rollen aanvinken (zie "Crisis-team bezet"
     per klant)
   - Regime: `nl_avg_nis2` voor allemaal; voeg DORA toe voor klant 4 als
     de UI dat toelaat
   - Special conditions: kies er 1 of 2 die logisch passen bij de klant.
     Klant 1 → `outsourced_it_thin_sla`. Klant 2 → `ot_production_dependency`.
     Klant 3 → `single_knowledge_holder`. Klant 4 → `unclear_insurance`.
     Klant 5 → `supplier_concentration`.

3. **Laat de wizard draaien** — duurt 20–40 seconden op smart model.

4. **Sla het scenario op**
   - In de app: onder een naam als `nulmeting_klant<N>_<datum>`.
   - Optioneel: exporteer de JSON via de builder's "Export" knop en zet die
     in `nulmeting/klant<N>-<YYYY-MM-DD>.json`.

5. **Doorloop het scenario** — open het als facilitator, klik door de
   rondes, lees minstens één inject per ronde. Reken 5 minuten per klant.

6. **Score met de rubric**
   Kopieer het tabelblok uit `../rubric.md` naar
   `nulmeting/klant<N>-<YYYY-MM-DD>.md` en vul in. **Wees streng.** Een
   zwakke nulmeting is nuttig; een gepimpte is nutteloos.

7. **Herhaal voor de andere klanten** — spreid het over 2 dagen als je moet.
   Doe ze niet allemaal op één dag, want dan wen je aan de wizard-taal en
   ga je te mild scoren.

## Wanneer klaar

Als alle vijf klanten een markdown-scorekaart hebben in deze directory,
schrijf dan `nulmeting/SAMENVATTING.md` met:

- Totaalscore per klant (5 × N/20)
- Welke rubric-punten structureel het laagst scoren (bijvoorbeeld: "punt 3
  scoort 3×0 en 2×1" → geen voor de hand liggend antwoord is een
  prompt-lacune)
- **De prioriteitenlijst voor P6** — welke prompt-regels naar boven of
  toegevoegd moeten worden, in volgorde van impact.

Dat laatste bestand is wat P6 uitvoert. Zonder nulmeting is P6 gokken.

## Wat er in deze directory zit

- `README.md` — dit bestand
- Straks: `klant1-YYYY-MM-DD.md` t/m `klant5-YYYY-MM-DD.md` — de scorekaarten
- Optioneel: `klant<N>-YYYY-MM-DD.json` — de geëxporteerde scenario-graph
- Straks: `SAMENVATTING.md` — de synthese
