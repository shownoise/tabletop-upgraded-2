# OPSCHONING.md — audit van de scenario-config

Deel A §10. Puur inventarisatie, **verwijder niets**. Elk item krijgt: waar gebruikt · nodig voor de scoring (`@exercise/scoring`) · gebruikt door de builder · advies (**behouden / vervalt / onduidelijk**). Gesorteerd op hoeveel opruiming er in principe mogelijk is.

Bepaling "gebruikt" via `grep` in `app/`, `components/`, `lib/` (buiten `lib/types.ts` en `lib/scoring/`). Twijfelgevallen zijn expliciet `onduidelijk` met de openstaande vraag.

Deze lijst wacht op review vóór een tweede ronde waarin daadwerkelijk verwijderd wordt.

---

## 1. Legacy modules (grootste opruimwinst)

### `lib/scenario-generator.ts` — 937 regels, 101 KB
- **Waar gebruikt:** `app/api/session/create/route.ts:531` als **fallback** wanneer de graph-gebaseerde flow niet beschikbaar is. Ook geïmporteerd door `app/api/templates/route.ts` (voor niet-graph-templates) en `lib/session-store.ts` (mogelijk indirect via type-imports).
- **Scoring:** nee.
- **Builder:** nee — de builder is een graaf; deze module bouwt lineaire `Scenario`-objecten via templates + AI-directieven.
- **Advies:** **vervalt** — na overgang naar de graph-only flow.
- **Openstaand:** is er nog één werkend niet-graph-scenario in productie? Zo nee → hele module weg, plus de fallback-tak in `create/route.ts:521-535`.

### `lib/builtin-templates.ts` — 666 regels, 42 KB
- **Waar gebruikt:** `app/api/templates/route.ts:4` (`BUILTIN_TEMPLATES`) en indirect via `template-store.ts`.
- **Scoring:** nee.
- **Builder:** onduidelijk — dit zijn "starter"-scenarios; de graph-builder heeft eigen voorbeelden in `lib/graph/examples-*.ts`.
- **Advies:** **onduidelijk** — als de graph-voorbeelden dekkend zijn, weg. Anders vervangen door graph-voorbeelden.
- **Openstaand:** worden `BUILTIN_TEMPLATES` in de facilitator-UI nog geladen? Zo ja, welke velden ervan gebruikt?

### `lib/scenario/generator.ts` — 17.3 KB
- **Waar gebruikt:** `app/api/session/create/route.ts:391` (`generateScenarioInstance`) — dit is de **hoofdflow** voor AI-gestuurde scenario-generatie.
- **Scoring:** nee.
- **Builder:** ja — dit is de motor achter "genereer scenario uit ExerciseConfig".
- **Advies:** **behouden**, mits overlappende functionaliteit met de graph-flow duidelijk is. Deel B §11 buiten scope-lijst zegt "AI-tailoring blijft eruit" — nagaan of deze module niet stiekem AI-tekst-aanpassing doet die buiten scope raakt.

### `lib/scenario/bridge.ts` en `lib/scenario/prompts.ts` — samen 19 KB
- **Waar gebruikt:** intern in `lib/scenario/generator.ts`.
- **Scoring:** nee.
- **Advies:** **behouden** zolang `generator.ts` blijft.

---

## 2. `ExerciseConfig` — velden (`lib/types.ts:550`)

Zetup-config vanuit `components/admin/setup-form.tsx`. Elke rij: naam · scoring? · builder? · advies.

