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

### Feit / aanname / fabel — in de code, ik gebruik alleen feit / aanname

Inject-classificatie staat op `'feit' | 'aanname' | 'fabel'`
(`lib/graph/types.ts:97`). Ik heb "fabel / misleidend" nooit gevraagd — dat is
door de AI verzonnen. P2 verwijdert dit. Kom je nu code tegen die op `fabel`
filtert: dat is de oude toestand.

### Training modus ≠ event modus — één helft ontbreekt in de code

- **Event modus** bestaat: fasen `briefing → overleg → keuze → lock → review` in
  `lib/scoring/event-mode.ts:12`. Notulist bedient één iPad
  (`lib/types.ts:603`).
- **Training modus** heeft **geen expliciete vlag** in de code voor zover ik heb
  gezien — grep vindt geen `trainingMode` / `training_mode`. Waarschijnlijk is
  "training modus" gewoon "alles wat niet in event-mode zit". Check dit
  expliciet bij P8.

### Escalatieniveau vs. `urgency`

Wat ik in gesprek "escalatieniveau" noem, heet in de code `urgency` (op inject,
zie `components/participant/urgent-inject-modal.tsx`, `phase-timer.tsx`,
`inject-feed.tsx`). Eén waarde die ik zeker weet: `"normal"` staat als Engels
label in een Nederlands scherm — dat komt terug in P2.

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
  P2 maakt dit algemener). `MeldingMoment` op ronde
  (`lib/graph/types.ts:68`), profiles/rail in
  `components/admin/builder/compliance-rail.tsx`.
- **Notulist** — persoon achter de ene iPad in event modus, submitteert namens
  de hele groep. Genoemd in `lib/types.ts:603` (comment). Geen aparte `Role` in
  het type-union.
- **Optie** — een keuze binnen een decision, per rol. `DecisionOption` in
  `lib/graph/types.ts`. Deel B / scoring: elke optie draagt een outcome-vector.
- **Presenter view** — groot scherm voor het publiek in event modus. Verwezen
  in `lib/scoring/event-mode.ts`. Losse pagina/component nog niet gevonden —
  developers bouwen die.
- **Rol** — deelnemersrol. Type-union `Role` in `lib/types.ts:10`. Meta (label,
  team, authorities) in `ROLE_META` op `lib/types.ts:37`. Domeinen (bv.
  leadership / technical / legal) in `RoleDomain` op `lib/types.ts:22`.
- **Ronde** — een fase van de simulatie. Node-type `"round"`, data
  `RoundNodeData` op `lib/graph/types.ts:49`. Bevat situatieschets, injects,
  optioneel decision, opening prompts, meldingsmomenten, review-vragen.
- **Scenario** — het uitgeschreven verhaal met rondes, injects en beslissingen.
  Opgeslagen als `ScenarioGraph` (`lib/graph/types.ts`). Templates:
  `lib/builtin-templates.ts`, `lib/graph/examples-*.ts`. Legacy
  template-generator: `lib/scenario-generator.ts`.
- **Scenariobuilder** — de visuele editor waar de scenario-graph wordt getekend.
  Pagina: `app/admin/builder/page.tsx`. Componenten:
  `components/admin/builder/canvas.tsx` + `inspector.tsx` + `editors/*` +
  `nodes/*` + `edges/*`.
- **Situatieschets** — de openingstekst van een ronde. Veld `situation_update`
  op `RoundNodeData` in `lib/graph/types.ts:52`.
- **Special** — bijzonder event (bv. negotiation, journalist). Node-type
  `"special"` in `lib/graph/types.ts:15`. UI:
  `components/admin/specials-panel.tsx`. API: `app/api/special/route.ts`.
- **Training modus** — zie ⚠-blok. Niet expliciet in code.
- **Zes scoringsdimensies** — zie ⚠-blok. `OUTCOME_DIMENSIONS` in
  `lib/scoring/constants.ts:6`.
