# Werkafspraken

## Context

Crisis-simulatie / tabletop app, gebouwd via vibecoding door een niet-developer.
De codebase gaat over naar externe developers. Zij doen: meertaligheid, database
en sessie-opslag, realtime laag, presenter view. Ik doe: scenario-inhoud, prompt,
scoringsregels, teksten, rapportontwerp.

## Git-discipline — hardste regel

- Nooit committen of pushen naar `main`. Nooit.
- Elke klus krijgt zijn eigen branch. De prompt vertelt je de naam.
- Eén onderwerp per commit, met een boodschap waaruit blijkt wat en waarom.
- Aan het eind van een klus: push de branch en maak een PR. Merge NIET zelf.
- Voor je begint: controleer dat je op de juiste branch staat en meld dat.

## Harde regels

1. Mijn beschrijvingen zijn HYPOTHESES. Ik weet vaak niet meer wat waar zit.
   Zegt de code iets anders, dan heeft de code voorrang en meld je dat expliciet.
2. Verwijder nooit iets op naam, locatie of beschrijving. Alleen op aantoonbare
   afwezigheid van gebruik, met bewijs: bestandspad, regelnummer, aanroeper.
3. Bij twijfel niet verwijderen. Eén concrete vraag met opties, dan stoppen.
4. Ga niet mee in een aanname om behulpzaam te zijn. "Je hebt gelijk, ik voeg ze
   samen" is het slechtste antwoord als het niet klopt.
5. Recent toegevoegde code is waarschijnlijk mijn nieuwe werk en juist NIET wat
   weg moet. Check git log/blame voor je iets oud noemt.
6. Raakt een wijziging opgeslagen scenario-data, dan meld je dat vóór je begint.

## Niet aanraken

i18n-structuur · database en sessie-opslag · websockets/realtime · lobby en
sessieflow · presenter view. Kom je er per ongeluk terecht: stop en meld het.

## Statusbestand

`docs/overdracht/status.md` is de bron van waarheid over wat gedaan is, niet ons
gesprek. Werk dat bij aan het eind van elke klus.

## Domein-glossarium

`CONTEXT.md` is het glossarium: één regel per begrip plus waar het in de code
voorkomt, inclusief termen die onder twee verschillende namen bestaan. Twijfel
je aan een naam: check daar eerst voor je een file leest.

## Project Rules

Voor het zoeken naar de juiste plek in de code:

- `.claude/rules/codebase-map.md` — exacte bestandslocaties per taak,
  zoekstrategie, invariants.
- `.claude/rules/patterns.md` — anti-patterns, type patterns,
  component/API-conventies, state flow.

## Custom Commands

- `/add-scenario [type]` — add a new scenario type to the template generator.
- `/add-role [id / label]` — add a new participant role.
- `/check` — run TypeScript check and filter pre-existing errors.
- `/deploy` — type-check then deploy to Vercel preview.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`shownoise/tabletop-upgraded-2`). Use `gh`.
See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root (glossarium). See
`docs/agents/domain.md`.
