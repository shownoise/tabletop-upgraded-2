# CHANGELOG — de-Frankenstein refactor

All deletions from the phase-A audit through phase-G. Roll forward, not back.

## Session 2 additions

- **AI scenario wizard** — completely rewritten for the new 6-axis schema.
  - `lib/graph/wizard-plan.ts` — new `WizardPlan` shape with `outcomeVector`, `qualityRank`, `meldingMoment`, and Eye Security retainer defaults auto-injected.
  - `app/api/scenario-graph/ai-wizard/route.ts` — new prompt that instructs Claude to produce 8-role coverage per round, `outcomeVector` on every option, misleading-inject discipline, and NIS2-aware meldingen.
  - `components/admin/builder/ai-wizard-dialog.tsx` — form UI: client name, sector, size, attack type, difficulty, round count, crown jewels, critical systems, free text. Submit → returns a full `ScenarioGraph` loaded into the canvas.
  - Wired into two entry points: the startup dialog (primary CTA) and the toolbar (Sparkles button, always accessible).
- **Publish-time validation extended** in `lib/graph/validate.ts`:
  - Role × round coverage: every authored role must have at least one option in every round (error).
  - Every decision option must carry an `outcomeVector` on the 6 axes (warning + sanity-check on range).
  - Melding-moment integrity: every type's `triggersInjectId` must reference an existing inject node.
  - Outcome nodes must have a `scoreRange` (warning) — otherwise the engine can't auto-select.
- **Melding UI wired end-to-end**:
  - `components/participant/melding-button.tsx` — participant button visible only when a moment is open for their role and they haven't already filed. Modal picks a type + optional free text.
  - `components/admin/meldingen-panel.tsx` — facilitator panel listing incoming meldingen with role, recipient, timestamp, and follow-up inject status.
  - Both mounted in `play-view.tsx` and `control-dashboard.tsx` respectively.
- **New starter scenario** — `lib/graph/examples-nis2-polder-storm.ts`:
  - "OPERATIE POLDER-STORM" — 5 rounds, all 8 roles per round, 2 melding-moments (IR-retainer R1, AP-melding R3), 2 per-round decision points with explicit trade-off `outcomeVector`s, 3 outcomes with `scoreRange`.
  - Dutch MKB+ context (NIS2 essential entity). Misleading injects on R1 (WhatsApp) and R3 (OR-roddel).
  - Registered as the first entry in `EXAMPLES` (starred, default).
- **Backup + archive**:
  - `backup/scenarios/builtin-templates.ts.bak` and `examples-simple-story.ts.bak` preserve pre-refactor content.
  - `docs/archive/` — 8 legacy `PROMPT_*.md` files, `ALIGNMENT.md`, `OPSCHONING.md`. `PROMPT_NIS2_SUPERVISION.md` and `PROMPT_SCENARIO_BUILDER_V2.md` retained at root as active architecture specs.


## Deleted files

### API routes (dead — no client fetch)
- `app/api/session/discussion-phase/route.ts` — BOB/OODA sub-phase advance. Sub-phases are gone; the DISCUSSION phase now shows a single static Dutch helper line.
- `app/api/session/phase-pause/route.ts` — pause-auto-advance toggle for sub-phases. No consumer once sub-phases went.
- `app/api/session/assessment/route.ts` — feeder for the 8-dimension assessment engine (deleted).
- `app/api/session/debrief/route.ts` — 8-dimension assessment report generator.
- `app/api/session/score-round/route.ts` — facilitator −1/0/+1 per-round score. Replaced by qualitative REVIEW notes.

### Engine modules (dead)
- `lib/engine/assessment.ts` — 8-dim `buildSessionAssessment()`.
- `lib/engine/debrief.ts` — advice generator around 8-dim.
- `lib/engine/facilitator-support.ts` — BOB_PHASES, OODA_PHASES, buildFacilitatorContext(), assessment controls. Whole file gone.
- `lib/engine/fact-check-score.ts` — separate fact-check score. Merged into per-participant reveal component.
- `lib/scenario/generator.ts` — AI scenario generator producing a `ScenarioInstance`. Non-graph path retired.
- `lib/scenario/prompts.ts` — AI generator prompts.
- `lib/scenario/bridge.ts` — `ScenarioInstance → Scenario` converter.
- `lib/chains/bec_cfo_fraud.ts`, `insider_threat.ts`, `ransomware_double_extortion.ts`, `supply_chain_compromise.ts`, `index.ts` — orphaned scenario chains (0 external imports).
- `lib/capabilities/gamification.ts` — the gamification capability; its `dilemma_participation` dimension is gone.

