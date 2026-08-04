# AUDIT.md — Frankenstein Inventory

Read-only Phase-A output. No code was changed. This file names the concrete duplications, dead branches, and root-cause bugs I found in the current codebase and marks where I need a decision from you before deleting.

All file:line refs are against the tree as-of this audit. Refs may drift if you edit before reading.

---

## 0. Executive summary

The runtime is **graph-native**: a session created from a `ScenarioGraph` (nodes+edges) is executed directly against that graph. But every legacy generation is still lying next to it:

- Two scenario schemas (`Scenario` and `ScenarioGraph`) both live in `SessionState`, bridged at runtime.
- Two role vocabularies (9 app roles + 10 spec roles), bridged by an adapter — this is the direct cause of the reveal-panel showing `CRISIS_LEAD` for every domain.
- One canonical outcome scoring engine (6 outcome dims + 7 process dims in `lib/scoring/`) plus a **second, orphaned** 8-dim assessment engine in `lib/engine/`, plus a gamification `POINT_EVENTS` constant that nothing consumes.
- Phase state is spread across **five** `SessionState` fields: `roundPhase`, `activeRoundPhaseState`, `activeDiscussionPhase`, `currentDiscussionPhaseIndex`, `currentDiscussionPrompt`. Two of them (`activeDiscussionPhase` + `currentDiscussionPhaseIndex`) are BOB/OODA sub-phases that must be deleted per the brief.
- `RoundPhase` has **5 values** (`inject | discussion | decision | lock | review`), not the 4 the brief wants. `lock` is auto-inserted in ASSESSMENT mode too.
- The `REVIEW → next round` transition is genuinely unreachable via auto-advance — `tickRoundPhase()` returns without doing anything when the current phase is `review` (session-store.ts:113–152).
- 10 PROMPT_*.md directive files sit at repo root, plus 3 more untracked briefs (`ALIGNMENT.md`, `OPSCHONING.md`, `CONTEXT.md`). Some contradict this one.

Nothing in this audit deletes anything yet. Approvals I need before Phase B are collected in §10.

---

## 1. Engine inventory (by concern)

### 1.1 Scenario schema / authoring

| File | Size | Purpose | Runtime path? |
|---|---|---|---|
| `lib/types.ts` (`Scenario`, `Round`, `Inject`, `RoleAction`, l.445–492) | 25KB (whole file) | **Legacy** flat scenario schema | On path — `SessionState.scenario` is required |
| `lib/graph/types.ts` (`ScenarioGraph`, `GraphNode`, `GraphEdge`) | 12KB | **Canonical** node/edge schema used by builder | On path — `SessionState.graph?` |
| `lib/types/scenario-instance.ts` (`ScenarioInstance`, `ModuleInstance`, `RichInject`) | 4KB | Third schema, produced by AI generator only | Bridged to legacy `Scenario` before storage |
| `lib/scenario/bridge.ts` | 4KB | `scenarioInstanceToScenario(instance)` — AI output → legacy | Live (imported by `create/route.ts:453`) |
| `lib/graph/compile.ts` | 3KB | `compileLinearGraph(graph)` — graph → legacy `Scenario` projection | Live (imported by `create/route.ts:557`) |
| `lib/scenario/generator.ts` | 18KB | AI generation orchestrator (haiku / sonnet) | Live |
| `lib/scenario/prompts.ts` | 15KB | AI prompt templates for generator | Live |
| `lib/scenario/sanitize.ts` | <1KB | Post-AI cleanup | Live |
| `lib/modules/definitions.ts` | 18KB | `ModuleDefinition` catalog (10 modules) — used only by setup form & AI prompt directives | Authoring-side only |
| `lib/modules/defaults.ts` | 3KB | Default module→goal mapping | Authoring |
| `lib/goals/registry.ts` + `goals/decision_making.ts` + `goals/types.ts` | 5KB total | 7 `GoalId`s → prompt directives | Authoring only |
| `lib/capabilities/registry.ts` + `governance_decisions.ts` + `gamification.ts` + `types.ts` | 4KB | 8 `CapabilityId`s → prompt directives | Authoring only |
| `lib/chains/{bec_cfo_fraud,insider_threat,ransomware_double_extortion,supply_chain_compromise}.ts` | 19KB total | **Preset scenario chains** (older gen) | **Orphaned — 0 imports** |
| `lib/builtin-templates.ts` | 42KB | Static `ScenarioGraph` templates for builder gallery | Live via `/api/templates` |
| `lib/template-store.ts` | 3KB | KV wrapper for graph templates | Live |
| `lib/template-types.ts` | 4KB | Types for template store | Live |

### 1.2 Session lifecycle & state

| File | Size | Purpose | Notes |
|---|---|---|---|
| `lib/session-store.ts` | **112KB** | In-memory + Vercel KV persistence, phase mutations, decision handling, adaptive routing, chaser evaluation, timeline events, SSE broadcast | The beast. Every generation added a field and a mutator. 80+ optional fields on `SessionState`. |
| `lib/db.ts` | 14KB | KV client wrapper | Live |
| `lib/use-session-stream.ts` | 3KB | Client SSE hook | Live |
| `lib/team-roster.ts` | <1KB | UI-only grouping helper by `ROLE_META[x].team` | Live but decorative |

### 1.3 Round/phase engine

| File | Size | Purpose | Notes |
|---|---|---|---|
| `lib/engine/round-phases.ts` | 1KB | `ROUND_PHASE_TIMINGS` — 5 phases with weights (`inject`, `discussion`, `decision`, `lock`, `review`) | Includes `lock` — must go per brief |
| `lib/types.ts:150` | — | `type RoundPhase = 'inject' \| 'discussion' \| 'decision' \| 'lock' \| 'review'` | Source of truth for phase enum |
| `lib/engine/facilitator-support.ts` | 7KB | Facilitator round-context builder (uses `AssessmentDimensionId` from `lib/engine/types.ts`) | On path only for legacy dashboard; check dedup vs the graph runtime |

Round vs. phase counters live inside `SessionState`. §3 below.

### 1.4 Scoring / assessment / feedback

