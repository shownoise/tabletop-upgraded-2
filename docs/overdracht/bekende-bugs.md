# Bekende bugs en losse eindjes

Wat we onderweg hebben gevonden en bewust hebben laten liggen. Per punt: waarom
en voor wie het is.

## UI / weergave

### Play-view teller "N/totalPlayers ingediend" kan misleidend zijn

**Locatie**: `components/participant/play-view.tsx:1233`
```
{roundDecisions.length}/{totalPlayers} beslissingen ingediend
```
Als één deelnemer meerdere rollen erft (inherited roles) kan
`roundDecisions.length` groter zijn dan `totalPlayers`. Dan lees je bv.
`8/4 ingediend`.

**Voor wie**: minor UX-fix, kan door developers of door mij bij de i18n-pass.
Analoog aan de fix in `live-overview-panel.tsx` (PR #3), maar hier gaat het
niet om een `?? 1` fallback.

### "Beslissing afsluiten" jump naar volgende ronde (P10 bug 3)

**Locatie**: `components/admin/control-dashboard.tsx:342` (knop) →
`api.forceLock()` → `lib/session-store.ts:1276` (`finalizeDecision`)

**Diagnose**: de code klopt. `finalizeDecision` zet `roundPhase = 'review'`
expliciet en emit `phase_changed`. Geen auto-advance in useEffects.
`api/session/force-lock/route.ts` roept alleen `forceLock()` aan.

Als je in de browser echt een sprong naar de volgende ronde ziet, is er twee
opties: (a) je klikte per ongeluk op de aangrenzende next-action-knop die na
review-fase "Start ronde N+2" wordt, (b) er zit iets in de session-state
mutatie dat na `finalizeDecision` alsnog `nextRound` triggert.

**Voor wie**: als (b) waar is, is dit voor de developers die de session-store
gaan herschrijven — de huidige logica is correct.

### Decision-panel toont maar 2 van de 4 opties (P10 bug 1)

**Locatie**: `components/participant/decision-panel.tsx:155`
```
const myActions = roundActions.filter(
  a => a.allowedRoles.length === 0 || a.allowedRoles.includes(role)
)
```

**Diagnose**: geen hardcoded 2-limiet in de UI. De filter toont per deelnemer
alleen opties waar de eigen rol in `allowedRoles` staat (of waar
`allowedRoles` leeg is). Bij een decision met 4 opties verdeeld over rollen
(2 voor CEO, 2 voor CISO) ziet elke deelnemer er 2. Dat is design.

**Alleen een bug** als alle 4 opties dezelfde `allowedRoles` hebben en er tóch
2 verdwijnen. Verdachte plekken bij een echte bug:
`lib/graph/wizard-plan.ts:220` (wizard-plan → RoleAction[] mapping) en
`lib/graph/preview.ts:46`.

**Voor wie**: Bas moet in het testscenario checken hoe de opties per decision
zijn geconfigureerd. Als het écht een bug is: dan graph-adapter fix
(developer of ik).

## Data en migraties

### `fabel` classificatie zit overal (P2)

**Locatie**: `lib/graph/types.ts:97`, `lib/api-client.ts:61,121`,
`lib/graph/wizard-plan.ts:66`, `lib/graph/validate.ts:159`,
`lib/wizard/pipeline.ts:95,108,184`, `lib/wizard/framework.ts:194`,
`components/participant/inject-feed.tsx:617`, plus 6+ authored injects in
`lib/graph/examples-schoolvereniging.ts`.

**Diagnose**: `classification: 'feit' | 'aanname' | 'fabel'` is een
data-type-verandering die door types, wizard-regels, UI-filters, tests, en
scenario-data heen loopt. Migratie vereist keuzes (hard cut vs. soft alias) —
vragen staan in `docs/overdracht/P2-inventarisatie.md`.

**Voor wie**: wacht op antwoord van Bas. Zodra beslist: PR met migratie.

### `{{klantnaam}}` / `clientName` mismatch

De AI-wizard vraagt `clientName` uit
(`lib/wizard/config.ts:20`), maar de dynamic-fill kent geen `{{klantnaam}}`
of `{{clientName}}` token (`lib/graph/dynamic-fill.ts:7` heeft alleen
`sector`, `companySize`, `crownJewels`, `criticalSystems`, `irRetainerName`).

Wil je klantnaam in inject-tekst: token toevoegen aan `DynamicFillToken` in
`lib/graph/types.ts` én in `tokenValue()` in `dynamic-fill.ts`.

**Voor wie**: ik, zodra je bevestigt dat je het nodig hebt (of samen met P6).

### "Training modus" niet als expliciete vlag in code

**Diagnose**: grep vindt geen `trainingMode` / `training_mode` in de codebase.
Er is wél `event-mode.ts` met fasen (briefing/overleg/keuze/lock/review).
"Training modus" is impliciet — alles wat níet event-mode is.

**Voor wie**: P8 gaat hierover; developers zullen dit expliciet moeten maken
als event-mode een echte toggle wordt.

## Regelgeving / meldplicht

### NIS2-hardcoded strings in i18n

**Locatie**: `lib/i18n.ts:159,187,215,367,395,423` — regels zoals
`plan_nis2: "NIS2-proces gedocumenteerd"` en `modeHint_training:
"NIS2-gerichte training met procesconformiteit bijhouden."`

**Diagnose**: architectonisch is `regulatory.regime?.authorityLabel` al
parametrizable, dus de UI-labels *kunnen* generiek worden. Alleen de
i18n-strings houden NIS2 letterlijk vast. Concrete tekstvoorstellen staan in
`docs/overdracht/P2-inventarisatie.md`.

**Voor wie**: wacht op antwoord van Bas (P2).

## Session-store / state-machine

### Race in `finalizeDecision` (mogelijk)

**Locatie**: `lib/session-store.ts:1276` — `finalizeDecision` doet een `mutate`
en emit een `phase_changed`. Als de client tegelijkertijd `nextRound` triggert
(door de aangrenzende dashboard-knop met een intussen ge-updated
`describeNextAction`) is er in theorie een race.

**Diagnose**: niet gereproduceerd. Kan een verklaring zijn voor P10 bug 3 als
(b) waar is.

**Voor wie**: developers, bij herschrijving van de session-store.

### `pendingByParticipant` niet altijd populeer

**Locatie**: `lib/session-store.ts` — `session.activeDecision.pendingByParticipant`
wordt gebruikt in `live-overview-panel.tsx:57` als bron voor "expected count",
maar is `undefined` in praktijk buiten strak-omkaderde DECISION-momenten.
De weergave-fix in PR #3 werkt daaromheen, maar de onderliggende reden is dat
`pendingByParticipant` niet altijd bijgewerkt is wanneer je 'm zou verwachten.

**Voor wie**: developers. Weergave werkt intussen correct.

## Architectuur / documentatie

### `docs/architecture/*.md` zijn verouderd

Vijf documenten (`01_three_layer_logic.md` t/m `05_data_model.md`) beschrijven
de oude module-library architectuur. `docs/overdracht/architectuur.md` geeft
de huidige stand, met per-doc verouderd-markering.

**Voor wie**: iedereen die de code in leest. Nieuw personeel zou eerst
`docs/overdracht/architectuur.md` moeten lezen, niet `docs/architecture/`.

### PROMPT_-bestanden in de repo-root

`PROMPT_NIS2_SUPERVISION.md`, `PROMPT_SCENARIO_BUILDER_V2.md` en
`PROMPT_COMPLIANCE_CLEANUP.md` (indien nog aanwezig) zijn werkinstructies
uit vorige sessies. Grote bestanden (~45K), niet nodig voor productie.
Kunnen naar `docs/overdracht/archief/` als je opruimt.

**Voor wie**: Bas — beslissing over archiveren.
