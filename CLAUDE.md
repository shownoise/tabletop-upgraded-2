# Werkafspraken

## Context

Crisis-simulatie / tabletop app, gebouwd via vibecoding door een niet-developer.
De codebase gaat over naar externe developers. Zij doen: meertaligheid, database
en sessie-opslag, realtime laag, presenter view. Ik doe: scenario-inhoud, prompt,
scoringsregels, teksten, rapportontwerp.

## Bouwen is de default

Bouw. Geen inventarisatiefases, geen tabellen vooraf, geen voorstellen ter
goedkeuring. Is iets onduidelijk: maak een redelijke aanname, bouw het, en
vertel me in één regel welke aanname je hebt gedaan. Ik corrigeer het als het
fout is — dat is sneller dan wachten op mij.

Documentatie schrijf je **alleen als ik er expliciet om vraag**. Verder niet.
Geen bijwerken van status.md, geen "voor de developers"-lijsten, tenzij ik het
vraag.

## Stoppen doe je alleen bij

- **Data-migratie** — een wijziging die bestaande scenario's of opgeslagen
  sessies kapotmaakt. Meld eerst wat er breekt en hoe je zou migreren.
- **Inhoudelijke keuze die ik moet maken** — bijvoorbeeld wat een specifiek
  antwoord hoort te scoren, of welke tekst een klant leest. Niet: welke van
  twee acceptabele implementaties. Die kies je zelf.

In alle andere gevallen: bouwen, mergen, mij vertellen waar ik het zie.

## Git-discipline

- Nooit **direct** committen of pushen naar `main`. Altijd via een branch.
- Elke klus: eigen branch, één onderwerp per commit, commit-boodschap zegt wat en waarom.
- Aan het eind van een klus: push branch, maak PR, en **merge zelf met squash
  naar main**. Ik reverte via GitHub's Revert-knop als er iets fout is.
- Voor je begint: controleer dat je op de juiste branch staat.

## Wat je nooit doet

1. Mijn beschrijvingen zijn HYPOTHESES. Zegt de code iets anders, dan heeft de
   code voorrang en meld je dat in één regel.
2. Verwijder niets op naam of beschrijving alleen — alleen op aantoonbare
   afwezigheid van gebruik.
3. Ga niet mee in een aanname om behulpzaam te zijn. "Je hebt gelijk, ik voeg ze
   samen" is het slechtste antwoord als het niet klopt.
4. Recent toegevoegde code is mijn nieuwe werk en juist NIET wat weg moet.
   Check git log/blame vóór je iets oud noemt.

## Niet aanraken

i18n-structuur · database en sessie-opslag · websockets/realtime · lobby en
sessieflow · presenter view. Kom je er per ongeluk terecht: stop en meld het.

## Afsluitend bericht per klus

Wat er live staat, op welke pagina/URL, en welke aannames je hebt gedaan.
Maximaal 5 regels. Geen samenvatting van wat je hebt gebouwd — dat lees ik in
de PR.

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