| File | Size | Purpose | Category |
|---|---|---|---|
| `lib/scoring/index.ts` | 3KB | Public API — `scoreExercise()` entry | **KEEP** — canonical entry |
| `lib/scoring/score-exercise.ts` | 6KB | Orchestrator — runs 7 process dims + 6 outcome dims per round | **KEEP** |
| `lib/scoring/outcome-round.ts` | 3KB | Computes per-round 6-dim outcome + 0–100 "Punten" | **KEEP** — this is the "Punten: 38" |
| `lib/scoring/aggregate.ts` | 2KB | Weighted geometric mean of process dims | **KEEP** |
| `lib/scoring/constants.ts` | 3KB | `OUTCOME_DIMENSIONS`, `PROCESS_DIMENSIONS`, `DEFAULT_DOMAIN_OWNERSHIP`, `SCORING_VERSION='1.0.0'` | **KEEP** |
| `lib/scoring/dimensions/{besluit,mandaat,aanname,adapt,extern,volhoud,delen}.ts` | 25KB total | **7 process dimensions** (see §4) | **KEEP** if 7 is right; the brief says 6 |
| `lib/scoring/report.ts` | 7KB | `AssessmentReport` builder (called by `/api/session/score?format=report`) | **KEEP** |
| `lib/scoring/reveal.ts` | 7KB | Per-round choice-distribution + standings | **KEEP** |
| `lib/scoring/points.ts` | 3KB | Leaderboard/tie-breaking | **KEEP** |
| `lib/scoring/event-mode.ts` | 6KB | EVENT-mode phase-lock behaviour | **KEEP** — but only if we keep event mode |
| `lib/scoring/graph-adapter.ts` | 16KB | Graph nodes+session events → scoring input | **KEEP** — this is the only bridge from app to scoring |
| `lib/scoring/role-resolution.ts` | 3KB | Domain→role fallback chain resolver | **KEEP** but redesign per brief §C2 |
| `lib/scoring/calibration.ts` | 2KB | Confidence-1..5 correlation scorer | KEEP if we keep confidence input; brief doesn't require it |
| `lib/scoring/mode-matrix.ts` | 2KB | Which measurements are available in which mode | Marginal — probably fold in |
| `lib/scoring/types.ts` | 8KB | Scoring package types | KEEP |
| `lib/scoring/report-markdown.ts` | 4KB | Markdown export | **Unused by any route** — probably dead |
| `lib/scoring/scenario-health.ts` | 4KB | Graph validation | **Unused by any route** — probably dead |
| `lib/scoring/dry-run.ts` | 5KB | Simulation helper | **Unused outside its own tests** — probably dead |
| `lib/scoring/reference-case.ts` | 12KB | Golden test data | Test-only |
| `lib/scoring/role-cards.ts` | 3KB | Role metadata for reveal | **Unused** — probably dead |
| `lib/engine/types.ts` (l.20–28: `AssessmentDimensionId`; l.57–65: `POINT_EVENTS`) | 3KB | **Duplicate 8-dim assessment enum + gamification constants** | **DELETE** — dead alt-scoring |
| `lib/engine/assessment.ts` | 2KB | `buildSessionAssessment()` — 8-dim aggregator, called only by `/api/session/debrief` | **DELETE** with debrief route |
| `lib/engine/debrief.ts` | 3KB | Advice generator around the 8-dim system | **DELETE** |
| `lib/engine/fact-check-score.ts` | 4KB | Reliability-tag scoring | Check if consumed anywhere; probably dead |
| `lib/engine/supervision.ts` | 26KB | NIS2 compliance report generator | **Separate concern, keep** — feeds `/api/session/supervision-report` |
| `lib/engine/supervision-rules.ts` | 2KB | Static rule map | Keep with supervision.ts |
| `lib/engine/facilitator-support.ts` | 7KB | Round-context builder using the 8-dim system | **Likely dead once 8-dim goes** — verify each consumer |
| `lib/types.ts:152` (`AssessmentDimensionKey`) | — | **Second definition** of the 8-dim enum | Same set, duplicate type |
| `lib/report/export.ts` | 10KB | PDF/HTML export | Keep — output layer |

### 1.5 Role model

| File | Size | Purpose | Notes |
|---|---|---|---|
| `lib/types.ts:6` (`Role`) + `lib/types.ts:17–132` (`ROLE_META`) | — | **9 app roles** — the playable set | See §6 |
| `lib/types.ts:134–144` (`ROLE_FALLBACK`) | — | Per-role fallback chains | Brief says: **delete**, replace with engine `distributeRoles()` |
| `lib/scoring/constants.ts:36–46` (`DEFAULT_DOMAIN_OWNERSHIP`) | — | **10 spec roles** (`CRISIS_LEAD`, `SECURITY_LEAD`, `LEGAL_DPO`, `FINANCE_PROC`, `COMMS`, `HR`, `BUSINESS_OWNER`, `IT_LEAD`, `RETAINER_LIAISON`, +implicit `NPC`) mapped per domain, chain ends at `CRISIS_LEAD` | Direct cause of `CRISIS_LEAD` reveal-panel bug |
| `lib/graph/role-adapter.ts` | 4KB | `APP_ROLE_TO_SPEC` (9→10 map), `APP_ROLE_TO_DOMAINS` | Bridges the two role vocabularies |
| `lib/scoring/role-resolution.ts` | 3KB | Snapshot resolver, walks fallback chains | Live |

### 1.6 UI — facilitator & participant

