# Scenario-data — anatomie

Een scenario is een **`ScenarioGraph`** (`lib/graph/types.ts:291`). Dat is een
gerichte graph — nodes zijn scenario-elementen, edges bepalen de flow.
Persistentie: KV bij Vercel, of localStorage in local dev. Format: JSON,
serialisatie 1:1 van de TypeScript-types.

## Root-object

```ts
{
  id, name, version, scenarioType,       // metadata
  nodes: GraphNode[],                     // scenario-elementen
  edges: GraphEdge[],                     // flow
  createdAt, updatedAt,
  // Optioneel — mag ontbreken voor legacy graphs:
  irRetainerName?, irPlaybook?, irRetainerProfile?,
  features?: { reliability, compliance, scoring },
  roleBriefings?: Partial<Record<Role, RoleBriefing>>,
  injectLibrary?: PremadeInject[],
  expectedOptionsPerRole?,
  wizardSeed?, publishStatus?,
}
```

Zie `lib/graph/types.ts:291-323` voor de exacte definities.

## Node-types

```ts
type GraphNodeType =
  | 'start' | 'round' | 'inject' | 'decision'
  | 'special' | 'outcome' | 'chaser'
```

### `start`

Ingangspunt. Data: alleen `{ kind: "start" }`. Elke graph heeft er precies één.

### `round`

Een ronde in de simulatie. Belangrijkste velden:

- `title`, `situation_update` — de openingstekst voor de deelnemer
- `timerMinutes` — hoe lang deze ronde loopt
- `roleActions: RoleAction[]` — de actie-opties beschikbaar voor deelnemers
  in deze ronde (verschillend van decision-node opties!)
- `learningObjectives`, `facilitatorNotes` — voor de facilitator
- `openingPrompts` — 2-3 vragen om de discussie te starten
- `evaluationAspects?` — opt-in vlaggen (`reliability`, `nis2`, etc.). NIET
  dezelfde als de zes scoringsdimensies — zie `CONTEXT.md`.
- `dynamic?` — als `enabled=true`, worden `{{sector}}` etc. tokens vervangen
  bij graph-load
- `meldingMoments?` — meldplicht-open-vensters
- `reviewPrompts?` — reflectievragen in de review-fase

Volledige definitie: `lib/graph/types.ts:49`.

### `inject`

Een bericht dat gedurende een ronde binnenkomt. Belangrijkste velden:

- `title`, `content`, `channel`, `urgency`, `senderName`
- `classification?: 'feit' | 'aanname' | 'fabel'` — P2 wil hier
  `fabel` uit; zit nog in het type. Zie `docs/overdracht/P2-inventarisatie.md`.
- `importance?: 'crucial' | 'info'` — 'crucial' telt in de D-noemer van
  BESLUIT (scoring) en geldt als materieel event voor ADAPT
- `visibility?: 'shared' | 'exclusive'` — asymmetrische zichtbaarheid
- `targetRoles?: Role[]` — wie krijgt 'm
- `correctRoute?: Role` — als de inject naar de "verkeerde" rol gaat (misroute)
- `requiresCapability?: string` — capability-gated (bv. `retainer_activated`)
- `evaluationAspects?`, `dynamic?`, `aiPromptTemplate?` — zoals bij round
- `facilitatorNote?` — waarom staat deze inject hier. Facilitator-only.

Volledige definitie: `lib/graph/types.ts:74`.

### `decision`

Een beslismoment. Belangrijkste velden:

- `prompt` — de vraag
- `options: DecisionOption[]` — mogelijke antwoorden per rol
- `perRole?: boolean` — als true: elke rol moet apart submitten
- Elke optie: `allowedRole`, `label`, `scoreImpact` (outcome-vector),
  `lessonLearned?`, `implicit?` (voor "geen besluit" fallback)

### `special`

Bijzondere gebeurtenissen: negotiation, journalist. Data hangt af van
`specialType`. Zie `lib/types.ts` (`SpecialType`).

