# QA.md — 10-minute manual verification

Walk this after every deploy. Every step names the specific bug it guards.

## Setup

1. `pnpm dev` — visit `http://localhost:3000`.
2. In one window log in as facilitator (`/admin`).
3. In three other windows/browsers, join with the join code as three participants.
4. Assign roles: CEO, CISO, Legal. Do NOT fill IT-manager or CFO — leaving seats empty is the whole test.

## State machine

**Every round has exactly four phases: INJECT → DISCUSSION → DECISION → REVIEW.**

- [ ] Start the session. First round opens on **INJECT** — the facilitator sees `Volgende fase: Discussie` as the next-action label. Never a bare "Volgende".
- [ ] Advance to DISCUSSION. Verify a single static Dutch line appears: "Overweeg BOB (Beeldvorming — Oordeelsvorming — Besluitvorming)…". No sub-phase timer, no phase index, no auto-advance widget.
- [ ] Advance to DECISION. Verify participants can submit. Verify the next-action label reads `Volgende fase: Review`.
- [ ] Try to advance from DECISION to REVIEW without CEO submitting. Verify the facilitator sees `Wacht op ontbrekende inzendingen — CEO`. The "next phase" button is blocked.
- [ ] Have CEO submit. Verify the block clears; advance to REVIEW.
- [ ] In REVIEW: verify the next-action label reads `Start ronde 2` (not "Sessie beëindigen"). Advance.
- [ ] Loop through five rounds. Every REVIEW → next-round transition works.
- [ ] In the last round's REVIEW: verify the label reads `Sessie afronden`. Click it. Session ends cleanly.

**Regression guarded:** the REVIEW → next-round transition used to be unreachable via auto-advance; only "sessie beëindigen" was visible. Fixed at `session-store.ts::tickRoundPhase` and `describeNextAction`.

## Role redistribution (Phase C2)

**Scenario authored for 8 roles; session has 3. Nothing may be silently dropped.**

- [ ] In the facilitator dashboard, open the role-distribution section (available from session start). Verify all 8 authored roles show up somewhere: each present participant has their primary role plus one or two inherited roles.
- [ ] Inherited roles are labelled with the Dutch app-role label (`CEO`, `CISO`, etc.) — never as `CRISIS_LEAD` or another spec-role identifier.
- [ ] Kill and reload the session. Verify the distribution stays identical (deterministic).
- [ ] Restart the same session with the same three participants joining in different order. Distribution is byte-identical.
- [ ] Verify `MINIMUM_STAFFING` — if CEO alone is present, the session still starts but the coverage badge drops to ~50%. If nobody at all, session refuses.

**Regression guarded:** reveal panel used to render `CRISIS_LEAD` for every domain when only one participant was present. Fixed at `reveal-panel.tsx` (participant × app-role display) and `distribute-roles.ts` (participant-indexed distribution).

## Reveal panel (Phase F)

Enter REVIEW of any round.

- [ ] Each of six dimensions renders with its full Dutch label (`Containment`, `Forensische positie`, `Bedrijfscontinuïteit`, `Juridisch & meldplicht`, `Verantwoording & communicatie`, `Kosten & schade`). No abbreviations.
- [ ] Each dimension shows a numeric value with a sign, and a plain-language `positief` / `negatief` word.
- [ ] Each dimension shows a one-line hint ("Snelheid en zekerheid waarmee de dreiging is ingedamd.") and a direction line ("Hoger = beter ingedamd").
- [ ] The trend chart renders **only completed rounds**. In round 2's REVIEW, only R1 and R2 appear — no phantom R3-R5 columns.
- [ ] Nothing on the participant view says `Scoring v1.0.0`, `rolCoverage`, or `Genormaliseerd`.
- [ ] Facilitator view (open the same session at `/admin/dashboard`) DOES show `Scoring v1.0.0 · Coverage NN%` in a small footer.

## Melding (Phase D)

The scenario should have at least one authored melding-moment.

- [ ] In a round where a melding-moment is open, verify a `Melding doen` button on the participant UI.
- [ ] Participant clicks it; picks one of 2–3 predefined types; submits.
- [ ] Facilitator dashboard shows the incoming melding.
- [ ] The linked follow-up inject appears in the participant feed within one refresh cycle.
- [ ] File a second melding to a different type — verify a different follow-up inject.
- [ ] Try to file the same melding twice — allowed (participants may over-file); nothing crashes.