| Path | Live? | Notes |
|---|---|---|
| `/admin` → `SetupForm` (34KB) | Live | Session-creation form |
| `/admin/builder` → `builder/canvas.tsx` (26KB) + editors/nodes/edges/inspector | Live | Graph editor |
| `/admin/dashboard` → `control-dashboard.tsx` (**55KB**) | **Live — this is the runtime facilitator view** | |
| `/admin/story` → **redirects to `/admin/dashboard`** (see `app/admin/story/page.tsx:6`) | **Dead route** | Corresponding `story-view.tsx` (39KB) is dead source |
| `/admin/present` → `present-view.tsx` (21KB) | Live | Big-screen mirror for the room |
| `/admin/prepare` → `prepare/page.tsx` (13KB) | Live | Alt setup screen — overlaps with `/admin` |
| `/admin/report` → `report-view.tsx` (26KB) | Live | Post-session report |
| `/admin/role-cards` | Live but standalone | Prints role cards |
| `/admin/users` | Live | User admin |
| `/join`, `/login`, `/play`, `/observe`, `/templates`, `/templates/builder` | Live | Participant flows |
| `components/admin/control-dashboard.tsx` | Live | Facilitator hub — imports `RevealPanel`, `SpecialsPanel`, `InjectControls`, `SupervisionReport`, `ScoringPanel`, `DimensionScoresSection`, `GraphPathPanel`, `InjectRoutePlan`, `FactCheckPanel`, `Decisions`, `NotificationTracker`, `ParticipantsList`, `GroupProgress`, `LessonsLearnedSection` |
| `components/admin/reveal-panel.tsx` | **Live** — imported at `control-dashboard.tsx:24`, rendered `:1020` — displays `Punten` on `:89` | Bugs live here (§8) |
| `components/admin/story-view.tsx` (39KB) | **Dead** — only page referencing it redirects away | Delete |
| `components/admin/scenario-summary.tsx` | **Dead** — 0 external imports | Delete |
| `components/admin/facilitator-debrief.tsx` (9KB) | **Dead** — 0 external imports | Delete |
| `components/participant/decision-gate.tsx` | **Dead** — 0 external imports (the string appears only in a builtin-templates comment) | Delete |
| `components/participant/play-view.tsx` (**60KB**) | Live — main participant view | Ripe for split, but leave for the state refactor |
| Everything else in `components/participant/` | Live | Verified imports |
| `components/admin/inject-controls.tsx` (15KB), `specials-panel.tsx` (7KB), `report-view.tsx` (26KB), `setup-form.tsx` (34KB), `dimension-scores-section.tsx` (11KB), `scoring-panel.tsx` (12KB), `graph-report-section.tsx`, `graph-path-panel.tsx`, `inject-route-plan.tsx`, `fact-check-panel.tsx`, `supervision-report.tsx` (15KB), `decisions-view.tsx`, `event-mode-help.tsx`, `notification-tracker.tsx`, `facilitator-notes.tsx`, `lessons-learned-section.tsx`, `participants-list.tsx`, `group-progress.tsx` | Live | All imported by dashboard/report |

### 1.7 API surface (33 routes under `/api/session`)

Confirmed live via client fetch:
`create`, `state`, `join`, `ready`, `assign-role`, `start`, `next-round`, `prev-round`, `set-phase`, `set-mode`, `submit-decision`, `skip-decision`, `graph-decision`, `push-inject`, `surprise-inject`, `force-lock`, `reset`, `score`, `supervision-report`, `report`, `notifications`, `special/message`, `special/form`, `special/trigger`, `special/complete`, `group/create`, `group/join`, `retainer-activation`, `meldplicht-prompt/dismiss`, `meldplicht-prompt/manual`, `tag-inject`, `annotate-inject`, `annotate-inject/remove`.

**Suspect dead / possibly dead** (no fetch call site found — needs one more grep pass in Phase B before deletion):
- `discussion-phase` — BOB/OODA sub-phase transitions. Deletable when BOB goes (Phase B).
- `phase-pause` — auto-advance pause; may be facilitator UI only. Deletable if we remove auto-advance sub-phases.
- `score-round` — superseded by `score`.
- `assessment` — feeds the 8-dim assessment. Deletable with the engine.
- `debrief` — feeds the 8-dim assessment. Deletable.
- `replot-injects` — inject-routing recompute.

Plus `/api/events`, `/api/scenario-graph`, `/api/scenario-graph/ai-fill`, `/api/scenario-graph/ai-suggest-options`, `/api/scenario-graph/ai-wizard`, `/api/templates`, `/api/users`, `/api/auth/[...nextauth]` — all live for the builder / auth.

### 1.8 Repo-root directive files

| File | State | Note |
|---|---|---|
| `PROMPT_BUGS.md` (23KB) | Historic — bug punch list from an earlier round | Archive to `backup/prompts/` |
| `PROMPT_CRISIS_LOGIC.md` (7KB) | Historic | Archive |
| `PROMPT_EYE_REDESIGN.md` (26KB) | Historic | Archive |
| `PROMPT_FIXES.md` (13KB) | Historic | Archive |
| `PROMPT_FLOW_TEST_REPORT.md` (24KB) | Historic — actually a report | Archive |
| `PROMPT_LOGIC.md` (13KB) | Historic | Archive |
| `PROMPT_NIS2_SUPERVISION.md` (45KB) | Spec source for supervision system — potentially still authoritative for that subsystem | Keep, move to `docs/architecture/` |
| `PROMPT_ROUND_UX.md` (40KB) | Historic — locked routing + timeline + reliability game | Archive |
| `PROMPT_SCENARIO_BUILDER.md` (17KB) | **Superseded by V2** | Delete |
| `PROMPT_SCENARIO_BUILDER_V2.md` (47KB) | Spec source for builder | Keep, move to `docs/architecture/` |
| `ALIGNMENT.md` (69KB) | Older architecture doc | Move to `docs/archive/` |
| `OPSCHONING.md` (15KB) | Older cleanup punch list | Superseded by this AUDIT |
| `CONTEXT.md` | Session context — kept |
| `README.md`, `SETUP.md` | Keep |

---

## 2. Duplication table (KEEP / MERGE / DELETE)