### `outcome`

Een eind-uitkomst voor de sessie. Kan gekoppeld zijn aan een score-range
(`scoreRange?: { min?, max? }`) — de engine kiest automatisch de uitkomst die
het cumulatieve score-totaal past.

### `chaser`

Follow-up inject die automatisch afvuurt als een decision niet is genomen
(`decision_not_taken`).

## Wat NIET uit de builder komt

Deze velden zijn óf hardcoded óf via een aparte flow:

- **`irRetainerProfile` = `EYE_SECURITY_RETAINER`** — hardcoded in
  `lib/graph/types.ts:248`. `handleLoad` in de builder overschrijft oudere
  waardes bij het laden. Retainer-tab is verwijderd uit de UI.
- **`irRetainerName`** — wordt automatisch op `"Eye Security"` gezet voor
  nieuwe graphs.
- **`wizardSeed`** — alleen aanwezig als de graph door
  `runWizardPipeline` is gemaakt. De builder toont het niet direct.
- **`publishStatus`** — wizard schrijft `'draft'`. Promotie naar
  `'published'` gebeurt via een aparte builder-actie (niet standaard
  in de setup-form).
- **`injectLibrary`** — komt uit `lib/graph/examples-*.ts` bij ingebouwde
  scenario's; wizard genereert er ook. Handmatig toe te voegen via de
  builder's inject-library-panel.
- **Bestaande scenario-data in `lib/graph/examples-schoolvereniging.ts`** —
  authored met de hand door de vorige AI-generatie. Verwacht rommel:
  `classification: "fabel"` op meerdere plekken, mogelijk inconsistent
  taalgebruik, en NIS2-specifieke tijdlijnen (voor deze klant correct).
  Dit is een van de bronnen voor de fabel-migratie (P2).

## Wat opgeslagen wordt

- **KV bij Vercel** — via `lib/session-store.ts`. Key-namespace bevat
  sessie-state én scenario-graph verwijzingen.
- **localStorage** — in local dev, en voor de deelnemer's identity
  (naam + rol + participantId — survives page refresh, alleen sessieID
  zit in URL).
- **In-memory sessie-state** — sessies zijn in-memory op de Vercel-instance,
  KV is de persistence-layer. Multi-instance risico wordt afgevangen door de
  SSE + 4s polling combinatie.

## Waar aan te passen

- **Nieuwe node-toevoegen aan het type-systeem**: `lib/graph/types.ts` — voeg
  `GraphNodeType`, nieuwe `NodeData` interface, en case in `GraphNodeData`
  union.
- **Nieuwe dynamic-fill token**: `lib/graph/types.ts` (`DynamicFillToken` en
  `DYNAMIC_FILL_TOKENS`), én `tokenValue()` in `lib/graph/dynamic-fill.ts`.
  En vul in de `ExerciseConfig` in `lib/types.ts` als de bron dat vereist.
- **Nieuwe scoring-dimensie**: `lib/scoring/constants.ts` (`OUTCOME_DIMENSIONS`),
  `lib/graph/types.ts` (`OutcomeDimensionKey`), en alle plekken die de vector
  gebruiken (`graph-adapter.ts`, `outcome-round.ts`, etc.). Dit is een SemVer
  major van `SCORING_VERSION`.
- **Nieuw scenario-type**: `lib/types.ts` (`ScenarioType`) + optioneel een
  eigen template in `lib/graph/examples-*.ts`.

## Voorbeelden

- **Ingebouwd**: `lib/graph/examples-schoolvereniging.ts` (~2100 regels) is
  het referentiescenario. Draait tegen de test-suite (`schoolvereniging-scenario.test.ts`).
- **Templates**: `lib/builtin-templates.ts` — legacy templates uit de
  module-library tijd.
- **Wizard-output**: alles wat via `/admin/builder` → AI-wizard komt. Wordt
  opgeslagen als `ScenarioGraph` met `wizardSeed` gezet.
