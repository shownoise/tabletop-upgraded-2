# Domein-glossarium

Eén regel per begrip, met waar het in de code zit. Als je een term twee namen ziet
hebben: check hier eerst, dat is meestal de reden dat er iets niet lijkt te
kloppen.

**Volgorde**: eerst de aliasconflicten (waar ik zelf in de war raak), daarna de
gewone termen alfabetisch.

---

## ⚠ Aliassen — hier zit de verwarring

### Zes scoringsdimensies ≠ `evaluationAspects`

Twee compleet verschillende concepten met verwarrend gelijkende naam.

- **Zes scoringsdimensies** — de assen waarop een keuze scoort. Vast, zes stuks.
  Code: `OUTCOME_DIMENSIONS` in `lib/scoring/constants.ts:6` en
  `OutcomeDimensionKey` in `lib/graph/types.ts:39`. Codenamen: `CONT` (containment),
  `FOR` (forensics), `BC` (business continuity), `JUR` (juridisch),
  `VER` (verantwoording / stakeholders — zie `SCORING.md:26`), `KOS` (kosten).
- **`evaluationAspects`** — opt-in vlaggen per node die bepalen wélke evaluatie-UI
  wordt getoond bij een inject/round. Waarden: `reliability`, `facts_assumptions`
  (deprecated alias voor `reliability`), `nis2`, `decision_impact`,
  `lessons_learned`. Code: `EvaluationAspect` in `lib/graph/types.ts:27`, gebruikt
  in `RoundNodeData.evaluationAspects` en `InjectNodeData.evaluationAspects`. Heeft
  **niks met scoring te maken**.

### Klantnaam ≠ dynamic-fill token

De AI-wizard vraagt de klantnaam wél uit, maar je kunt hem **niet** als
`{{klantnaam}}` in een inject-tekst gebruiken.

- **Wizard-config heeft `clientName`** — `lib/wizard/config.ts:20`. Ook `sector`,
  `companySize`, plus meer.
- **Dynamic-fill tokens** — `lib/graph/dynamic-fill.ts:7`. Ondersteund:
  `{{sector}}`, `{{companySize}}`, `{{crownJewels}}`, `{{criticalSystems}}`,
  `{{irRetainerName}}`. `{{clientName}}` en `{{klantnaam}}` bestaan **niet**.
- Wil je klantnaam in een inject-tekst: dat vereist een codewijziging in
  `dynamic-fill.ts` (token toevoegen aan `DynamicFillToken` in
  `lib/graph/types.ts` én in `tokenValue()`).

### IT-inrichting ≈ `criticalSystems` (niet exact)

Wat ik in de UI "IT-inrichting" noem, is in de code het veld `criticalSystems`
(dynamic-fill token en waarschijnlijk WizardConfig-veld). Kroonjuwelen is een
apart veld: `crownJewels`. Verwar die twee niet.

### Feit / aanname — twee auteurvelden voor hetzelfde

`'fabel'` is **weg**: de classificatie staat op `'feit' | 'aanname'`
(`lib/graph/types.ts:98`), verwijderd 2026-08-14. Kom je nog UI tegen die op
`fabel` filtert, dan is dat dode code die nooit matcht.

Wat er wél speelt: er zijn **twee** auteurvelden die dezelfde vraag stellen, en
de inspector vraagt ze naast elkaar.

- `classification` — `'feit' | 'aanname'`, Nederlands. Label dat de deelnemer
  ziet. `lib/graph/types.ts:98` en `:284`.
- `reliability` — `'fact' | 'assumption' | 'misleading'`, Engels, 3-waardig.
  "Ground truth", gestript uit de deelnemer-payload tot de review-fase.
  `lib/types.ts:342`. De waarde `misleading` is dezelfde "fabel" die ik nooit
  heb gevraagd.

`lib/types.ts:371` zegt dat nieuwe scenario's `classification` gebruiken, maar
`reliability` wordt nog in tien bestanden gelezen. Samenvoegen raakt opgeslagen
injects.