## Scoring pipeline (Phase 1 fix)

**A decision submitted in round 3 must actually move that round's outcome vector.**

- [ ] Start a session and reach DECISION in round 1. Have one participant submit an option that is authored with a strong outcome vector (e.g., `CONT: +2`).
- [ ] Advance to REVIEW. In the reveal panel, that round's `Containment` line must show a positive value with `+X.X — positief` — not `nog niet gemeten`, not `0.0`.
- [ ] In a round where no participant has submitted anything, every dimension must render an amber `nog niet gemeten` badge instead of a numeric value. A score of exactly `0.00` may never look identical to "no data".
- [ ] The old facilitator `ScoringPanel` with "7 procesdimensies", `PUNTEN TOTAAL`, and `KALIBRATIE` is gone. `grep -rn 'ScoringPanel' app components lib` returns nothing outside `backup/`.

**Regression guarded:** decisions submitted against DecisionNode options never reached the scoring engine because `SubmittedDecision.actionId` (option id) did not match the engine's `decisionPointId` (node id). Fixed at `graph-adapter.ts::resolveDecisionPointId`.

## Regulatory notification (Phase 2)

**The obligation to notify the AP/CSIRT is data-driven and auto-opens on the triggering inject.**

- [ ] Push (or reach) the inject that carries `triggersRegulatoryNotification: true`. Immediately after: a `Meld dit incident bij de toezichthouder` button appears on every participant UI (any staffed role can file).
- [ ] The facilitator dashboard `Regulatory obligations panel` shows one open obligation with round of open, hour since incident, milestone label.
- [ ] Have a participant file it before the 24h exercise-time deadline. Status flips to `filed` with round + hour + filer name.
- [ ] Once the initial milestone is filed, the closing milestone (`Eindrapportage`) auto-opens with a 720h deadline.
- [ ] The review reveal now shows a Dutch advice line under the round: "Meldplicht: op tijd ingediend in ronde X" (on-time), or the late/omitted equivalent.
- [ ] Never filing → session end marks the milestone as `expired`; the advice line shows "Meldplicht is niet ingediend — dit zou in het echt tot een handhavingsonderzoek leiden."

**Regression guarded:** the old `NotificationType` enum (`ncsc_24h` etc.) is deleted — grep must return zero outside `backup/`.

## IR retainer (Phase 3)

**Exactly one activation path exists, and it changes downstream play.**

- [ ] Round 1 has a decision option "Eye Security-retainer activeren" (or the equivalent authored label). Selecting it sets `session.flags.retainer_activated = true` and records `session.retainerActivation` with round + participant + timestamp.
- [ ] After activation the option no longer appears in subsequent decision presentations.
- [ ] A later-round inject or decision option marked `requiresCapability: 'retainer_activated'` becomes visible only for teams who activated. Teams who never activate never see that inject.
- [ ] The review reveal shows an advice line per timing: "IR-retainer vroeg geactiveerd (ronde X)" / "IR-retainer laat geactiveerd" / "IR-retainer niet geactiveerd".
- [ ] The old `/api/session/retainer-activation` route returns 404. The `RetainerActivationPanel` UI (activator selection + dial + handoff checklist) is gone.

**Regression guarded:** the dial/handoff panel used to be the only way the `retainer_activated` flag actually got set; the decision option `activate-retainer` only fired a follow-up inject. Both are now the same path.

## Solo / understaffed play (Phase 4)

**One participant plays every role, sequentially, with an explicit hand-off notice.**

- [ ] Start a session with **one** participant against the current default scenario. Assign them any single role. Reach DECISION.
- [ ] The decision panel shows a `Beslissing 1 van N` progress badge and the option for their **primary** role.
- [ ] Submit. The panel refreshes to the next pending role. Above the option, a prominent amber hand-off notice reads: "Deze rol is in deze sessie niet bezet: [ROL]. Normaal beslist [ROL] hierover. Zet even je hoed van [ROL] op — mandaat en perspectief zijn anders dan bij je hoofdrol."
- [ ] Below the notice: the role's one-line mandate from `RoleMeta.mandateSummary`.
- [ ] Continue through all pending decisions. Progress advances to `Beslissing 2 van N`, `3 van N`, etc.
- [ ] Try to advance to REVIEW with pending items outstanding. Facilitator sees `Wacht op ontbrekende inzendingen — N beslissingen`. Blocked.
- [ ] Submit the last one; REVIEW opens.
- [ ] The reveal shows a coherent, non-degenerate score profile (not a wall of zeros; not identical rows).