| Concern | Implementation | Newest? | Called by UI today? | Action |
|---|---|---|---|---|
| **Scenario schema** | `ScenarioGraph` (`lib/graph/types.ts`) | ✅ | ✅ (builder, runtime, session state) | **KEEP** — canonical |
| Scenario schema | `Scenario` (`lib/types.ts:445-492`) | | ✅ (in `SessionState.scenario`) | **MERGE** — projected from graph via `compileLinearGraph`; keep as read-only runtime projection *for now*, drop from persisted shape in Phase G. |
| Scenario schema | `ScenarioInstance` (`lib/types/scenario-instance.ts`) | | AI generation output only | **MERGE** — feed through the same graph builder; do not store this shape. |
| Scenario preset generators | `lib/chains/{4 files}` | Oldest | ❌ 0 imports | **DELETE** — 19KB, orphaned |
| Scenario templates | `lib/builtin-templates.ts` (42KB, produces graphs) + `lib/template-store.ts` | ✅ | ✅ builder gallery | **KEEP** |
| Round/phase enum | `RoundPhase` in `lib/types.ts:150` (5 values incl. `lock`) | ✅ | ✅ | **MERGE** — reduce to 4 values (`inject | discussion | decision | review`). |
| Phase timings | `ROUND_PHASE_TIMINGS` in `lib/engine/round-phases.ts` (5 timings) | ✅ | ✅ | **MERGE** — reduce to 4. |
| Discussion sub-phase state | `activeDiscussionPhase`, `currentDiscussionPhaseIndex`, `currentDiscussionPrompt`, `currentDiscussionPhaseEffectiveSeconds`, `currentDiscussionPhasePaused` on `SessionState` + `setDiscussionPhase()` in session-store + `/api/session/discussion-phase` + `DiscussionPhase` in `lib/engine/types.ts:102` | Older BOB/OODA sub-phase machine | Referenced by dashboard, but the wider brief says BOB structure must go | **DELETE** — this is the BOB sub-phase engine. Replace with one static Dutch line inside the DISCUSSION phase. |
| BOB data on rounds | `RoundNodeData.bobPhase` in `lib/graph/types.ts:61` + `BobPhase` in `lib/types.ts:443` | ✅ (still authored on new graphs) | ✅ shown as badge | **DELETE** field, keep an author-side helper hint if needed. Migrate existing scenarios by stripping. |
| Decision framework | `DecisionFramework: 'bob' \| 'ooda' \| 'dair' \| 'nist_ir' \| 'free'` on `ExerciseConfig` (`lib/types.ts:402`) | ✅ | Setup form field | **DELETE** — the choice belongs to the participants at the table, not the engine. |
| Outcome scoring | `lib/scoring/**` (6 outcome dims + 7 process dims) | ✅ | ✅ | **KEEP** canonical. Reconcile dim count (see §10.A). |
| Alt assessment engine | `AssessmentDimensionId`/`AssessmentDimensionKey` (8 dims) in `lib/engine/types.ts:20` + `lib/types.ts:152` + `lib/engine/assessment.ts` + `/api/session/{assessment,debrief}` | Older | Debrief route only | **DELETE** — including both duplicate type defs. |
| Gamification points | `POINT_EVENTS` in `lib/engine/types.ts:57` | Older | ❌ No consumer | **DELETE** |
| Facilitator -1/0/+1 round score | `FacilitatorRoundScore` in `lib/types.ts:318` + reported in `SessionReport.facilitatorRoundScores` | Older | Referenced by report | **DELETE** (or fold into REVIEW as a facilitator note). |
| Special-event scoring | `SpecialScore` in `lib/types.ts:324` — inside `specialEvents[].totalScore` | ✅ if we keep specials | Live | **KEEP if specials survive** (§10.C) |
| Fact-check scoring | `lib/engine/fact-check-score.ts` | Uncertain | Verify | **CHECK then likely DELETE** — the reliability tags feed the reveal display, but a separate score isn't wired |
| Supervision scoring | `lib/engine/supervision.ts` + `/api/session/supervision-report` + `supervision-report.tsx` | ✅ | ✅ | **KEEP** — orthogonal NIS2 report, not competing with outcome scoring |
| Role vocabulary — playable | `Role` + `ROLE_META` (9 roles) in `lib/types.ts` | ✅ | ✅ | **KEEP** the 9. §10.B has a proposal to consolidate 2 pairs. |
| Role vocabulary — spec/scoring | `DEFAULT_DOMAIN_OWNERSHIP` in `lib/scoring/constants.ts` (10 spec ids incl. non-playable `RETAINER_LIAISON`, `NPC`) | ✅ | ✅ via adapter | **KEEP but rename** — treat spec IDs as internal-only. Reveal UI must map back to app-role labels (§8). |
| Role fallback chains | `ROLE_FALLBACK` (`lib/types.ts:134`) — per-role next-choice map, consulted in `remapMissingRoles` / `expandRolesForJoinedParticipants` (session-store) + `inject-routing.ts` | Oldest still-live | ✅ | **DELETE** — replace with a single engine-level `distributeRoles(authoredRoles, presentParticipants)` per brief §C2. |
| Domain fallback chains | `DEFAULT_DOMAIN_OWNERSHIP` chains inside scoring | ✅ | ✅ | **KEEP the mapping, replace the "pick first present" behaviour** with the new `distributeRoles()` output. |
| Inject routing (session-store) | `injectRoutePlan`, `plotInjectRoutes`, `replotInjectRoutes`, `inject-routing.ts` | Newer | ✅ | **KEEP** the plan structure, but recompute against the new distribution result rather than `ROLE_FALLBACK`. |
| Facilitator control UI | `control-dashboard.tsx` (55KB) | ✅ (post-revert) | ✅ | **KEEP** as the canonical run view (rename to something less shell-shocked). |
| Facilitator "story" UI | `story-view.tsx` (39KB) + `/admin/story` redirect | Newer attempt | ❌ page redirects | **DELETE** |
| Big-screen present UI | `present-view.tsx` (21KB) + `/admin/present` | ✅ | ✅ | **KEEP** — distinct role (room-projector view) |
| Setup UI | `/admin/page.tsx` → `setup-form.tsx` and `/admin/prepare/page.tsx` | Overlap unknown until Phase G | Both live | **MERGE in Phase G** into one page. |
| Report UI | `report-view.tsx` (26KB) + `reveal-panel.tsx` (6KB) + `scoring-panel.tsx` (12KB) + `dimension-scores-section.tsx` (11KB) + `graph-report-section.tsx` | ✅ | ✅ | **MERGE** — one Dutch reveal component per Phase F. `scenario-summary.tsx`, `facilitator-debrief.tsx` are already dead source. |
| Directive markdown | 10 PROMPT_*.md at root | Mixed | — | Archive most, keep NIS2+BuilderV2 as authoritative specs. |

---

## 3. Round/phase conflation

Five distinct pieces of "phase" state live on `SessionState`:

| Field | Type | Purpose in code | Belongs to |
|---|---|---|---|
| `roundPhase` | `'inject' \| 'discussion' \| 'decision' \| 'lock' \| 'review'` | Current whole-round phase | Keep (rename `RoundPhase`, drop `lock`) |
| `activeRoundPhaseState` | `{ roundNumber, currentPhase, phaseStartedAt, durations }` | Runtime timer for whole-round phase | Keep — this becomes the sole phase-state record |
| `activeDiscussionPhase` | `{ roundNumber, phaseIndex, phaseStartedAt, extended }` | Sub-phase within DISCUSSION (BOB Beeldvorming/Oordeel/Besluit or OODA sub-phases) | **DELETE** |
| `currentDiscussionPhaseIndex` | `number` | Redundant copy of `activeDiscussionPhase.phaseIndex`, only set by `tickPhases()` | **DELETE** |
| `currentDiscussionPrompt`, `currentDiscussionPhaseEffectiveSeconds`, `currentDiscussionPhasePaused`, `phaseAutoAdvancePaused` | strings/numbers/bools | BOB sub-phase decoration | **DELETE** |

Mutators touching these:

- `setPhase(phase)` (session-store `:1195`) mutates `roundPhase` + `activeRoundPhaseState.currentPhase` **and** re-inits `activeDiscussionPhase`. Overlaps with `tickRoundPhase`.
- `tickRoundPhase()` (session-store `:113`) auto-advances the whole-round phase. **Returns early on `review`** (§8).
- `tickPhases()` (session-store `:171`) auto-advances the discussion sub-phase index. Independent of `roundPhase`. Non-graph sessions only.
- `setDiscussionPhase(round, index, action)` (session-store `:2223`) mutates only `activeDiscussionPhase`. Wired to `/api/session/discussion-phase`.
- `submitDecision()` (session-store `:1545`) auto-transitions to `lock` on all-groups-submitted (event-mode only), mutating `roundPhase` + `activeRoundPhaseState`.
- `forceLock()` (session-store `:1280`) jumps to `lock` — event-mode only.
- `goToNextRound()` (session-store `:1058`) advances `currentRound` and resets `roundPhase='inject'`. **No guard** requiring the current phase to be `review`. **No `endSession()` — the session is ended implicitly when `goToNextRound()` is called past the last round.**
- `goToPrevRound()` (session-store `:1118`) reverses `currentRound`.

Two counters share state:

- `currentRound` (0-based index) and `roundPhase` are kept separate — OK.
- But `activeRoundPhaseState.roundNumber` (1-based per `RoundPhaseState`) duplicates `currentRound + 1`. Two writers, two readers, can drift.
- `activeDiscussionPhase.roundNumber` duplicates the same value a third time.

Explicit next actions (as the brief demands):

- No code today ever emits an `endSession()` action reachable only after the last round's REVIEW. The dashboard shows a "sessie beëindigen" button because `goToNextRound()` on the last round silently mutates status to `"ended"`. The state machine doesn't guard which button appears when.

**Phase mapping to the canonical 4-phase model** (Phase B):

| Current phase / state | Maps to | Notes |
|---|---|---|
| `inject` | **INJECT** | Same |
| `discussion` + sub-phases (`activeDiscussionPhase`) | **DISCUSSION** | Sub-phase state deleted; one static Dutch line "Overweeg BOB (Beeldvorming, Oordeel, Besluit) om dit te structureren" shown once |
| `decision` | **DECISION** | Same, add missing-role guard |
| `lock` | (folded into) **DECISION → REVIEW transition** | `lock` becomes an atomic server-side transition, not a phase |
| `review` | **REVIEW** | Same, plus `endSession` reachable only from here at last round |

---

## 4. Scoring inventory

Everything that computes any kind of numeric feedback:

1. **6 outcome dimensions** — `lib/scoring/constants.ts:18` — `['CONT','FOR','BC','JUR','VER','KOS']`. Each round produces an `outcomeVector: Record<OutcomeDimension, number>` (`-2..+2`), aggregated to a per-round 0–100 "Punten" via `outcome-round.ts:55`. This is what the participant sees. **KEEP.**

2. **7 process dimensions** — `lib/scoring/constants.ts:22` — `PROCESS_DIMENSIONS = ['BESLUIT','MANDAAT','AANNAME','ADAPT','EXTERN','VOLHOUD','DELEN']`. Each has its own file under `lib/scoring/dimensions/`. Weighted geometric mean → single 0–100 process aggregate. The brief says "**exactly 6-dimension**" — see §10.A. Right now 6 outcome dims *and* 7 process dims run in parallel.

3. **8 assessment dimensions** — `AssessmentDimensionKey` in `lib/types.ts:152` and `AssessmentDimensionId` in `lib/engine/types.ts:20`: `decision_speed`, `decision_quality`, `escalation_timing`, `communication_clarity`, `compliance_awareness`, `mandate_clarity`, `dilemma_participation`, `framework_adherence`. **Duplicate type definition.** Feeds `lib/engine/assessment.ts` + `debrief.ts` + `/api/session/{assessment,debrief}`. **DELETE**.

4. **Gamification points** — `POINT_EVENTS` in `lib/engine/types.ts:57` (`dilemma_voted_fast: 5`, etc.). No consumer found. **DELETE.**

5. **Facilitator -1/0/+1 per-round score** — `FacilitatorRoundScore` in `lib/types.ts:318`, appears on `SessionReport`. UI to enter it lives on the dashboard. Legacy. **DELETE or fold into REVIEW facilitator note.**

6. **Special-event score** — `SpecialScore` and `specialEvents[].totalScore`. Only fires during a `SpecialEvent` (ransomware negotiation / AP notification / journalist Q&A). **KEEP if we keep specials** (§10.C).

7. **Confidence calibration** — `SubmittedDecision.confidence: 1..5` fed to `lib/scoring/calibration.ts`. Optional per participant. **KEEP** as one signal into a dimension; don't display separately.

8. **Fact-check score** — `lib/engine/fact-check-score.ts`. Runtime scores participants on how they tag inject reliability (`fact | assumption | misleading`). Need to grep for consumers before deciding — probably feeds the reveal panel via a channel I haven't found yet.

9. **Supervision report** — `lib/engine/supervision.ts` (26KB) + `computeSupervisionReport()`. Produces a compliance-lens report scored `/3`. Facilitator-facing. **KEEP as separate concern.**

Aggregate that's shown to participants today:

- "Punten: 38" = `AssessmentReport.outcomes[i].points`, computed from `outcomeVector` at `outcome-round.ts:55`.
- 6 abbreviations `CONT / FOR / BC / JUR / VER / KOS` come directly from `OUTCOME_DIMENSIONS`.
- "Genormaliseerd: -0.25" — the pre-scaling of that same points value.
- "Scoring v1.0.0 · rolCoverage 10%" — `SCORING_VERSION` + `roleResolution.rolCoverage`, currently shown to participants (should be facilitator-only per brief).

---

## 5. State ownership

Session state lives in exactly one place: **`SessionState`** in `lib/types.ts:705-779`. Persistence is Vercel KV via `lib/db.ts`; in-memory mirror via `lib/session-store.ts`. Read path is SSE (`/api/session/state`) + optimistic client cache.

Migration surface for a schema change is large:

- **Persisted shape**: `SessionState` has ~50 optional top-level fields. Migration means writing a KV upgrader (or accepting drop-on-load for legacy sessions — reasonable given ephemeral use).
- **Broadcast projection**: `toParticipantState()` in session-store strips facilitator-only fields before SSE — every removed field must be pruned there too.
- **Timeline events**: `TimelineEvent.type` union in `lib/types.ts:620` — 14 event kinds, some tied to phases that will be deleted (`discussion_phase_changed`, `inject_advanced` — check usage).
- **Graph runtime state**: `graph: ScenarioGraph`, `graphState: GraphRuntimeState`. Kept whole per session. Rehydration is a plain JSON parse — no schema versioning today. Adding `graph.version` would let older sessions be rejected/upgraded.

Concurrency: `SessionState.version: number` is a monotonic counter for optimistic concurrency, incremented on every persisted mutation. Uneven adoption — some mutators don't bump it. Verify before Phase B lands persisted-shape changes.

---

## 6. Role model

### Playable roles today (`ROLE_META`, `lib/types.ts:17-132`)

| id | Dutch label (implicit — `label` field is English) | Team | Fits MKB+ 50–500? |
|---|---|---|---|
| `ceo` | CEO | crisis_management | Yes |
| `ciso` | CISO | crisis_management | **Maybe** — MKB+ often has no CISO; the IT manager wears the hat |
| `cfo` | CFO | crisis_management | Yes |
| `legal` | Legal | crisis_management | External counsel — but role at the table is still valid |
| `head_of_comms` | Head of Communications | crisis_management | Often marketing/office manager wears this hat |
| `hr_lead` | HR Lead | crisis_management | Valid |
| `ops_manager` | Operations Manager | crisis_management | Enterprise-y — MKB+ maps to CEO or COO |
| `it_manager` | IT Manager | technical_it | Yes — often the person |
| `system_admin` | System Administrator | technical_it | **Overlap** — IT is usually outsourced; sysadmin = the MSP contact |

Observations:

- All 9 have their **`label` in English** while the app UI is Dutch. That's inconsistent with "UI in Dutch, code in English" — labels are user-facing.
- `system_admin` and `it_manager` collapse to the same spec role `IT_LEAD` in `APP_ROLE_TO_SPEC` (`lib/graph/role-adapter.ts:19`) — code already treats them as one for scoring.
- `ops_manager` has no distinct spec role — mapped to `BUSINESS_OWNER`.
- `RETAINER_LIAISON` exists as a *spec* role in fallback chains (`FORENSIEK`, `EXTERNE_PARTIJEN`) but **has no playable equivalent** — this is the correct pattern per the brief (external actor, not a participant).

External actors — none are playable, all appear as `Inject.source` / `senderName`:
- IR retainer (Eye Security — hardcoded in `lib/graph/types.ts:267`)
- IT/MSP partner (narrative only)
- Cyber insurer (narrative only)
- AP / Autoriteit Persoonsgegevens (via `NotificationType='ap_72h'`)
- NCSC (via `NotificationType='ncsc_24h|72h|final'`)
- Politie, klanten, media, leveranciers — narrative injects only

The IR retainer is correctly modelled as external (never a `Role`), and "Eye Security bellen" is authored as a decision option / activation flow (`retainerState`, `retainer-activation` API, `retainer-activation-panel.tsx`). This matches the brief. `RetainerActivationState` currently tracks a whole mini-flow (`chosenActivator`, `handoffCompleted[]`, etc.) — may be more than the brief's melding-moment style; revisit in Phase D.

Team grouping (`ROLE_META[x].team`) is **UI-only** — used by roster / setup filters / target-team-inject targeting. Not read by scoring. Fine.

Minimum staffing declared nowhere in role config. Only softly enforced by scoring:
- `MANDATE_MIN_DISTINCT_OWNERS = 3` (`lib/scoring/constants.ts:50`) — MANDAAT dimension is nulled below this.
- `optionalDecisionThreshold = 3` (default) — optional decisions are dropped from scoring if `distinctOwners < 3`.

There is **no `distributeRoles()`** function today. `remapMissingRoles()` in session-store + `resolveRoles()` in scoring use *per-role fallback chains* (`ROLE_FALLBACK` and `DEFAULT_DOMAIN_OWNERSHIP`), not workload balancing. The scoring-time `resolveRoles()` returns `effectiveOwners: Record<Domain, RoleId | 'NPC'>` but that's a *domain → role* map (which role is responsible for which topic), not a *participant → roles* map (which person is playing whom). Redistribution as the brief describes it does not exist.

---

## 7. Dead code list

Confirmed dead (0 non-self imports):

- `components/admin/story-view.tsx` (39KB) — `/admin/story/page.tsx` redirects away
- `components/admin/scenario-summary.tsx`
- `components/admin/facilitator-debrief.tsx` (9KB)
- `components/participant/decision-gate.tsx`
- `lib/chains/bec_cfo_fraud.ts`
- `lib/chains/insider_threat.ts`
- `lib/chains/ransomware_double_extortion.ts`
- `lib/chains/supply_chain_compromise.ts`
- `lib/chains/index.ts` (only re-exports the above)

Dead paths (routes that render nothing user-facing):

- `/admin/story` — 3-line redirect; keep redirect while linking sanity is verified, then delete.

Likely dead (imports found only in tests, in each other, or in known-dead callers — need one more grep in Phase B):