| Veld | Scoring? | Builder? | Advies |
|---|---|---|---|
| `sector` | nee (via dynamic-fill token) | ja (`{{sector}}`) | **behouden** |
| `companySize` | nee | ja (`{{companySize}}`) | **behouden** |
| `criticalSystems` | nee | ja (`{{criticalSystems}}`) | **behouden** |
| `crownJewels` | nee | ja (`{{crownJewels}}`) | **behouden** |
| `scenarioType` | nee | ja (scenario-selectie) | **behouden** |
| `duration` | nee | ja | **behouden** |
| `irTemplateText` | nee | onduidelijk — used in `hasIrPlan` check (`session-store.ts:1200`) | **onduidelijk** — is het IR-plan uit template nog werkelijk relevant nu retainer hard is (`EYE_SECURITY_RETAINER`)? |
| `aiIntensity` | nee | onduidelijk | **onduidelijk** — laat de graph-flow deze nog gebruiken? Zo nee: vervalt |
| `specialsMode` | nee | onduidelijk | **onduidelijk** — specials zijn wel actief maar toggle-usage onduidelijk |
| `itMaturity` | nee | ja (legacy scenario-generator) | **onduidelijk** — na removal van scenario-generator vervalt dit |
| `securityCapability` | nee | ja (legacy) | **onduidelijk** — idem |
| `existingPlans` | nee | ja (`hasIrPlan` check) | **onduidelijk** — nauwelijks gebruikt |
| `exerciseGoal` | nee | onduidelijk | **onduidelijk** |
| `teamStructure` | nee | onduidelijk | **onduidelijk** |
| `teamCount` | nee | onduidelijk | **onduidelijk** |
| `roundCount` | nee | ja (in legacy generator + directive-builder) | **onduidelijk** — vervalt met scenario-generator |
| `timerPerRound` | nee — scoring gebruikt `designTimeMinutes` (gap 1) | ja | **behouden** |
| `difficulty` | nee | onduidelijk | **onduidelijk** |
| `selectedRoles` | nee — scoring bouwt roster uit participants | ja (rolfilter in template generator) | **behouden** |
| `decisionFramework` | nee | onduidelijk (BOB / OODA etc. UI-context) | **onduidelijk** |
| `goalId` | ja — huidige `AssessmentEvent`-flow gebruikt goalId voor dimensie-mapping (`session-store.ts:1254`) | ja | **behouden** (mogelijk vervalt na volledige migratie naar `@exercise/scoring`) |
| `graphId` | ja — koppelt sessie aan graph | ja | **behouden** |
| `irRetainerName` | nee (huidige retainer is hard `EYE_SECURITY_RETAINER`) | ja (in dynamic-fill token `{{irRetainerName}}`) | **behouden** — nog nuttig als label |
| `irRetainerProfile` | nee — `EYE_SECURITY_RETAINER` is de default (Deel B PROMPT_COMPLIANCE_CLEANUP) | ja (via `handleLoad`) | **onduidelijk** — mogelijk vervalt volledig als retainer altijd Eye is |
| `phaseAutoAdvance` | nee | ja (round-phase-flow) | **behouden** |

**Grote schoonmaakkandidaten** in `ExerciseConfig`: alles dat samen met `scenario-generator.ts` vervalt (aiIntensity, itMaturity, securityCapability, roundCount, difficulty, teamStructure, teamCount, decisionFramework, exerciseGoal, existingPlans).

---

## 3. `RoleAction` — velden (`lib/types.ts:169`)

| Veld | Scoring? | Builder? | Advies |
|---|---|---|---|
| `id` | ja | ja | **behouden** |
| `label` | nee | ja | **behouden** |
| `description` | nee | ja | **behouden** |
| `allowedRoles` | ja (gap 8 owner-check) | ja | **behouden** |
| `isRecommended` | nee | ja (UI-badge) | **behouden** |
| `irPlanAligned` | nee | ja (`isIrDeviation` flag) | **behouden** |
| `consequence` | nee | ja (UI-tekst) | **behouden** |
| `scoreImpact` | ja (legacy single-dim) | ja | **onduidelijk** — vervalt zodra `outcomeVector` (gap 2) landt |
| `linkedDimension` | ja (legacy) | ja | **onduidelijk** — idem |
| `scoreImpacts` | ja (multi-dim proces) | ja | **behouden** (blijft naast outcomeVector, spec §7.8) |
| `qualityRank` | ja (review-fase reveal) | ja | **behouden** |
| `facilitatorCommentary` | nee | ja | **behouden** |
| `lessonLearned` | nee | ja (spec `debriefNote` alias) | **behouden** |
| `respondsToMisleading` | ja (BOB-training penalty, `session-store.ts:1293`) | ja | **behouden** |
| `pushesInject` | nee | ja (chaser/response mechaniek) | **behouden** |
| `supervisionAreas` | nee (coverage check op graph) | ja | **behouden** |

Weinig ruimte hier — legacy `scoreImpact`+`linkedDimension` zijn de enige twee kandidaten om te laten vervallen zodra multi-dim volledig is (gap 2).

---

## 4. `Inject` — velden (`lib/types.ts:436`)

| Veld | Scoring? | Builder? | Advies |
|---|---|---|---|
| `id` | ja | ja | **behouden** |
| `type` | nee | ja (UI-render) | **behouden** |
| `channel` | nee | ja (UI-render — legacy en nieuwe channels) | **behouden**, na consolidatie legacy-channels overwegen |
| `title` | nee | ja | **behouden** |
| `content` | nee | ja | **behouden** |
| `urgency` | nee | ja (UI-tag) | **behouden** — ≠ `importance` (gap 3) |
| `source`, `senderName`, `senderHandle` | nee | ja (UI-render) | **behouden** |
| `timestamp` | nee (scoring gebruikt event-log timestamps) | ja (UI-string) | **behouden** |
| `targetTeam` | ja (routing) | ja | **behouden** |
| `targetRoles` | ja (routing) | ja | **behouden** |
| `nis2Relevant` | nee (compliance-flag, ≠ `importance`) | ja (coverage) | **behouden** |
| `deliverySeconds` | nee | ja (drip-delivery UI) | **behouden** |
| `reliability` | ja (BOB fact-check score, `lib/engine/fact-check-score.ts`) | ja | **behouden** |
| `groundTruthAnnotations` | ja (span-level BOB) | ja | **behouden** |
| `supervisionAreas` | nee | ja (coverage) | **behouden** |

