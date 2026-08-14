# Architectuur — overdracht

Snapshot van de huidige codebase op het moment van overdracht. Als je een
nog-verder-terug lezing wilt: `docs/architecture/01_three_layer_logic.md` t/m
`05_data_model.md` bestaan nog, maar zijn **verouderd** — die beschrijven het
oude ExerciseConfig → Attack Chain → Module Library pad. Nu draait alles op
`ScenarioGraph` (`lib/graph/types.ts`). Zie onderaan voor per-bestand
verouderd-status.

## Routes en pagina's

Alle pagina's onder `app/`, Next.js App Router.

### Publiek (geen login)

- `/` — landing, rol-kiezer
- `/join` — deelnemer join-flow (sessiecode + naam + rol)
- `/play` — deelnemer sessie-view (na join)
- `/observe` — passieve kijk-view (grote scherm, zonder acties)
- `/login` — facilitator login

### Facilitator (na login)

- `/admin` — setup-form voor nieuwe sessie
- `/admin/prepare` — voorbereidingscherm (rollen briefen, deelnemers wachten)
- `/admin/dashboard` — live control-dashboard tijdens sessie
- `/admin/present` — presenter view voor het grote scherm
- `/admin/builder` — visuele scenariobuilder (react-flow graph)
- `/admin/report`, `/admin/report/[sessionId]`, `/admin/report/one-pager` — na afloop rapport
- `/admin/role-cards` — printbare rolkaarten
- `/admin/users` — facilitator-accounts beheren
- `/templates`, `/templates/builder` — templatebeheer

## API-routes

**41 routes**, allemaal onder `app/api/`. Alles server-side, `runtime = "nodejs"`,
`dynamic = "force-dynamic"`.

### Sessie-lifecycle (`app/api/session/`)

`create` · `join` · `start` · `state` (SSE stream) · `reset` · `set-mode` ·
`set-phase` · `next-round` · `prev-round` · `force-lock` · `skip-decision`

### Deelnemer-acties

`assign-role` · `submit-decision` · `annotate-inject` (+ `remove`) · `tag-inject` ·
`participant-view` · `ready` · `melding` · `regulatory-filing`

### Facilitator-acties

`push-inject` · `replot-injects` · `surprise-inject` · `special/trigger` (+
`complete`, `form`, `message`) · `report` · `score` · `supervision-report` ·
`graph-decision` · `group/create` · `group/join`

### Overig

`scenario-graph/` — CRUD voor scenariografen + drie AI-endpoints (`ai-fill`,
`ai-suggest-options`, `ai-wizard`). `templates/` — templatebeheer.
`events/` — timeline events. `auth/[...nextauth]/` — NextAuth.

## Modules (`lib/`)

Groot naar klein (schatting bytes):

- **`lib/graph/`** (~264K) — het scenariografen-domein. `types.ts` is
  authoritative source-of-truth voor `ScenarioGraph`, `RoundNodeData`,
  `InjectNodeData`, `DecisionNodeData`, etc. `compile.ts` / `engine.ts`
  runnen de state-machine, `dynamic-fill.ts` doet token-substitutie,
  `wizard-plan.ts` mapt AI-output naar graph, `role-adapter.ts` /
  `validate.ts` / `preview.ts` valideren.
- **`lib/scoring/`** (~212K) — de zes uitkomstdimensies (CONT/FOR/BC/JUR/VER/KOS),
  role-resolution, event-mode phase-machine. Pure, geen I/O. Aparte
  documentatie in `SCORING.md`. Zie CONTEXT.md voor de aliasconflicten.
- **`lib/wizard/`** (~84K) — AI-wizard framework, pipeline en config.
  `framework.ts` orchestreert meerstaps LLM-calls met validatie en
  regeneratie. `pipeline.ts` bouwt de prompts.
- **`lib/engine/`** (~56K) — round-phases, role-distribution, supervision.
- **`lib/modules/`** (~28K) — losstaande scenario-modules (ransomware,
  insider, etc.). Legacy laag; nieuwe scenario's komen uit de graph.
- **`lib/capabilities/`, `lib/goals/`** (~12K elk) — enum-lookups voor
  capabilities en learning objectives.

Overige belangrijke bestanden:

- `lib/session-store.ts` — sessie-state (in-memory + KV persistence). Bevat
  `finalizeDecision`, `nextRound`, `submitDecision`, etc.