### Components (dead source)
- `components/admin/story-view.tsx` (39KB) — the `/admin/story` page redirects away; source was retained but unused.
- `components/admin/scenario-summary.tsx` — no external imports.
- `components/admin/facilitator-debrief.tsx` (9KB) — no external imports.
- `components/participant/decision-gate.tsx` — no external imports.

### Route pages
- `app/admin/story/` — redirect page + folder.

## Deleted types / constants

From `lib/types.ts`:
- `AssessmentDimensionKey` — duplicate of `AssessmentDimensionId`; both retired.
- `BobPhase` — round-level BOB tag.
- `DecisionFramework` — `'bob' | 'ooda' | 'dair' | 'nist_ir' | 'free'` config option.
- `ScoreImpacts`, `resolveScoreImpacts()` — legacy 8-dim map on RoleAction / decision options.
- `ActivePhaseState` — BOB sub-phase runtime state.
- `FacilitatorRoundScore`.

From `lib/engine/types.ts`:
- `AssessmentDimensionId` (the 8 dims).
- `POINT_EVENTS`, `PointEventKey`.
- `GamificationConfig`, `GamificationMode`.
- `AssessmentEvent`, `SessionAssessment`, `AssessmentAdvice`, `AssessmentControl`.
- `RoundActionType`, `DilemmaCard`, `DilemmaOption`.
- `DiscussionPhase`.

From `lib/graph/types.ts`:
- `RoundNodeData.bobPhase`.
- `DecisionNodeData.options[].scoreImpact`, `linkedDimension`, `scoreImpacts` — replaced by direct `outcomeVector` on 6 axes.
- `OutcomeNodeData.scoreImpact`, `linkedDimension`.

From `lib/session-store.ts`:
- `remapMissingRoles()` — replaced by `migrateScenarioRoles()` (role-migration) + `distributeRoles()` (workload distribution).
- `tickPhases()`, `computeEffectivePhaseSeconds()` — sub-phase auto-advance.
- `setDiscussionPhase()`, `setPhaseAutoAdvancePaused()`.
- `addAssessmentEvent()`, `submitFacilitatorRoundScore()`.
- `SPECIAL_DIMENSION_MAP` + all `assessmentEvents` accumulation.
- `withRoleRedistribution()` — replaced by `withRoleDistribution()` using the new engine function.

From `lib/types.ts` role model:
- `Role` value `'system_admin'` — merged into `'it_manager'`. Both collapsed to spec role `IT_LEAD` anyway. Migration runs on any inbound scenario data (`migrateLegacyRole()` / `migrateScenarioRoles()`).
- `ROLE_FALLBACK` map — deleted. Distribution now runs through the engine's `distributeRoles()` (Phase C2), which balances workload across present participants deterministically.

From `lib/types.ts` `RoundPhase`:
- `'lock'` — removed as a UI phase. Event-mode locking is now the atomic DECISION → REVIEW transition inside `finalizeDecision()`.

From `lib/types.ts` `ExerciseConfig`:
- `decisionFramework` — teams pick their working method at the table.
- `phaseAutoAdvance` — no sub-phase timer to advance.

From `lib/types.ts` `TimelineEventType`:
- `discussion_phase_changed`.

From `SessionState`:
- `assessmentEvents`, `facilitatorRoundScores`, `activeDiscussionPhase`, `currentDiscussionPrompt`, `currentDiscussionPhaseIndex`, `currentDiscussionPhaseEffectiveSeconds`, `currentDiscussionPhasePaused`, `phaseAutoAdvancePaused`.

## Added

### Engine
- `lib/engine/distribute-roles.ts` — the `distributeRoles()` pure deterministic function. Load-balanced, domain-affinity tie-broken, stable across shuffled input. Documented in `AUDIT.md §10.B`.
- `lib/engine/round-phases.ts::PHASE_ORDER` + `nextPhase()` — single source of truth for phase order.