Geen kandidaten voor removal — alles wordt gebruikt. Wel note: **`channel`** heeft twee sets (legacy + nieuw) — consolideren zonder verlies is een aparte klus.

---

## 5. `SessionState` — velden (`lib/types.ts:685`)

40+ velden. Meerdere zijn stateful-runtime — behouden. Hieronder alleen twijfelgevallen.

| Veld | Scoring? | Builder? | Advies |
|---|---|---|---|
| `mode: SimulationMode` | Deel B §2 (na gap 28 relevant) | ja | **onduidelijk** — hergebruiken of vervangen (assumption 3.16) |
| `roundPhase` | ja (fase-anker) | ja | **behouden** |
| `submittedDecisions` | ja | ja | **behouden** |
| `governanceFlags` | nee | ja (UI + rapport) | **behouden** |
| `specialEvents` | nee (specials scoren los) | ja | **behouden** |
| `documents` | nee | ja (rolkaarten Deel B §7.5) | **behouden** |
| `facilitatorRoundScores` | ja (grofmazig, wordt vervangen door gap 12) | ja | **onduidelijk** — vervalt zodra per-dim facilitator-slider (gap 12) er is |
| `specialScores` | nee | ja | **behouden** |
| `assessmentEvents` | ja (huidige scoring input) | ja | **onduidelijk** — vervalt zodra `@exercise/scoring` de scoring-bron is |
| `activeDiscussionPhase` | ja (fase-timing) | ja | **behouden** |
| `currentDiscussionPrompt`, `currentDiscussionPhaseIndex`, `currentDiscussionPhaseEffectiveSeconds`, `currentDiscussionPhasePaused`, `phaseAutoAdvancePaused` | nee | ja (fase-runtime UI) | **behouden** — verwant, zit onder round-phase-flow |
| `graph`, `graphState` | ja | ja | **behouden** |
| `injectRoutePlan` | ja (routing) | ja | **behouden** |
| `activeRoundPhaseState` | ja (fase-anker) | ja | **behouden** |
| `factChecks`, `injectAnnotations` | ja (BOB) | ja | **behouden** |
| `notifications`, `meldplichtPrompts` | ja (notification duty) | ja | **behouden** |
| `incidentDetectedAt` | ja (deadline-anker) | ja | **behouden** |
| `flags` | ja (chaser-conditie) | ja | **behouden** |
| `retainerState` | ja (retainer-activatie scoring) | ja | **behouden** |
| `supervisionReportEdits` | nee | ja (auditor-view) | **behouden** |
| `activeDecision` | ja (participant-projectie) | ja | **behouden** |

Grootste kandidaten voor removal na volledige migratie naar `@exercise/scoring`:
- **`assessmentEvents`** — vervalt als de scoring-bron `@exercise/scoring` wordt en herberekening uit event-log (gap 18) canoniek is.
- **`facilitatorRoundScores`** — vervalt met per-dim slider (gap 12).

---

## 6. `ScenarioGraph` en node-data velden

Kleine set — recente code. Vrijwel niets vervalt.

