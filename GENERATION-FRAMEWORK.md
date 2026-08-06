# GENERATION-FRAMEWORK.md — wizard rules & pipeline

Enforced by code, not by prompt. If the LLM output violates any of the ten rules below, the pipeline sends the specific failure back to the LLM for a bounded repair and re-validates. A wizard-produced graph that a human sees has passed all ten.

Related: `BUILDER-GAP.md` §9-11, `CHANGELOG.md` (Session 3 — Phase 9).

## The 10 rules

| # | Rule | Fail example | Hint fed back to LLM |
|---|------|--------------|----------------------|
| 1 | Every DecisionNode has a setup-inject (with `setsUpDecisionNodeId`) in the same or immediately preceding round. | `D3` has no setup inject → fail. | "Voeg per genoemde decision een inject toe … zodat de spanning zichtbaar wordt." |
| 2 | Per-role option count on `perRole:true` decisions equals `config.optionsPerRolePerRound` exactly (off-by-one fails). | Target = 4, ceo has 3 → fail. | "Voeg opties toe of verwijder opties zodat elke rol precies `<target>` opties heeft." |
| 3 | No decision option strictly dominates another on ALL six axes. | `A` = +2,+2,+2,+2,+2,+2 next to `B` = 0,0,0,0,0,0 → fail. | "Verlaag de dominante optie op minstens één as, of verhoog de gedomineerde." |
| 4 | A setup inject is never `classification: 'fabel'`. | Setup inject marked fabel → fail. | "Verander classification of voeg een tweede feit-inject die dezelfde decision opzet." |
| 5 | Round N (N ≥ 2) references at least one previous-round decision — via a fuzzy substring match against option labels or `lessonLearned` (first 12 chars, case-insensitive). | Round 3 is a fresh topic, doesn't mention any round-2 option → fail. | "Herschrijf de situation_update van de genoemde ronde zodat een keuze uit de vorige ronde herkenbaar terugkomt." |
| 6 | Every option's `outcomeVector` is non-zero on at least one of `CONT / FOR / BC / JUR / VER / KOS`. All-zero fails. | `outcomeVector = {0,0,0,0,0,0}` → fail. | "Elke optie moet minstens één as bewegen (waarde in -2..+2)." |
| 7 | Classification ratio (`|feit| / |classified|`) approximates `config.factsNoiseRatio` ±0.15. | 0 feit / 4 classified with target 0.7 → fail. | "Verschuif classificaties: meer feit / minder aanname/fabel." |
| 8 | Each selected special condition appears (fuzzy match on the first 20 chars of its `narrativePrompt`) in at least `roundsRequired` distinct rounds. | `backups_untested` selected but never mentioned → fail. | "Weef de narrativePrompt (of duidelijke parafrasering) in het vereiste aantal rondes." |
| 9 | Regulatory window is placed: at least one inject has `triggersRegulatoryNotification: true`, AND that inject's title or content mentions an authority keyword derived from the regime (`avg / ap / autoriteit` OR `nis2 / ncsc / csirt`). | Trigger inject exists but says only "Meldplicht" → fail. | "Vermeld in de trigger-inject één van: avg, ap, autoriteit / nis2, ncsc, csirt." |
| 10 | Facilitator guidance exists AND is grounded: every round has non-empty `facilitatorNotes.discussionGoal`; every number/proper-noun the goal mentions must also appear (case-insensitively) in that round's `situation_update` or inject content. | discussionGoal names "€500k" but no round text mentions it → fail. | "Vermeld alleen feiten/namen in de goal die ook in de ronde-inhoud staan." |

Implemented as pure functions in `lib/wizard/framework.ts`. Each rule is a `(graph, config) => { ok: true } | { ok: false; violation; hint }`. `validateFramework(graph, config)` aggregates them.

## Pipeline order

1. **Seed resolution** — `config.seed` if provided, else `cryptoRandomSeed()`. Recorded on the returned graph as `graph.wizardSeed`.
2. **Outline pass** — one LLM call. Produces `{ rounds: [{ title, situation }, …] }` of length exactly `config.rounds`; else the pipeline throws.
3. **Per-round generation** — `config.rounds` sequential LLM calls. Each call receives the outline + all previously generated rounds + all previously generated decisions. Returns `{ round, decision }` with author-supplied ids like `r1-d1`, `r1-i1` so setup-inject links can be resolved by `planToGraph`.
4. **Closer pass** — one LLM call for `{ name, scenarioType, irPlaybook, outcomes, roleBriefings, injectLibrary }`.
5. **Compile** — `planToGraph(plan, { seed, publishStatus: 'draft', now })`. All ids derive from the seed (Mulberry32 PRNG + xfnv1a hash + monotonic counter). No `Math.random` or `Date.now` in the compile path.
6. **Framework validation** — all 10 rules run in order (`FRAMEWORK_RULE_IDS`).
7. **Repair loop** — up to `maxRepairAttempts` (default 3). Each attempt sends the LLM: (a) the list of failing rules with violations and hints, (b) the current plan. The response replaces the plan. Every failure logged before the retry is recorded in `repairLog`.
8. **Terminal states** — success returns `{ graph, seed, repairLog }`; exhaustion throws `WizardPipelineError` carrying `failures`, `repairLog`, and `seed`. **A graph that violates the framework is never returned.**

## Reproducibility

Given the same `WizardConfig` (including seed) AND the same LLM output the pipeline produces byte-identical graphs. Test: `lib/wizard/__tests__/pipeline.test.ts::"reproduces byte-identical graphs …"`.

Key invariants:
- `lib/wizard/seed.ts` — Mulberry32 + xfnv1a. No dependency on `crypto` at compile time.
- `lib/graph/wizard-plan.ts::planToGraph` accepts an optional `seed` and `now`; when both are set the compile output is fully deterministic.
- Any `Math.random` or `Date.now()` in `planToGraph` is a bug and would break the reproducibility test.

## What a repair attempt looks like

Given a first pass whose graph violates rule 4 (a fabel is the only setup for D2), the repair prompt to the LLM is:

```
De vorige plan overtreedt deze framework-regels:
- [rule4_noise_not_only_path] Setup-injects met classification=fabel: inject i2 (fabel) zet decision d2 op
  Hint: Een setup-inject introduceert een echte beslissing en mag geen fabel zijn — verander de classification naar feit of aanname, of voeg een tweede feit-inject toe die dezelfde decision opzet.

Huidig plan (JSON):
{ … }

Geef een aangepast plan als JSON. Verander ALLEEN wat nodig is om de genoemde regels te herstellen — behoud de rest.
```

The LLM response is parsed as a fresh `WizardPlan`, recompiled, and re-validated. If rule 4 is fixed but rule 7 breaks as a side effect, the same loop applies until either everything passes or the attempt budget is spent.

## Draft-only

Wizard-produced graphs are always compiled with `publishStatus: 'draft'`. The builder promotes to `'published'` explicitly. The pipeline never publishes.

## Extending

- Add a new rule → append a `{ id, fn }` entry to the `RULES` array in `lib/wizard/framework.ts` + a test in `lib/wizard/__tests__/framework.test.ts`.
- Add a new special condition → append a `SpecialCondition` entry to `SPECIAL_CONDITIONS` in `lib/wizard/config.ts`. No consumer changes required.
- Add a new config knob → extend `WizardConfig`, thread through `parseConfigFromBody` in `app/api/scenario-graph/ai-wizard/route.ts`, thread through `buildSystemPrompt` and any rule that reads it.