- `lib/scoring/report-markdown.ts`
- `lib/scoring/scenario-health.ts`
- `lib/scoring/dry-run.ts`
- `lib/scoring/reference-case.ts` (probably test-only)
- `lib/scoring/role-cards.ts`
- `lib/engine/fact-check-score.ts`
- `lib/engine/facilitator-support.ts` (if the 8-dim system goes)

Dead scoring branches (once 8-dim engine is removed):

- `lib/engine/assessment.ts`
- `lib/engine/debrief.ts`
- `lib/engine/types.ts` (whole file — 8-dim enum + POINT_EVENTS)
- `app/api/session/assessment/route.ts`
- `app/api/session/debrief/route.ts`
- `SessionState.assessmentEvents`
- `AssessmentDimensionKey` alias in `lib/types.ts:152`
- `SessionAssessment`, `AssessmentEvent`, `AssessmentAdvice`, `AssessmentControl`, `POINT_EVENTS`, `PointEventKey`, `DilemmaCard`, `DilemmaOption`, `GamificationConfig`, `GamificationMode`, `RoundActionType` types in `lib/engine/types.ts`

Dead BOB-shaped code once BOB is removed (Phase B):

- `lib/types.ts:443` (`BobPhase`), all `bobPhase` fields
- `lib/engine/types.ts:102` (`DiscussionPhase`)
- `SessionState.activeDiscussionPhase`, `currentDiscussionPhaseIndex`, `currentDiscussionPrompt`, `currentDiscussionPhaseEffectiveSeconds`, `currentDiscussionPhasePaused`, `phaseAutoAdvancePaused`
- `tickPhases()`, `setDiscussionPhase()`, `setPhaseAutoAdvancePaused()` in session-store
- `/api/session/discussion-phase/route.ts`
- `/api/session/phase-pause/route.ts`
- `ExerciseConfig.decisionFramework`, `ExerciseConfig.phaseAutoAdvance`
- Any UI referring to phase-index within DISCUSSION (probably in `control-dashboard.tsx` and `play-view.tsx`)

Dead root-level docs:

- `PROMPT_SCENARIO_BUILDER.md` (superseded by V2)
- Most other `PROMPT_*.md` (archive to `docs/archive/`)
- `ALIGNMENT.md`, `OPSCHONING.md` (superseded by AUDIT + CHANGELOG plan)

Suspected dead API routes (verify with client-fetch grep in Phase B before deleting):

- `discussion-phase`, `phase-pause`, `score-round`, `assessment`, `debrief`, `replot-injects` — probably deletable
- Some `meldplicht-prompt/*` — verify against notification-drafter usage

---

## 8. Bugs — confirmed root causes

### 8.1 REVIEW → next round unreachable

`lib/session-store.ts` `tickRoundPhase()` (approx `:113-152`):

- Order array ends at `'review'` (line ~121).
- When `currentPhase === 'review'`, `order[currentIdx + 1]` is `undefined`.
- Function returns unchanged state (line ~129) — never invokes `goToNextRound()`.

Consequence: on the dashboard, only `next-round` (manual) or the last-round auto-branch to `status: 'ended'` triggers a transition. If the facilitator is in REVIEW of a non-final round with auto-advance on, they hang. And because no state machine gates which action is offered, the button labelled "Sessie beëindigen" appears reachable even mid-scenario.

**Fix at engine level** (Phase B): the phase order includes an explicit `advanceFromReview()` transition — either "start round N+1 at INJECT" if `currentRound + 1 < totalRounds`, or "end session" if it's the last round. Dashboard reads the next-action label from the engine, not from a hardcoded set.

### 8.2 Reveal panel shows every role as `CRISIS_LEAD`

`components/admin/reveal-panel.tsx:125` (approx.) renders `report.effectiveOwners` — a `Record<Domain, RoleId | 'NPC'>` where the `RoleId` values are spec-role identifiers (`'CRISIS_LEAD'`, `'SECURITY_LEAD'`, …), not app-role labels or Dutch names.

`DEFAULT_DOMAIN_OWNERSHIP` (`lib/scoring/constants.ts:37-46`) has `CRISIS_LEAD` at the end of every domain's fallback chain. In sessions with only one participant (or where nobody claims a domain), `resolveRoles()` returns `CRISIS_LEAD` for every domain.

**Two-part fix** (Phase C + F):

- Phase C: the effective-owner map must be *participant × role[]*, output by `distributeRoles()`, not domain × spec-role. Nobody but the scoring internals should see spec-role IDs.
- Phase F: the reveal panel gets a Dutch-labelled projection: for each domain, show which participant is responsible using their **app role label + name**.

### 8.3 Round-trend shows identical value for every round

Confirmed by inspection: `AssessmentReport.outcomes` is built by looping over **all authored rounds** in `report.ts` (via `scoreExercise` orchestrator), including ones the participants haven't reached. Empty decisions → `NO_DECISION_FALLBACK_VECTOR` (`lib/scoring/constants.ts:64`) → identical `points` value in every unplayed round.

**Fix** (Phase E/F): report iterates only rounds where `currentRound >= i`. Reveal panel's trend chart takes rounds from that filtered list.

### 8.4 "Punten: 38" is opaque

`Punten` = per-round 0–100 aggregate of the 6 outcome dims via `Math.round(100 * (normalized + 1) / 2)` (`outcome-round.ts:55`). No breakdown visible.

**Fix** (Phase E/F): either drop the aggregate or make the formula visible on expand. The brief says "delete unless derived transparently". Given that outcome dims are already shown next to it, deleting the aggregate is cleaner.

### 8.5 `Scoring v1.0.0 · rolCoverage 10%` visible to participants

`SCORING_VERSION` + `rolCoverage` rendered in the participant reveal.

**Fix** (Phase F): version string and coverage move to a facilitator/debug panel.

### 8.6 Every role decides every round — data-side gap

No role×round coverage assertion exists. `RoundNodeData.roleActions?[]` is optional; nothing in the builder validates that every role has at least one option. The top decision-maker "receiving no choice" is a symptom of authoring gaps, not a routing bug.

**Fix** (Phase C + G): add a validator that fails publish if any (role, round) cell is empty. Add a runtime assertion for the effective role set. Show the matrix in the builder.

### 8.7 `activeRoundPhaseState.roundNumber` drifts vs `currentRound`