| Veld | Scoring? | Builder? | Advies |
|---|---|---|---|
| `ScenarioGraph.version` | ja (health report gap 38) | ja | **behouden** |
| `ScenarioGraph.scenarioType` | nee | ja | **behouden** |
| `ScenarioGraph.irRetainerName`, `irRetainerProfile` | nee | ja | **onduidelijk** — retainer is hard `EYE_SECURITY_RETAINER`, waardegehalte laag |
| `ScenarioGraph.irPlaybook` | nee | ja (participant chrome UI) | **behouden** |
| `ScenarioGraph.meldplicht` | ja (chaser-conditie + supervision) | ja | **behouden** |
| `ScenarioGraph.features` | ja (feature-gates) | ja | **behouden** |
| `RoundNodeData.timerMinutes` | Deel B (gap 40) | ja | **behouden** |
| `RoundNodeData.bobPhase` | nee | ja (UI-badge) | **behouden** |
| `RoundNodeData.openingPrompts` | nee | ja (UI-tekst) | **behouden** |
| `RoundNodeData.facilitatorPerspective` | nee | ja | **behouden** |
| `RoundNodeData.evaluationAspects` | nee — UI-filter voor inspector | ja | **behouden** |
| `RoundNodeData.aiPromptTemplate` | nee — runtime AI-fill | ja | **behouden** |
| `RoundNodeData.dynamic` | ja indirect (via token-fill) | ja | **behouden** |
| `InjectNodeData.evaluationAspects` | nee | ja | **behouden** |
| `InjectNodeData.dynamic` | ja indirect | ja | **behouden** |
| `InjectNodeData.aiPromptTemplate` | nee | ja | **behouden** |
| `DecisionNodeData.measuredBy` | nee | ja | **behouden** — bepaalt participant vs. facilitator-trigger |
| `DecisionNodeData.triggerRole` | nee | ja | **behouden** |
| `DecisionNodeData.advancesGraph` | nee | ja (soft-decision) | **behouden** |
| `DecisionNodeData.perRole` | nee | ja | **behouden** |
| `DecisionNodeData.supervisionAreas` | nee | ja | **behouden** |
| `DecisionNodeData.options[].scoreImpact` / `linkedDimension` | legacy single-dim | ja | **onduidelijk** — vervalt na multi-dim migratie (gap 2) |
| `ChaserNodeData` (heel node-type) | ja | ja | **behouden** |
| `OutcomeNodeData.scoreImpact`, `linkedDimension` | legacy single-dim | ja | **onduidelijk** — vervalt na gap 2 |
| `OutcomeNodeData.scoreRange` | ja (outcome-selection op cumulatief) | ja | **behouden** |
| `SpecialNodeData.thresholds` (numeriek predicate) | ja (special-scoring) | ja | **behouden** |

---

## 7. Bestandsgroepen zonder verdere details

Nog niet per-veld doorgemeten; kandidaat voor volgende ronde:

- `lib/document-generator.ts` (12.5 KB) — per-rol hypothetische documenten. **Onduidelijk** — hoeveel wordt echt gebruikt in de UI-generator?
- `lib/i18n.ts` (17.2 KB) — vertalingen. **Behouden** (basis-functionaliteit).
- `lib/render-markdown.ts` (643 B) — mini render helper. **Behouden**.
- `lib/format.ts` (1.8 KB) — utility. **Behouden**.
- `lib/inject-routing.ts` (3.1 KB) — bestaande routing. **Onduidelijk** — mogelijk vervangbaar door `lib/graph/adaptive-routing.ts` na migratie. Deel B §1.3 vereist domein-fallback; bestaande module doet rol-fallback.
- `lib/graph/ai-runtime-fill.ts` (4.1 KB) — AI-runtime substituting. **Behouden** — recent, actief.
- `lib/graph/preview.ts`, `analyze.ts`, `wizard-plan.ts` — builder-hulp. **Behouden**.
- `lib/graph/examples-*.ts` (5 files, samen ~215 KB!) — voorbeelden. **Onduidelijk** — 5 grote example-files: is die redundantie nodig? `examples.ts` (53K), `examples-nis2.ts` (59K), `examples-full-showcase.ts` (27K), `examples-nis2-showcase.ts` (25K), `examples-meldplicht-pressure.ts` (29K). Consolidatie kans, maar geen scoring-blocker.
- `lib/capabilities/`, `lib/chains/`, `lib/goals/`, `lib/modules/` — legacy assessment-modelmodules. **Onduidelijk** — na migratie naar `@exercise/scoring` mogelijk hele mappen weg.

---

## 8. Openstaande vragen (voor de tweede ronde)

1. Blijft de niet-graph flow (`lib/scenario-generator.ts` + `create/route.ts:521-535` fallback) in gebruik? Zo nee → hele module weg, plus tientallen `ExerciseConfig`-velden.
2. `BUILTIN_TEMPLATES` uit `lib/builtin-templates.ts` — nog geladen in UI? Als graph-voorbeelden dekken → weg.
3. Behouden we `assessmentEvents` op `SessionState` naast `@exercise/scoring`? Voorstel: nee — laten vervallen zodra scoring-package canoniek is.
4. `SimulationMode`-hergebruik of nieuwe `executionMode` (assumption 3.16 uit ALIGNMENT.md)?
5. IR-retainer: één hard-coded `EYE_SECURITY_RETAINER` — wél of niet `irRetainerName`/`irRetainerProfile`/`irTemplateText` behouden op `ExerciseConfig`?
6. `lib/capabilities/`, `chains/`, `goals/`, `modules/` — na migratie naar `@exercise/scoring` weg? (Grootste opruiming, ~50 KB code.)
7. `lib/graph/examples-*.ts` — consolideren tot 1-2 canonical files, of intact laten?

---

**Stop hier.** Wacht op review + antwoorden op de openstaande vragen. Daarna tweede ronde: daadwerkelijk verwijderen wat groen is en `ExerciseConfig` schoonmaken.