### Session-store
- `finalizeDecision()` — atomic DECISION → REVIEW transition (replaces `forceLock`; a compat re-export remains).
- `endSessionForced()` — explicit facilitator abort, requires confirmation.
- `describeNextAction()` + `NextActionDescriptor` — the state machine reports which action-label the facilitator UI should show next (`Volgende fase: Discussie`, `Start ronde 3`, `Sessie afronden`). Fixes the ambiguous "Volgende" button.
- `missingDecisionRoles()` — guard used by `describeNextAction` and `setPhase` to block DECISION → REVIEW while required participants haven't submitted.
- `fileMelding()` — participant-initiated melding handler.
- `withRoleDistribution()` — session-start snapshot using the new engine function.
- `migrateLegacyRole()` / `migrateScenarioRoles()` — inbound normalisation for `system_admin` → `it_manager`.

### Types
- `RoleMeta.domain: RoleDomain` — every role now declares a domain (leadership, technical, legal, financial, communication, people, operations) for `distributeRoles()` tie-breaking.
- `MINIMUM_STAFFING` — the role model owns the minimum-seats constraint (`ceo`, `ciso`, `legal`), not individual scenarios.
- `RoleDistributionSnapshot`, `RoleDistributionEntry` — the computed distribution stored on the session.
- `MeldingMoment`, `MeldingType`, `FiledMelding`, `MeldingRecipient` — the Phase D data model.
- `roleAssignmentOverrides` on SessionState — facilitator manual overrides.
- `ROUND_PHASE_LABELS_NL` — the four Dutch phase labels, single source of truth.
- New `TimelineEventType` values: `phase_changed`, `melding_filed`.
- New `LiveEventName`: `melding_filed`.

### API
- `POST /api/session/melding` — file a participant melding.
- `POST /api/session/end` (via `api.endSessionForced`) — new explicit end-session route (server-side handler is `endSessionForced()`; the API-client method exists; route file to be added).

### UI
- Reveal panel — completely rewritten. Full Dutch labels, per-axis direction sentence, trend renders **only completed rounds**, participant name + Dutch role label in the role-distribution section (fixes the CRISIS_LEAD-everywhere bug), facilitator-only debug footer for version/coverage.
- Discussion helper — one static Dutch line ("Overweeg BOB (Beeldvorming, Oordeelsvorming, Besluitvorming) om deze fase te structureren"). Zero engine state, zero timers.

## Bugs fixed at the state machine level

Each of these was traced in `AUDIT.md §8` to a specific file:line before code was touched:

- **REVIEW → next round unreachable.** `tickRoundPhase()` returned early on REVIEW. Now REVIEW is a manual-advance phase (`goToNextRound()` blocks anything but "advance from REVIEW"), and `describeNextAction()` names the explicit next action.
- **Reveal panel shows every role as `CRISIS_LEAD`.** The role-distribution snapshot is now participant-indexed; reveal panel maps to app-role labels + participant names.
- **Trend shows identical value in every round including unplayed ones.** Reveal panel filters `outcomes` by `round.round <= currentRound`.
- **`Punten: 38` opaque aggregate visible to participants.** Deleted from participant view.
- **`Scoring v1.0.0 · rolCoverage 10%` visible to participants.** Moved to facilitator-only debug footer.
- **`activeRoundPhaseState.roundNumber` drift vs `currentRound`.** Left in for now — flagged for follow-up; both are still written by different mutators.

## Not deleted (deliberately kept)

- `lib/scoring/dimensions/*` — 7 process dimensions (BESLUIT, MANDAAT, etc.). Retained as internal scoring signals feeding the 6 outcome axes via `graph-adapter.ts`. **Not shown** to participants and not aggregated into a displayed number. See `SCORING.md`.
- `lib/scoring/graph-adapter.ts` — the only bridge from app state to scoring input; ~370 lines, not an engine, not a scoring system. Kept.
- `lib/engine/supervision.ts` (26KB) — NIS2 compliance report is a separate concern from decision scoring. Kept in place.
- `SpecialEvent` / `specials-panel` / `special-modal` — kept as scripted counterpart mini-flows; they solve a different UX problem than meldingen.
- `SimulationMode = 'event' | 'training'` — event mode still supported for multi-team live events. `lock` is now an internal transition, not a UI phase.

## Root-level docs

- `PROMPT_*.md` (10 files) — not deleted; too much historical context to lose. Move to `docs/archive/` in a follow-up if desired.
- `ALIGNMENT.md`, `OPSCHONING.md` — superseded by `AUDIT.md` + this changelog.
