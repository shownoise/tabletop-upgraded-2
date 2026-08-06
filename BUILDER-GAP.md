# BUILDER-GAP.md — schema vs. builder diff

Systematic list of every behaviour the showcase scenario or the runtime exercises that the builder cannot currently author. Governing principle: anything the runtime can do, the builder must express, and no capability may live only as a hardcoded special case.

Every entry has: **Behaviour** (what runs), **Where hardcoded** (evidence), **Schema shape needed**, **Builder control needed**, **Validation**, **Phase**.

## 1. Facilitator guidance ("sturing") per round

- **Behaviour**: rounds carry `RoundNodeData.facilitatorNotes: string` and are consumed on the facilitator dashboard; the showcase scenario writes prose that describes what each round tests, tensions to draw out, how to respond to a stalling or racing group.
- **Where hardcoded**: authored ad-hoc as freeform `facilitatorNotes`; no builder control; no per-inject variant; no payload guard that participants never see it.
- **Schema shape needed**: `RoundNodeData.facilitatorNotes` (exists), plus `InjectNodeData.facilitatorNote?: string` (new).
- **Builder control needed**: multi-line textarea on the round card labelled "Facilitator sturing"; a smaller one-line note field on each inject.
- **Validation**: facilitator-only payload test; missing note = warning, not error.
- **Phase 4**.

## 2. Information classification per inject: feit / aanname / fabel

- **Behaviour**: showcase authors classify injects (WhatsApp roddels = fabel/aanname; formal MSP alerts = feit). Runtime uses this in the reveal narrative and the wizard will consume it for the facts/noise slider.
- **Where hardcoded**: `InjectNodeData` has a legacy `reliability?: string` field with values like `"assumption" | "misleading"` used only in scenario data; no enum, no builder control.
- **Schema shape needed**: `InjectNodeData.classification: 'feit' | 'aanname' | 'fabel'` (new enum, required going forward — undefined tolerated for existing data).
- **Builder control needed**: three-option selector on every inject; default unselected so the author must choose.
- **Participant display**: low-key label ("feit", "aanname", "fabel") next to the inject header; no colour-coding stronger than muted-foreground.
- **Validation**: warn on any inject without classification (author must classify).
- **Scoring**: NOT wired to scoring per this pass — data only. Feeds Phase 9 wizard noise ratio + Phase 6 filter.
- **Phase 2**.

## 3. Per-role opening briefing + IR playbook gaps

