# Flow & Logic Test Report

**Date:** 2026-07-10
**Method:** Static code analysis (no runtime execution). Four parallel investigations covering the four main flows.
**Scope:** End-to-end walkthrough of every user-visible flow + a punch list of logic bugs, race conditions, missing guards and dead code — ordered by severity.

This report is intended to be **read and then fed into Claude Code** as the source of truth for the next round of fixes. Each finding is stated with file path + line number so it can be verified and patched without further exploration.

---

## Table of Contents

1. [Flow A — Facilitator setup → session creation](#flow-a--facilitator-setup--session-creation)
2. [Flow B — Participant join → role assignment](#flow-b--participant-join--role-assignment)
3. [Flow C — Round progression → decisions → scoring](#flow-c--round-progression--decisions--scoring)
4. [Flow D — Specials → debrief → assessment → report](#flow-d--specials--debrief--assessment--report)
5. [Consolidated bug list (severity-ranked)](#consolidated-bug-list-severity-ranked)
6. [Manual verification checklist](#manual-verification-checklist)
7. [Constraints for the fix pass](#constraints-for-the-fix-pass)

---

## Flow A — Facilitator setup → session creation

### Step-by-step

1. **Landing page** — `app/page.tsx:63–77` shows a "FACILITATOR" card that links to `/admin`.
2. **Setup form** — `components/admin/setup-form.tsx` (924 lines) collects the full `ExerciseConfig`:
   - Organisation: `sector`, `companySize`, `itMaturity`, `securityCapability`
   - Scenario context: `criticalSystems`, `crownJewels`, `scenarioType`, `difficulty`
   - Structure: `teamStructure`, `selectedRoles`, `roundCount`, `timerPerRound`, `duration`
   - Planning docs: `existingPlans` + `irTemplateText` (uploaded IR plan, truncated to 12k chars at line 229)
   - AI: `aiIntensity` (off / lean / full), `specialsMode` (off / static / ai)
   - Module slots: `decisionFramework`, module order with duration/lens overrides
   - Simulation: `mode` (training / event)
3. **`ExerciseConfig`** — `lib/types.ts:415–441`.
4. **Submit → `POST /api/session/create`** — `app/api/session/create/route.ts:419–523`:
   1. Parse body → `ExerciseConfig`.
   2. Open a `ReadableStream` and emit progress events.
   3. Call `generateWithAI(config, mode, opts)` (line 463).
   4. On AI failure fall back to `generateScenario(config)` (line 481).
   5. Call `generateDocuments(config)` (line 494) to build role documents.
   6. Persist via `createSession(config, scenario, mode, documents)` (line 497).
   7. Emit `stage: "done"` with `sessionId`, `joinCode`, `aiIntensity`.
5. **`buildScenarioDirectives()`** — same file, lines 36–204. Composes the AI prompt by conditionally appending 20+ directives based on config fields (see coverage matrix below).
6. **Scenario generation** — three paths in `lib/scenario-generator.ts`:
   - **Lean (Haiku)** lines 223–252 — shorter prompt, minimal round shape.
   - **Full (Sonnet)** lines 254–374 — full prompt, complete round shape with injects + facilitator notes + role actions + learning objectives.
   - **Fallback template** lines 53–199 — static generators (`generateRansomware`, `generateBEC`, `generateInsiderThreat`, `generateDataExfil`), filtered by `selectedRoles`, `hasMonitoring(config)` and difficulty.
7. **Persistence** — `lib/session-store.ts` exposes `createSession`, `toParticipantState` (strips facilitator-only fields), `broadcastState` (SSE), `remapMissingRoles` (uses `ROLE_FALLBACK`). Storage is Vercel KV with an in-memory fallback for dev.

### Coverage matrix — which config fields reach the AI prompt

| Field | Sent to AI? | Location |
|---|---|---|
| `sector` | Yes | route.ts:113–123 |
| `companySize` | Yes | route.ts:125–132 |
| `criticalSystems`, `crownJewels` | Yes (named in injects) | route.ts:50–56 |
| `itMaturity` | Yes | route.ts:135–143 |
| `securityCapability` | Yes | route.ts:103–110 |
| `difficulty` | Yes | route.ts:68–76 |
| `duration` | Yes | route.ts:59–65 |
| `teamStructure` | Yes | route.ts:146–154 |
| `selectedRoles` | Yes via `buildRoleContext()` | route.ts:8–16 |
| `exerciseGoal`, `goalId` | Yes | route.ts:78–100 |
| `decisionFramework` | Yes | route.ts:197–201 |
| `existingPlans` | Yes | route.ts:162–172 |
| `irTemplateText` | Yes in Full only (line 259) | **missing in Lean** |
| `mode` (training/event) | Yes | route.ts:42–48 |
| `teams` | **No** — captured, never used | dead field |
| `irMaturity` | **No** — parsed, never used | dead field |
| `realism` | **No** — captured, never used | dead field |
| `dynamicBranching` | **No** — captured, never used | dead field |

### Logic issues found in Flow A

1. **Client-side duration check does not block submit** — `setup-form.tsx:699–725` shows a warning if `roundCount * timerPerRound > duration`, but the submit button is not disabled. Server accepts anyway.
2. **`companySize` disabled but still submitted in Lean mode** — `setup-form.tsx:364–371`. Grey-out is cosmetic; the old value is still POSTed.
3. **`irTemplateText` silently truncated twice** — 12k in the form, 6k again in the Full prompt. No user warning either time.
4. **Zero selected roles is not blocked** — form allows submit with `selectedRoles: []`; downstream generation can produce a scenario with nothing anyone can do.
5. **`filterActions()` silently drops actions** — `scenario-generator.ts:10–29`. When `ROLE_FALLBACK` cannot remap, the action vanishes instead of being downgraded to "universal".
6. **4 dead config fields** — see coverage matrix. `teams`, `irMaturity`, `realism`, `dynamicBranching`. Either wire them up or remove them from the form + type.

---

## Flow B — Participant join → role assignment

### Step-by-step

1. **Land on `/join`** — `app/join/page.tsx:1–43` + `components/participant/join-form.tsx:1–119`.
   - Fields: `name`, `joinCode` (6 alphanumeric).
   - Pre-fill from `localStorage` (`ctt:name`, `ctt:joinCode`).
   - Persist participant ID in `localStorage` for reconnect after refresh.
2. **`POST /api/session/join`** — `app/api/session/join/route.ts:1–16` + `lib/session-store.ts:232–257`.
   - **No auth check.**
   - Validates `joinCode` against the active session.
   - If `existingParticipantId` present → return same participant (deduped).
   - Otherwise create a new participant with `genId("p")`. **Role is `undefined` at join time.**
   - Emit `participant_joined`; broadcast state via SSE.
3. **State streaming** — `lib/use-session-stream.ts:1–91` + `app/api/session/state/route.ts:1–18`.
   - Primary transport: SSE via `/api/events`.
   - Fallback polling every 4 seconds against `/api/session/state`.
   - Participant view is passed through `toParticipantState()` (session-store.ts:85–135) which strips `facilitatorNotes`, `governanceFlags`, `irPlanAligned`, and hides future rounds.
4. **Ready signal — `POST /api/session/ready`** — `app/api/session/ready/route.ts:1–18` + `session-store.ts:1034–1043`. Just sets `readyAt: Date.now()`. **No enforced "all ready" gate** before the facilitator can start.
5. **Role picker — `POST /api/session/assign-role`** — `app/api/session/assign-role/route.ts:1–18` + `session-store.ts:394–403`. Validates role is in `VALID_ROLES`, maps participant → new role, broadcasts state.
6. **Join code / QR / PIN** — `genJoinCode()` at `session-store.ts:61–67` (6-char alnum). Displayed on `control-dashboard.tsx:434` and `present-view.tsx:97`. Copy-to-clipboard at `control-dashboard.tsx:344`. **No QR generation. No PIN.**

### Logic issues found in Flow B

1. **Race condition on role claim (HIGH)** — `session-store.ts:396–399`.
   ```ts
   const participants = s.participants.map(p =>
     p.id === input.participantId ? { ...p, role: input.role } : p
   )
   ```
   There is no check that another participant already holds that role. Two participants clicking the same role within milliseconds → last-write-wins, and the earlier participant's UI silently loses the role on the next broadcast.
2. **No auth on `/api/session/join`** (MEDIUM) — anyone with the code joins. Acceptable for training but worth calling out for event mode.
3. **No auth on `/api/session/assign-role`** (MEDIUM) — any participant can reassign any other participant's role by passing their `participantId`.
4. **Facilitator cannot see role assignments** (LOW) — `components/admin/participants-list.tsx:1–50` renders join timestamps but no role column. Facilitator must infer role state from the participant view.
5. **No "all ready" gate** (LOW) — facilitator can start the session even if some participants never clicked Ready.
6. **No QR** (LOW) — join code distribution is entirely manual.

---

## Flow C — Round progression → decisions → scoring

### State machine

- Phases enum (`app/api/session/set-phase/route.ts:6`): `"inject" | "discussion" | "decision" | "review"`.
- **No ordering is enforced.** Facilitator can jump directly from `inject` → `review` and skip `decision` entirely.
- Discussion sub-phases (`lib/engine/facilitator-support.ts`):
  - **BOB** (lines 4–28): Beeldvorming 5m → Oordeelsvorming 4m → Besluitvorming 2m.
  - **OODA** (lines 30–62): Observe 3m → Orient 3m → Decide 2m → Act 1m.
  - Each has `phaseStartedAt` on entry (session-store.ts:368–384), can be extended `+2m` via `action:'extend'` (session-store.ts:1007–1009).
- **Timers are frontend-only.** `Round.timerMinutes` (`types.ts:337`) and `durationSeconds` on discussion phases are display hints; the backend never auto-advances or times out.

### API routes

| Route | Purpose |
|---|---|
| `start/route.ts` | Kick off the exercise; sets `roundStartedAt`. |
| `set-phase/route.ts` | Set the phase — no ordering guard. |
| `submit-decision/route.ts` | Participant decision submission. |
| `discussion-phase/route.ts` | Enter discussion / extend +2m. |
| `score-round/route.ts` | Facilitator scores round: `-1 | 0 | 1`. |
| `next-round/route.ts`, `prev-round/route.ts` | Navigate rounds. |
| `push-inject/route.ts` | Push a planned inject. |
| `surprise-inject/route.ts` | Push an ad-hoc inject. |
| `assessment/route.ts` | Append an assessment event. |

### Scoring — how it actually works

There is **no AI-driven scoring and no rules engine.** Three deterministic layers:

1. **Facilitator round score** (manual, per round: -1 / 0 / 1) — `session-store.ts:1045–1058`. Latest submission replaces the previous one for that round.
2. **Decision-speed auto-scoring** — `session-store.ts:505–522`. On the **first** decision in a round, computes elapsed minutes from `roundStartedAt` and awards:
   `<5m → 100 · <10m → 75 · <15m → 50 · <20m → 25 · else 10`.
   The guard is `alreadyScored = assessmentEvents.some(e => e.dimensionId === 'decision_speed' && e.roundNumber === roundIndex)`.
3. **Manual assessment events** — `session-store.ts:975–988`. Append-only. Dimensions include `decision_speed`, `decision_quality`, `escalation_timing`, etc. `source` defaults to `facilitator`.
4. **Special event scores** — accumulated on `SpecialEvent.totalScore` per choice with `scoreImpact ∈ [-2, +2]` (session-store.ts:835–836), but never merged into `assessmentEvents` (see Flow D bug list).

### Logic issues found in Flow C

1. **Phase transitions have no guard** (HIGH) — `set-phase/route.ts:6` accepts any of the four phases in any order. Facilitator can jump to `review` before any decision has been submitted, marking objectives that require a decision as "not achieved" without them ever being possible.
2. **Decisions accepted in any phase** (MEDIUM) — `session-store.ts:447–452` filters previous decision for the participant+round but does not check the round phase. Participants can submit during `inject`, `discussion` or `review`.
3. **First-mover locks decision-speed score for everyone** (MEDIUM, likely intentional but undocumented) — the "already scored" check is per-round, not per-participant. Participant A submits at 3m → score 100 recorded once; Participant B submits at 12m and gets no speed record. If this is intentional it should be documented; if not, it should key on participant.
4. **Learning objectives auto-achieved by any decision** (MEDIUM) — `session-store.ts:486–496`. When a decision is submitted, all `learningObjectives` with `measuredBy: 'decision'` whose `triggerActionIds` contains the submitted action ID are marked achieved. Quality of the decision is not evaluated.
5. **Backend timer enforcement is absent** (LOW). If it is intended to be advisory, document it; otherwise, the round-timer feature is misleading.

---

## Flow D — Specials → debrief → assessment → report

### Specials

**Three types defined; two implemented.**

| Type | Status | Preferred role | Turns |
|---|---|---|---|
| `ransomware_negotiation` | Implemented | CFO / CEO | 4 scripted |
| `journalist_qa` | Implemented | Head of Comms / CEO | 4 scripted |
| `ap_notification` | **Defined but empty** — `SCRIPTED_TURNS.ap_notification = []` | — | 0 |

**Trigger** — `POST /special/trigger` → `session-store.ts:718`.
`assignSpecialParticipant()` picks a participant with the preferred role or falls back to any crisis role. Creates a `SpecialEvent` with the first scripted turn's opening message and the session-configured `specialsMode` (`static` | `ai`).

**Playback modes**

- **Static** — `POST /special/message` with `{ choiceId }` → `submitSpecialChoice()`. Participant picks from predefined choices; counterpart follow-up served from the next scripted turn. Completes when turns exhausted.
- **AI (freeform)** — `POST /special/message` with `{ text }`. Calls Claude **twice in parallel** (`Promise.all`, `special/message/route.ts:108`):
  1. Counterpart reply via `AI_PERSONAS[specialType]` system prompt.
  2. Evaluation via `EVALUATION_PROMPT()` → JSON `{ quality, scoreImpact, hint(nl) }`.
  Both calls use `callClaude()` (non-streaming, line 37). Evaluation errors are swallowed (catch-all at line 127).
- **Form** — `POST /special/form` → `submitApForm()` (intended for `ap_notification`; the special has no scripted turns yet).

**Completion** — `POST /special/complete` → `completeSpecial()` marks the event completed and stops further interactions.

### Debrief — `app/api/session/debrief/route.ts:1–30`

GET requires an active session + a `goalId`. Calls:
- `buildSessionAssessment()` — averages `assessmentEvents` per dimension; overall score = unweighted average of dimensions.
- `generateDebriefAdvice()` — calls Claude with the dimension scores; only dimensions scoring `< 70` get advice. Returns `[{ observation, recommendation, priority }]`. **Silent failure**: on API error or JSON parse failure it returns `[]` (debrief.ts:67).

### Assessment — `app/api/session/assessment/route.ts:1–30`

POST `{ dimensionId, roundNumber, value, source?, note? }`. Appends to `assessmentEvents`. `source` defaults to `facilitator`. **No deduplication** — a facilitator scoring the same dimension twice in the same round produces two records that both count toward the average.

### Report — `app/api/session/report/route.ts:1–110`

GET returns JSON:
- `scores`: `decisionQuality (%)`, `processAdherence (%)`, `roleCompliance (%)`, `facilitatorScore` (int), `objectivesAchieved / objectivesTotal`.
- `perRound[]`: `roundIndex`, `roundTitle`, `decisions[]`, `flags[]`, `facilitatorScore`.
- `perObjective[]`: `roundIndex`, `objective`, `achieved`, `achievedAt`.
- `topFlags[]`: up to 10 governance flags.
- `recommendations[]`: generated by `generateRecommendations()` (report/route.ts:6–32).

**No file export.** Endpoint returns JSON. `lib/document-generator.ts` is used only for participant role documents (insurance policies, GDPR checklists), never for the report itself.

### Reset — `app/api/session/reset/route.ts:1–8` → `resetSession()` at session-store.ts:206

Full nuke: clears scenario, participants, decisions, flags, timeline, special events, assessment events. No partial reset; no archive.

### Context awareness — specials are **not** scenario-aware

`SpecialEvent` creation does not receive `ExerciseConfig` or the generated scenario. Consequences:
- Ransomware demand is hardcoded (50/25/15 BTC, fake wallet).
- Journalist has a hardcoded name (Sanne Visser, NOS Nieuws).
- Scripted turns do not vary by sector, company size, `scenarioType`, or `crownJewels`.
- Chains defined in `lib/chains/*.ts` (ransomware_double_extortion, bec_cfo_fraud, etc.) are not wired into specials.

### Logic issues found in Flow D

1. **`ap_notification` special is bootable but empty** (HIGH) — `SCRIPTED_TURNS.ap_notification = []`. Trigger succeeds and creates a `SpecialEvent` with no opening message → dead UI.
2. **Specials are not context-aware** (HIGH) — sector / crown jewels / scenario type do not influence the special. Reduces training realism.
3. **AI evaluation swallows all errors** (MEDIUM) — `special/message/route.ts:127`. If Claude returns malformed JSON, the message is stored with no evaluation and the participant sees no hint.
4. **Special scores are not merged into assessment events** (MEDIUM) — `SpecialEvent.totalScore` exists but is never appended to `assessmentEvents`, so it does not affect debrief dimensions or the report.
5. **No `auth()` on `/special/form`** (LOW) — the other three special routes (`trigger`, `message`, `complete`) do check auth. `form` does not.
6. **Debrief advice fails silently** (LOW) — if the Anthropic API key is missing or the call fails, `[]` is returned with no signal to the UI.
7. **Assessment events not deduped** (LOW) — repeated scoring of the same dimension/round by the same source keeps compounding into the average.
8. **Report has no export path** (LOW) — JSON only. `document-generator.ts` is not wired into it.

---

## Consolidated bug list (severity-ranked)

### High

- **B1.** Role-claim race condition — two participants can claim the same role; last-write-wins with no error. `session-store.ts:396–399`.
- **C1.** Phase-transition guard missing — facilitator can jump from `inject` to `review` without a `decision` phase. `set-phase/route.ts:6`.
- **D1.** `ap_notification` special boots into an empty state. `SCRIPTED_TURNS.ap_notification = []`.
- **D2.** Specials are not scenario-aware — hardcoded ransom amounts, journalist name, no sector/crown-jewel tailoring.

### Medium

- **A1.** Form-level `roundCount * timerPerRound > duration` warning does not block submit. `setup-form.tsx:699–725`.
- **A2.** `irTemplateText` silently truncated twice (12k in form, 6k in Full prompt), never in Lean prompt.
- **A3.** Zero-role submission is not blocked; scenario has nothing anyone can do.
- **A4.** `filterActions()` silently drops actions when `ROLE_FALLBACK` chain breaks. `scenario-generator.ts:10–29`.
- **B2.** `/api/session/join` and `/api/session/assign-role` have no auth — any participant can reassign any other participant's role by passing their `participantId`.
- **C2.** Decisions accepted in any phase (no check that round phase is `decision`). `session-store.ts:447–452`.
- **C3.** Decision-speed score keys on round only, not participant — first-mover monopolises the metric. Document as intentional or fix.
- **C4.** Learning objectives auto-achieved by trigger action match without evaluating decision quality. `session-store.ts:486–496`.
- **D3.** AI-mode special evaluation errors are swallowed silently. `special/message/route.ts:127`.
- **D4.** `SpecialEvent.totalScore` never merged into `assessmentEvents` → invisible to debrief and report.

### Low

- **A5.** Dead config fields still POSTed / stored: `teams`, `irMaturity`, `realism`, `dynamicBranching`.
- **A6.** `companySize` grey-out in Lean is cosmetic; value still submitted.
- **B3.** Facilitator ParticipantsList has no role column.
- **B4.** No "all ready" gate before start.
- **B5.** No QR code for join distribution.
- **C5.** Round timer is frontend-only — document as advisory or wire backend enforcement.
- **D5.** `/api/session/special/form` has no auth check (the other three special routes do).
- **D6.** Debrief advice fails silently on API errors.
- **D7.** Assessment events not deduped — repeat scoring compounds into the average.
- **D8.** Report is JSON-only; no PDF/DOCX export path even though `document-generator.ts` exists.

---

## Manual verification checklist

Run these in a browser against a Preview deploy before shipping the fix pass. Each item corresponds to at least one finding above.

### Setup / create

- [ ] Fill in setup form with `roundCount * timerPerRound > duration` — verify submit is blocked (A1).
- [ ] Upload a > 15,000-char IR plan — verify a truncation warning appears (A2).
- [ ] Submit with 0 selected roles — verify blocked (A3).
- [ ] Submit with Lean AI mode + IR plan — verify Haiku prompt includes IR plan snippet (A2).
- [ ] Submit twice with all four "dead" fields set to distinct values — verify they either flow through the system meaningfully or are removed entirely (A5).

### Join / roles

- [ ] Two browsers, same role, click within one second — verify only one succeeds and the other sees an explicit "role taken" error (B1).
- [ ] Try `POST /api/session/assign-role` with another participant's ID — verify request is rejected (B2).
- [ ] Verify facilitator dashboard shows a role column with live claim state (B3).
- [ ] Facilitator tries to `start` while one participant is not Ready — verify block or explicit override (B4).

### Rounds / scoring

- [ ] Try `set-phase` `inject → review` — verify server rejects skipping `decision` (C1).
- [ ] Submit a decision during `inject` phase — verify rejection (C2).
- [ ] Two participants submit decisions in the same round; verify decision-speed metric is recorded per participant or the behaviour is documented (C3).
- [ ] Submit a decision that matches a `triggerActionIds` but is deliberately weak content — verify objective is not auto-marked achieved (C4).

### Specials / debrief / report

- [ ] Trigger `ap_notification` — verify the UI does not enter a broken empty state (D1).
- [ ] Run ransomware special in two different sectors (finance vs healthcare) — verify at least one string differs (D2).
- [ ] Force malformed Claude output in AI-mode special — verify user still sees an error / hint (D3).
- [ ] Complete a ransomware special with quality "good" — verify `totalScore` is reflected in debrief dimensions and final report (D4).
- [ ] Call `/api/session/special/form` without auth — verify rejection (D5).
- [ ] Kill the Anthropic key, request debrief — verify UI shows an error rather than an empty advice list (D6).
- [ ] Facilitator scores `decision_quality` in round 1 three times with different values — verify the report reflects the latest score, not the average of three (D7).
- [ ] Verify report has at least one non-JSON export (PDF or DOCX) or explicitly document JSON-only (D8).

---

## Constraints for the fix pass

- **Do not** change file/folder structure without a stated reason.
- **Do not** introduce backwards-compatibility shims — this project has no external consumers; edit call sites directly.
- **Do not** add new AI providers or SDKs. Everything routes through the existing `callClaude()` helper.
- **Do** prefer server-side guards over UI-only disable states (the client is not authoritative).
- **Do** keep all Dutch UI strings in `lib/i18n.ts`; do not hardcode Dutch in components.
- **Do** call `graph_register_edit` for every edited file after the fix pass, per `CLAUDE.md`.
- **Verify locally** by running `pnpm dev` and walking the checklist above before deploying to Vercel.

---

## What this report did **not** cover

- No runtime execution — dev server was not started, no browser tests, no network trace. Any issue that only surfaces at runtime (e.g. SSE reconnection under packet loss, KV rate limits, cold-start latency on Vercel) will need a live pass.
- No test-suite audit. If a `__tests__/` or `*.test.ts` set exists, sanity-check it separately.
- No security review of headers, CSP, CSRF, rate limiting — request a `/security-review` pass separately.
- No performance profile — bundle size, hydration cost, Claude token spend per session were not measured.