Los daarvan staat `FactCheckTag` (`'fact' | 'assumption'`, `lib/types.ts:603`):
wat de **deelnemer denkt**. Dat is een legitieme aparte as — de gok tegenover
de waarheid — en niet de dubbeling.

### Training modus ≠ event modus — beide bestaan wél

Opgelost 2026-10-20. Mijn eerdere aanname ("training modus heeft geen expliciete
vlag") kwam doordat ik op `trainingMode` / `training_mode` zocht. De vlag heet
anders:

- **`SimulationMode`** — `'event' | 'training'` op `lib/types.ts:88`. Omzetten
  via `setMode()` (`lib/session-store.ts:1276`) en
  `POST /api/session/set-mode`. Doorgevoerd in `createSession`, de setup-form,
  play-view en de scoring.
- **Event modus**: fasen `briefing → overleg → keuze → lock → review` in
  `lib/scoring/event-mode.ts:12`. Notulist bedient één iPad.
- In componenten zie je dit terug als `isEventMode` — de meeste
  deelnemerspanelen hangen aan `!isEventMode`.

### Escalatieniveau vs. `urgency`

Twee verschillende dingen met bijna dezelfde naam in gesprek:

- **`urgency`** — per inject, `'low' | 'medium' | 'high' | 'critical'`
  (`lib/types.ts:272`). Labels via `urgencyLabel()` in `lib/format.ts`, die
  `URGENCY_LABELS` uit `lib/config/texts.ts` leest.
- **Escalatieniveau van de sessie** — een index 0-3, labels via
  `ESCALATION_KEYS` in `lib/i18n.ts`.

De Engelse labels in Nederlandse schermen zijn opgelost 2026-10-19/20: zowel
`urgency` als het sessie-escalatieniveau renderen nu Nederlands, en
`lib/__tests__/format-labels.test.ts` plus `i18n-escalation.test.ts` dwingen af
dat ze niet terugvallen op de ruwe enum-waarde.

---

## Termen (alfabetisch)

- **AI-wizard** — genereert een scenario uit een `WizardConfig`. Code:
  `lib/wizard/framework.ts`, `lib/wizard/pipeline.ts`, `lib/wizard/config.ts`,
  `lib/wizard/seed.ts`. UI: `components/admin/builder/ai-wizard-dialog.tsx`.
  Zie ook: `app/api/session/create/route.ts` (waar de prompt richting Claude
  wordt opgebouwd).
- **Aanname** — inject-classificatie, waarde `'aanname'` in `classification`
  (`lib/graph/types.ts:97`). Zie ⚠-blok hierboven.
- **Chaser** — node-type dat een follow-up inject afvuurt als een decision niet
  is genomen. `lib/graph/types.ts:15` (`GraphNodeType`).
- **Decision** — node in de graph met opties per rol. Data:
  `DecisionNodeData` in `lib/graph/types.ts`. Node-type `"decision"`.
- **Deelnemer** — persoon met een rol tijdens een sessie. Views:
  `components/participant/*` (play-view, decision-panel, inject-feed,
  session-hud, phase-timer). Join-flow: `app/join/page.tsx`.
- **Dynamic tokens** — `{{sector}}`, `{{companySize}}`, `{{crownJewels}}`,
  `{{criticalSystems}}`, `{{irRetainerName}}`. Substitutie:
  `lib/graph/dynamic-fill.ts`. Zie ⚠-blok voor het ontbrekende `{{klantnaam}}`.
- **Escalatieniveau** — zie `urgency` in ⚠-blok.
- **Event modus** — sessiemodus voor partner-events: één zaal, notulist op één
  iPad, groot scherm. Fasen in `lib/scoring/event-mode.ts:12`.
- **`evaluationAspects`** — zie ⚠-blok. NIET hetzelfde als scoringsdimensies.
- **Facilitator** — degene die de sessie draait. Setup: `app/admin/page.tsx` +
  `components/admin/setup-form.tsx`. Live dashboard:
  `app/admin/dashboard/page.tsx` + `components/admin/control-dashboard.tsx`.
  Builder: `app/admin/builder/page.tsx` + `components/admin/builder/`.
- **Feit** — inject-classificatie, waarde `'feit'` in `classification`
  (`lib/graph/types.ts:97`).
- **Inject** — bericht dat tijdens een ronde binnenkomt. Node-type `"inject"`,
  data `InjectNodeData` in `lib/graph/types.ts:74`. Feed voor deelnemer:
  `components/participant/inject-feed.tsx`.
- **Meldplicht** — melding bij bevoegde autoriteit (nu NIS2-specifiek in tekst;
  P2 maakt dit algemener). Dit is sinds 2026-10-20 het **enige** meldmechanisme
  bij de deelnemer: `components/participant/regulatory-notification-button.tsx`
  → `POST /api/session/regulatory-filing` → `fileRegulatoryObligation()`, met
  milestones (`initial` / eindrapportage) uit het regime. Profiles/rail in
  `components/admin/builder/compliance-rail.tsx`.
  **Let op**: `MeldingMoment` op ronde (`lib/graph/types.ts:68`) is het *oude*,
  tweede mechanisme. De wizard genereert die momenten nog en de builder
  valideert ze, maar er is geen deelnemers-UI meer voor; `/api/session/melding`
  en `fileMelding()` zijn daarmee onbereikbaar geworden.
- **Notulist** — persoon achter de ene iPad in event modus, submitteert namens
  de hele groep. Genoemd in `lib/types.ts:603` (comment). Geen aparte `Role` in
  het type-union.
- **Optie** — een keuze binnen een decision, per rol. `DecisionOption` in
  `lib/graph/types.ts`. Deel B / scoring: elke optie draagt een outcome-vector.
- **Presenter view** — groot scherm voor het publiek. Bestaat: pagina
  `app/admin/present/page.tsx`, component `components/admin/present-view.tsx`.
  Leest dezelfde `useSessionStream()` als facilitator en deelnemer, heeft geen
  bedieningselementen behalve een terugknop naar het dashboard. Daarnaast is er
  `app/observe/page.tsx` — een tweede, los gebouwde observerweergave met nul
  inkomende links. Beide zitten achter de facilitator-login.
- **Rol** — deelnemersrol. Type-union `Role` in `lib/types.ts:10`. Meta (label,
  team, authorities) in `ROLE_META` op `lib/types.ts:37`. Domeinen (bv.
  leadership / technical / legal) in `RoleDomain` op `lib/types.ts:22`.
- **Ronde** — een fase van de simulatie. Node-type `"round"`, data
  `RoundNodeData` op `lib/graph/types.ts:49`. Bevat situatieschets, injects,
  optioneel decision, opening prompts, meldingsmomenten, review-vragen.
- **Scenario** — het uitgeschreven verhaal met rondes, injects en beslissingen.
  Opgeslagen als `ScenarioGraph` (`lib/graph/types.ts`). Templates:
  `lib/builtin-templates.ts`, `lib/graph/examples-*.ts`.
- **Scenariobuilder** — de visuele editor waar de scenario-graph wordt getekend.
  Pagina: `app/admin/builder/page.tsx`. Componenten:
  `components/admin/builder/canvas.tsx` + `inspector.tsx` + `editors/*` +
  `nodes/*` + `edges/*`.
- **Situatieschets** — de openingstekst van een ronde. Veld `situation_update`
  op `RoundNodeData` in `lib/graph/types.ts:52`.
- **Special** — bijzonder event (bv. negotiation, journalist). Node-type
  `"special"` in `lib/graph/types.ts:15`. UI:
  `components/admin/specials-panel.tsx`. API: `app/api/special/route.ts`.
- **Training modus** — zie ⚠-blok. `SimulationMode = 'training'` op
  `lib/types.ts:88`; in componenten `!isEventMode`.
- **Zes scoringsdimensies** — zie ⚠-blok. `OUTCOME_DIMENSIONS` in
  `lib/scoring/constants.ts:6`.