- **Behaviour**: showcase implies each role starts with a distinct picture (mandate, what they know, what they don't). Currently the participant sees only their role label + their inject stream.
- **Where hardcoded**: no field exists; the info is spread across `RoleMeta.mandateSummary` (added Phase 4 session 2) + `IrRetainerProfile.scopeExcludes` (retainer only) + inject prose.
- **Schema shape needed**: on the ScenarioGraph — `roleBriefings?: Partial<Record<Role, { text: string; playbookGaps?: string[] }>>`.
- **Builder control needed**: in the graph builder, in a "Rollen" side panel or on the role in the graph editor — one textarea per role + a small bullet-list editor for gaps.
- **Participant display**: shown at session start (modal or briefing page) + retrievable from a collapsed panel during play. Under redistribution: inherited-roles' briefings appear sequentially, each labelled with role and the "you are covering this because it is unstaffed" hand-off wording.
- **Validation**: `playbookGaps` entries must correspond to something the scenario exercises — warning if a stated gap is not referenced by any inject, decision option lesson, or facilitator note.
- **Phase 3**.

## 4. Setup-inject → decision link

- **Behaviour**: framework rule 1 requires every decision to be foreseeable via a setup inject in the same or prior round. Currently the link is only implicit in the narrative.
- **Where hardcoded**: no linkage field.
- **Schema shape needed**: `InjectNodeData.setsUpDecisionNodeId?: string` (id of the DecisionNode this inject sets up).
- **Builder control needed**: on each inject, a dropdown to pick "sets up which decision" (populated from decision nodes in the same or prior round).
- **Builder display**: on each decision card, show the linked setup inject(s) with a warning if none exists.
- **Validation**: publish-time warning if any decision has no setup inject in same or prior round.
- **Phase 1 + Phase 9**.

## 5. Round-review scoring narrative — facilitator only

- **Behaviour**: at end of each round the facilitator needs to explain what happened. Currently only the reveal panel with raw dimensions is available.
- **Where hardcoded**: no explanation generator exists.
- **Schema shape needed**: uses existing option fields (`facilitatorCommentary`, `lessonLearned`, `outcomeVector`) — no new fields, only new derived output.
- **Builder control needed**: nothing new; guidance is derived from existing authored fields.
- **Runtime**: new derivation `roundReviewNarrative(session, roundIndex)` producing Dutch sentences per submitted decision plus a section on omissions (meldplicht not filed, retainer not activated, decisions skipped). Facilitator-only payload test.
- **Phase 7**.

## 6. Participant view controls — hide / show / afgehandeld

- **Behaviour**: with many injects the feed becomes unreadable. Participants need control over their own view.
- **Where hardcoded**: does not exist.
- **Schema shape needed**: `session.participantViewState?: Record<participantId, { hidden: string[]; handled: string[]; filters?: { classification?: Array<'feit'|'aanname'|'fabel'> } }>` (server-persisted, per-participant, view-only).
- **Builder control needed**: none — pure participant feature.
- **API**: `POST /api/session/participant-view` upserts per-participant state.
- **Runtime**: participant SSE state includes their own view state; scoring engine reads NONE of this (documented in payload test).
- **Phase 6**.

## 7. Premade inject library — noise pool

- **Behaviour**: facilitator wants to fire ad-hoc noise injects during DISCUSSION. `pushSurpriseInject` and `/api/session/surprise-inject` exist but require the facilitator to compose the inject inline. There is no library of pre-authored noise injects.
- **Where hardcoded**: no library storage; each facilitator's noise is invented on the spot.
- **Schema shape needed**: a new persistent store — either as part of the ScenarioGraph (`ScenarioGraph.injectLibrary?: PremadeInject[]`) or as a session-independent global library keyed in `lib/db.ts`. Recommendation: **scenario-scoped** because noise should fit the scenario's world.
- **Builder control needed**: a new tab or section in the builder — "Bibliotheek — Losse injects" — where the author writes reusable noise injects with classification + optional target roles.
- **Runtime**: new panel in `control-dashboard.tsx` visible during DISCUSSION with a filterable list. Click fires via `pushSurpriseInject`. Logged with round + phase + timestamp in the timeline.
- **Scoring**: context only per user decision this pass; not folded into outcome axes.
- **Phase 5**.

## 8. Option-per-role cap (visual regression)

- **Behaviour**: earlier reports said only two options per role rendered. Current data shows 4 authored per role in R1 of the showcase; no code cap found. Adding a guard test to prevent regression.
- **Where hardcoded**: not currently hardcoded, but was reported three times so is worth pinning down.
- **Schema shape needed**: none.
- **Runtime**: guard test `lib/__tests__/no-option-cap.test.ts` — for every decision node in the showcase, per-role option count must equal the authored count. **Landed in Phase 8**.

## 9. Wizard config fields (rounds, injects/round, facts/noise, options/role/round, roles, regime, org profile, special conditions)

- **Behaviour**: current wizard has only "important context". Users can't steer generation.
- **Where hardcoded**: `WizardPlan` shape in `lib/graph/wizard-plan.ts` and the AI prompt in `app/api/scenario-graph/ai-wizard/route.ts` fix these implicitly.
- **Schema shape needed**: new `WizardConfig` type with all fields per Phase 9 brief. `SpecialConditions` themselves must be data-driven (a `SPECIAL_CONDITIONS: Record<id, { label, prompt }>` map extensible in the builder).
- **Builder control needed**: expanded `ai-wizard-dialog.tsx` form.
- **Runtime**: config drives generation + framework validation.
- **Phase 9** — implemented. `WizardConfig` in `lib/wizard/config.ts`; wizard UI in `components/admin/builder/ai-wizard-dialog.tsx`; framework in `lib/wizard/framework.ts`; pipeline in `lib/wizard/pipeline.ts`.

## 10. Generation framework rules

- **Behaviour**: rules 1-10 in the Phase 9 brief (every decision has a setup inject, no dominant options, noise-only injects never carry the only path, cross-round causal links, etc.). Currently these are hoped-for outcomes of a prompt.
- **Where hardcoded**: as English prose in the wizard prompt.
- **Schema shape needed**: no new schema; a new module `lib/wizard/framework.ts` with rules-as-functions.
- **Runtime**: rules run in code post-generation; on failure the wizard repairs and retries with the specific rule violation fed back.
- **Phase 9** — implemented. See [`GENERATION-FRAMEWORK.md`](./GENERATION-FRAMEWORK.md) for the exact rules and pipeline order.

## 11. Recorded generation seed for reproducibility

- **Behaviour**: currently the wizard is non-deterministic; the same input can yield different scenarios.
- **Schema shape needed**: `WizardConfig.seed?: string`; the wizard records it in the produced ScenarioGraph.
- **Phase 9** — implemented. Seed lives in `WizardConfig.seed`; `ScenarioGraph.wizardSeed` stamps the effective seed on the compiled graph; PRNG in `lib/wizard/seed.ts` (Mulberry32 + xfnv1a). Reproducibility guarded by test `lib/wizard/__tests__/pipeline.test.ts::"reproduces byte-identical graphs …"`.

## 12. Decision-card overview at glance

- **Behaviour**: the current decision inspector requires clicking through to see roles + option counts + warnings. Reviewer needs at-a-glance.
- **Schema shape needed**: none — derived from options.
- **Builder control needed**: rewrite the DecisionNode inspector: collapsed card shows per-role summary (role name, options count, warnings for missing options and missing setup inject); expand-one-at-a-time editing.
- **Phase 1**.

## 13. Duplicate facilitator advance surfaces (Phase 0)

- **Behaviour**: three separate places computed the "next" action label — header button local logic, `describeNextAction()`, and the phase-controls widget forward button. Reported three times as "cannot advance to next round."
- **Root cause**: two independent — (a) engine refused `facilitator_next` on `perRole: true` DecisionNodes, (b) header button used local `currentIndex >= totalRounds - 1` instead of `describeNextAction()`.
- **Fixed in Phase 0**: engine now treats `perRole: true` as a collection point; UI header consolidated to `describeNextAction()`; `describeNextAction()` extracted to `lib/session-next-action.ts` (client-safe module).

## Items deferred with reason

- **Scoring wiring for classification** — deferred by user decision (this pass); may revisit after wizard produces enough scenarios to see whether noise-handling deserves a scoring signal.
- **Ad-hoc premade injects → scoring effect** — deferred; user chose context-only.
- **Session/scenario-scoped inject libraries** — first pass ships scenario-scoped; a future pass may add a cross-scenario global library.

## Not addressed in this pass — reason

Every item numbered 1-13 in this document landed. The following items were named in the third-pass brief but explicitly deferred by user decision, not by omission:

- **Classification → scoring signal.** User chose "data only" this pass. Classification is authored on every inject and drives the wizard's facts/noise ratio + participant filter, but does not fold into outcomeVector. Revisit after real generation output is available.
- **Ad-hoc inject library → scoring signal.** User chose "context only". Library-fired injects log on the timeline and surface in the round-review narrative under `facilitatorInterventions`, but never move outcome axes. Verified by an identity test in `lib/__tests__/inject-library.test.ts`.
- **Cross-scenario global inject library.** First pass ships scenario-scoped. A future pass may add a `lib/db.ts`-backed global pool if authors want to reuse noise injects across scenarios.
- **Wizard-editable `SPECIAL_CONDITIONS` registry.** Landed as an in-code data registry in `lib/wizard/config.ts::SPECIAL_CONDITIONS`. Data-shaped so adding a condition is a one-line data edit; no builder UI to author new conditions yet. Follow-up if authors need to add domain-specific conditions.

Every other capability the showcase scenario or the runtime exercises is now schema-backed and authorable in the builder.