- `lib/session-next-action.ts` — client-safe next-action descriptor voor de
  dashboard-knoppen.
- `lib/api-client.ts` — client-side fetch-wrapper voor de API.
- `lib/use-session-stream.ts` — React-hook voor de SSE stream + 4s polling
  fallback.
- `lib/types.ts` — de 8 rollen (`Role`), `ROLE_META`, `Urgency`,
  `SessionState`, `SubmittedDecision`, en losse types die overal terugkomen.

## Realtime laag

**SSE + polling fallback**, geen websockets.

- `/api/session/state` (`app/api/session/state/route.ts`) opent een SSE-stream
  per client.
- `emit()` in `lib/session-store.ts` publiceert events (`phase_changed`,
  `state`, `decision_submitted`, etc.).
- Op Vercel (multi-instance) valt de SSE-stream niet altijd samen met de
  mutating instance, daarom polt `useSessionStream` óók elke 4 seconden.
- Presenter/participant/facilitator gebruiken allemaal dezelfde hook; de
  view filtert facilitator-only velden client-side via `toParticipantState`.

## Deploy-flow

Push naar `main` = productie op Vercel. Preview deployments per branch/PR
automatisch. Ruleset op `main` (sinds 2026-08-13) blokkeert directe pushes —
zie `docs/overdracht/status.md`.

## Environment variables

Volledig in `SETUP.md`. Kort:

- **Local dev**: geen env vars nodig. Sessies in-memory, auth uit.
- **Vercel prod (verplicht)**: `AUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`
- **Vercel KV (aanbevolen)**: `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`
  — worden automatisch geïnjecteerd bij het aanmaken van de KV-store in Vercel.
- **AI-generatie**: `ANTHROPIC_API_KEY`. Optioneel voor local dev als je AI
  wilt testen.

## Tests

**31 test-bestanden** onder `lib/`. Runner: Vitest. Belangrijk:

- `lib/scoring/__tests__/` — scoring engine tests, role-resolution
- `lib/graph/__tests__/` — scenario-schema tests, waaronder
  `schoolvereniging-scenario.test.ts` (integratietest tegen de bestaande
  onderwijs-scenario)
- `lib/wizard/__tests__/` — pipeline + framework tests, inclusief de "Rule 4:
  fabel mag geen enige setup zijn"-tests
- `lib/__tests__/` — cross-module tests, o.a. `next-action.test.ts`

Er zijn **geen** E2E tests (Playwright/Cypress). UI-regressies worden alleen
handmatig gevangen.

## Verouderde documenten

Wat er in `docs/architecture/` staat is **geschreven vóór de graph-refactor**
en beschrijft een pipeline die er zo niet meer is. Concreet:

- `01_three_layer_logic.md` — noemt "ExerciseConfig → Attack Chain →
  Module Library → AI Generator → Bridge → Scenario". De AI-wizard
  produceert nu een `ScenarioGraph` direct, niet via de bridge. **Grotendeels
  verouderd.**
- `02_module_library.md` — beschrijft `lib/modules/` als hoofd-mechanisme.
  Die modules zijn er nog, maar nieuwe scenario's komen uit de graph, niet uit
  modules. **Deels verouderd.**
- `03_decision_frameworks.md` — BOB/OODA/DAIR/NIST-IR keuze. De BOB-classificatie
  op `EvaluationAspect` bestaat nog, maar het framework-keuze-veld in de
  setup-form is voor zover ik zie niet meer relevant voor de graph. **Verifieer
  voor je overdracht.**
- `04_ir_retainer_scope.md` — mogelijk relevant; `IrRetainerProfile` en
  gerelateerde types leven in `lib/types.ts` + `lib/graph/types.ts`
  (`EYE_SECURITY_RETAINER`).
- `05_data_model.md` — de types zijn hier gedeeltelijk verouderd. De
  authoritative source is `lib/graph/types.ts` en `lib/types.ts`. **Grotendeels
  verouderd.**

De AUDIT.md, BUILDER-GAP.md, PROMPT_NIS2_SUPERVISION.md,
PROMPT_SCENARIO_BUILDER_V2.md in de repo-root zijn allemaal
werkende-prompts / audit-notities uit eerdere sessies. Voor overdracht niet
onmisbaar. `CHANGELOG.md`, `AUDIT.md` en de PROMPT_-bestanden kunnen
gearchiveerd naar `docs/overdracht/archief/` als je opruimt.
