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

## Regressions guarded via TypeScript

- `RoundPhase = 'inject' | 'discussion' | 'decision' | 'review'` — 4 values, no `'lock'`. Anywhere in `app/`, `components/`, `lib/`: `grep 'lock' -- \*.ts \*.tsx` returns hits only in `backup/` and `CHANGELOG.md`.
- `Role` — 8 values (`ceo, ciso, cfo, legal, head_of_comms, hr_lead, ops_manager, it_manager`). `grep 'system_admin' -- \*.ts \*.tsx` returns zero hits outside `backup/`.
- `AssessmentDimensionKey`, `AssessmentDimensionId`, `POINT_EVENTS`, `BobPhase`, `DecisionFramework`, `ROLE_FALLBACK`, `FacilitatorRoundScore` — all deleted; TypeScript refuses to compile with references to any of them.

## API sanity

- [ ] `curl -X POST http://localhost:3000/api/session/set-phase -d '{"phase":"lock"}'` returns 400 (`lock` is not a valid phase).
- [ ] `curl -X POST http://localhost:3000/api/session/discussion-phase` returns 404 (route deleted).
- [ ] `curl -X POST http://localhost:3000/api/session/phase-pause` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/assessment` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/debrief` returns 404.
- [ ] `curl -X POST http://localhost:3000/api/session/score-round` returns 404.

## Dead-code grep (add to CI)

Any hit outside `backup/`, `CHANGELOG.md`, `AUDIT.md`, `SCORING.md`, `QA.md`, `docs/archive/` fails the check:

```
grep -r "AssessmentDimensionKey\|AssessmentDimensionId\|POINT_EVENTS\|BobPhase\|DecisionFramework\|ROLE_FALLBACK\|system_admin\|FacilitatorRoundScore\|activeDiscussionPhase\|BOB_PHASES\|OODA_PHASES\|scoreImpacts\|linkedDimension" app/ components/ lib/ --include='*.ts' --include='*.tsx'
```