`currentRound` is 0-based; `activeRoundPhaseState.roundNumber` is 1-based. Not every mutator touches both, so they can go out of sync in complex flows (e.g. `prev-round` followed by `set-phase`).

**Fix** (Phase B): compute `roundNumber` from `currentRound` at read-time; drop the duplicate field.

---

## 9. Suggested phase-to-phase mapping for the refactor

| Today | Canonical (Phase B) | Notes |
|---|---|---|
| `RoundPhase='inject'` | `INJECT` | Same |
| `RoundPhase='discussion'` + `activeDiscussionPhase` sub-phases + `discussion-phase` API + `DiscussionPhase` type | `DISCUSSION` | Drop sub-phases entirely. Show a single static Dutch line as a suggestion. |
| `RoundPhase='decision'` | `DECISION` | Add missing-role guard. |
| `RoundPhase='lock'` | (folded into) `DECISION → REVIEW` server transition | No `lock` phase visible to UI. |
| `RoundPhase='review'` | `REVIEW` | Correctly transitions to next round's `INJECT`, or `endSession` if last. |
| `EventMode` groups, `forceLock`, event-mode auto-advance | Optional runtime mode | Keep only if events mode survives §10.C. |
| `ExerciseConfig.decisionFramework` | *delete* | Not the engine's concern. |
| `ExerciseConfig.phaseAutoAdvance` | *delete* | Manual "Volgende fase" only; add per-phase timers if useful, no auto-advance. |

---

## 10. Stop-and-ask points before Phase B

I'm not deleting anything yet. Four decisions I need from you before code moves:

### A. Scoring dimension count — 6 or 6+7?

The brief says "**the 6-dimension 'decision-making under pressure' model**", exactly one system. But the current live scoring package computes **6 outcome dims** (`CONT/FOR/BC/JUR/VER/KOS` — impact of the decisions) *and* **7 process dims** (`BESLUIT/MANDAAT/AANNAME/ADAPT/EXTERN/VOLHOUD/DELEN` — how the team made the decisions). They measure different things.

I read the brief as: **keep the 7 process dims as the "6-dimension" scoring model** (either drop one to reach 6, or reinterpret the brief), and treat the 6 outcome dims as *the consequence layer* (what the reveal panel currently confusingly shows as raw values). But this is a real fork:

- **Option 1** — keep both. Score = 7 process dims (participant-facing sentences per dim). Outcome vectors show consequence per axis but not as "dimensions". Brief's "delete opaque aggregate 'Punten'" applies to the 6-outcome aggregate.
- **Option 2** — reduce to 6 process dims by folding e.g. `VOLHOUD` (persistence) into `ADAPT`, or `DELEN` (sharing) into `EXTERN`. Then outcome vectors go too.
- **Option 3** — the brief's proposed six (situational awareness, decisiveness, information use & escalation, stakeholder & communication judgement, risk/trade-off, adaptation & revision). This does not match the existing seven cleanly.

Which do you want?

### B. Role consolidation — proposed merges for MKB+ fit

I'm **not** deleting or renaming any role without you. Two proposals I'd like a yes/no on:

- **`system_admin` → merge into `it_manager`.** In MKB+ organisations the sysadmin is the MSP contact, not a seat at the crisis table. Code already collapses both to spec role `IT_LEAD`. Losing the second identifier removes the false choice at setup.
- **`ops_manager` → keep, but consider renaming to `business_lead`.** Currently maps to spec role `BUSINESS_OWNER`. "Operations Manager" is enterprise vocabulary; a Dutch MKB+ business owner / director-operations reads more naturally.

Not proposed for change:
- `hr_lead` — valid; keep.
- `head_of_comms` — valid; keep even though in small orgs marketing wears the hat.
- `legal` — valid; often external counsel present at the exercise.
- `ceo`, `cfo`, `ciso` — keep.

Do you want either merge?

### C. `SpecialEvent` (scripted mini-flows) — kept or replaced by melding?

`SpecialType = 'ransomware_negotiation' | 'ap_notification' | 'journalist_qa'` runs three scripted counterpart mini-games with their own scoring. Brief §D describes a new "melding" concept: participant-initiated report with 2-3 fixed types spawning a follow-up inject. **These are different mechanics** — specials are counterpart-driven interactive scripts; meldings are participant-initiated one-shot escalations.

- **Option 1** — keep specials for the three scripted encounters; add meldings as a distinct, simpler feature.
- **Option 2** — melt specials into the melding system; lose the interactive counterpart script.
- **Option 3** — kill specials outright; add meldings; use inline scripted injects when we want a counterpart voice.

I'd default to Option 1 (they solve different UX problems) but this touches ~10 files in `components/participant/special-modal.tsx`, `components/admin/specials-panel.tsx`, `/api/session/special/*` and scoring.

### D. Event mode + groups — kept?

`SimulationMode='event'` with `Group` objects and `forceLock` supports one facilitator running the exercise across multiple simultaneous teams at a live event. Brief doesn't mention it. If we keep, `lock` phase remains a real thing (server-authoritative snapshot when all groups submit). If we drop, we can delete `Group`, `groupId`, `forceLock`, `event-mode.ts`, `set-mode` route, `group/create`, `group/join`, `groups?` on `SessionState`, and simplify submitDecision.

Keep or drop event mode?

---

## Deliverables landing after your call on §10

- **Phase B** — one canonical 4-phase state machine, delete BOB sub-phases, fix REVIEW→next-round, drop `lock` from the enum.
- **Phase C + C2** — engine `distributeRoles()`, kill `ROLE_FALLBACK`, fix reveal-panel role labels, add role×round coverage assertion.
- **Phase E** — one scoring system (per §10.A choice), delete `lib/engine/assessment.ts` + `debrief.ts` + `POINT_EVENTS` + 8-dim types.
- **Phase F/G** — rework reveal-panel (Dutch, no truncation, no `Genormaliseerd`, no version string), consolidate builder & run view.
- **Phase H** — new NIS2-flavoured ransomware+exfil scenario in the new schema, delete existing scenarios (after backup).
- **Phase I** — unit + integration tests, grep guarantees, `QA.md` + `CHANGELOG.md`.

`SCORING.md`, `QA.md`, `CHANGELOG.md` will be produced during their phases, not now.