**Regression guarded:** solo participants used to see only their primary-role option and no path to submit inherited-role decisions, leaving rounds unresolvable.

## Scenario — Onderwijsvereniging (Phase 5)

**The new default scenario is authored, not placeholder, and exercises every engine feature.**

- [ ] The startup dialog and toolbar show ONE starter, "★ Onderwijsvereniging — Play-ransomware (AVG + NIS2)".
- [ ] Six rounds visible in the graph canvas; every round has 3+ injects, every role has ≥3 decision options across the scenario.
- [ ] Round 1 or 2 has an inject flagged `triggersRegulatoryNotification: true` and mentions AP + NIS2 in the body.
- [ ] At least 12 cross-role coupling moments (options with `capabilityFlag` or `requiresCapability`). Verified in the scenario-guardrail test.
- [ ] `validateGraph(schoolverenigingScenario())` returns zero errors.

## Regressions guarded via TypeScript

- `RoundPhase = 'inject' | 'discussion' | 'decision' | 'review'` — 4 values, no `'lock'`. Anywhere in `app/`, `components/`, `lib/`: `grep 'lock' -- \*.ts \*.tsx` returns hits only in `backup/` and `CHANGELOG.md`.
- `Role` — 8 values (`ceo, ciso, cfo, legal, head_of_comms, hr_lead, ops_manager, it_manager`). `grep 'system_admin' -- \*.ts \*.tsx` returns zero hits outside `backup/`.
- `AssessmentDimensionKey`, `AssessmentDimensionId`, `POINT_EVENTS`, `BobPhase`, `DecisionFramework`, `ROLE_FALLBACK`, `FacilitatorRoundScore` — all deleted; TypeScript refuses to compile with references to any of them.
- `ProcessDimension`, `BESLUIT`, `MANDAAT`, `AANNAME`, `ADAPT`, `EXTERN`, `VOLHOUD`, `DELEN`, `DEFAULT_PROCESS_WEIGHTS`, `PROCESS_DIMENSIONS`, `MANDATE_MIN_DISTINCT_OWNERS`, `SHARE_MIN_ROL_COVERAGE`, `aggregateProcess`, `scoreCalibration`, `MODE_MATRIX`, `maskUnmeasurable` — deleted with the 7-process-dim scoring system.
- `NotificationType`, `NotificationDraft`, `MeldplichtPrompt`, `MeldplichtPromptTrigger`, `RetainerActivationState` — deleted with Phase 2 and Phase 3 consolidations.

## API sanity

- [ ] `curl -X POST http://localhost:3000/api/session/set-phase -d '{"phase":"lock"}'` returns 400 (`lock` is not a valid phase).
- [ ] `curl -X POST http://localhost:3000/api/session/discussion-phase` returns 404 (route deleted).
- [ ] `curl -X POST http://localhost:3000/api/session/phase-pause` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/assessment` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/debrief` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/score-round` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/notifications` returns 404 (deleted with Phase 2).
- [ ] `curl -X POST http://localhost:3000/api/session/meldplicht-prompt/dismiss` returns 404 (deleted with Phase 2).
- [ ] `curl -X POST http://localhost:3000/api/session/retainer-activation` returns 404 (deleted with Phase 3).
- [ ] `curl http://localhost:3000/api/session/score?format=report` returns a shape with `outcomes[]` and `roleResolution` but **no** `dimensions`, `processAggregate`, `calibration`.

## Dead-code grep (add to CI)

Any hit outside `backup/`, `CHANGELOG.md`, `AUDIT.md`, `SCORING.md`, `QA.md`, `docs/archive/` fails the check:

```
grep -r "AssessmentDimensionKey\|AssessmentDimensionId\|POINT_EVENTS\|BobPhase\|DecisionFramework\|ROLE_FALLBACK\|system_admin\|FacilitatorRoundScore\|activeDiscussionPhase\|BOB_PHASES\|OODA_PHASES\|scoreImpacts\|linkedDimension\|ProcessDimension\|NotificationType\|NotificationDraft\|MeldplichtPrompt\|RetainerActivationState\|aggregateProcess\|scoreCalibration\|MODE_MATRIX\|scoreBesluit\|scoreMandaat\|scoreAanname" app/ components/ lib/ --include='*.ts' --include='*.tsx'
```
