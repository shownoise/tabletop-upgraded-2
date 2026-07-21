# PROMPT — NIS2 Supervision Layer + Fact/Assumption Fixes + Showcase Scenario

Feed this whole file to Claude Code inside `/Users/pieterbaspluijmaekers/tabletop-upgraded-2`. Do the parts in order. Each part compiles clean (`pnpm exec tsc --noEmit`) and passes its DoD before the next starts.

## Context

Two upgrades already live: `PROMPT_SCENARIO_BUILDER_V2.md` (Homey-style builder + runtime routing + participant timer) and `PROMPT_ROUND_UX.md` (locked routing, whole-round timeline, reliability-as-game with private tagging + inline annotations).

Two things surfaced during use:
1. **The reliability game feels broken.** Scenario authors have no way to *define* which spans of an inject are factual vs assumption vs misleading — so participants can tag but review has nothing to grade against. Also several UX rough edges on the participant side.
2. **The story we deliver isn't yet showcase-worthy.** We need a proper NIS2 showcase scenario with real branching, chasing injects from the supervisor when the team fails to notify, and multiple end-states.
3. **The app doesn't yet talk the toezichthouder's language.** A regulator wants evidence across 14 test areas, notification duty timing (24h / 72h / 1-month), IR-retainer operational readiness, and lessons learned in a specific format. Right now our debrief maps to eight generic assessment dimensions — a workshop against Cbw/Cbb should map to what the regulator actually asks for.

This plan closes those gaps in five parts:

- **Part 1** — Fact/assumption authoring in the builder + participant UX polish.
- **Part 2** — NIS2 showcase scenario with deep branching and chasing outcomes.
- **Part 3** — Supervision assessment layer: 14 test areas, 0-3 scale, evidence trail, lessons learned in the required format, traceability chain.
- **Part 4** — Notification duty as active gameplay: participants draft 24h / 72h / 1-month notifications, missed windows fire chaser injects.
- **Part 5** — IR-retainer test pattern: retainer activation as a scenario mechanic that surfaces operational readiness gaps.

## Global constraints (all parts)

- No new dependencies. Existing lucide-react, shadcn, Tailwind, `@xyflow/react`.
- `ScenarioGraph` and `SessionState` remain backwards compatible — new fields optional.
- No comments in new files except non-obvious WHY.
- Do NOT rewrite `control-dashboard.tsx` or `inspector.tsx` end-to-end. Surgical edits only.
- Text-facing user copy in Dutch. Internal identifiers in English.
- Every part ends `pnpm exec tsc --noEmit` clean.

---

# Part 1 — Fact/assumption authoring in builder + participant polish

## 1.1 The problem

Right now:
- Author sets `Inject.reliability = 'fact' | 'assumption' | 'unverified' | 'misleading'` via a dropdown in the builder inspector — a single label per whole inject.
- Participant tags per whole inject through the shield popover.
- Review compares whole-inject tags to whole-inject reliability. Fine.
- BUT: authors cannot mark *which spans* of the inject body are facts vs assumptions. So the inline annotation feature (Phase D.11 of prior plan) has no ground truth to grade against for authors who want span-level correctness.
- AND: the participant popover isn't obviously discoverable. Users don't know it's there.
- AND: `reliability = 'unverified'` and `'misleading'` are both in the type but the ground truth reveal only shows fact/assumption/misleading — `unverified` becomes an orphan state.

## 1.2 Consolidate reliability semantics

Change `InjectReliability` in `lib/types.ts` to a three-value set that matches the participant tag menu:

```ts
export type InjectReliability = 'fact' | 'assumption' | 'misleading'
```

Migrate any existing `'unverified'` on inject data to `'assumption'` (they're semantically closest — "plausible but unverified"). Grep `lib/graph/examples-nis2.ts` and `lib/graph/examples.ts` for `'unverified'` and rewrite. Grep the builder inspector too and remove the `'unverified'` option. This is a one-shot migration — no runtime shim.

## 1.3 Ground-truth span annotations in the builder

Extend `Inject` in `lib/types.ts`:

```ts
export interface InjectSpanAnnotation {
  id: string
  start: number
  end: number
  tag: InjectReliability
  authorNote?: string   // optional facilitator explanation shown in review
}

export interface Inject {
  // ...existing
  groundTruthAnnotations?: InjectSpanAnnotation[]
}
```

Builder inspector work (in `components/admin/builder/inspector.tsx` — surgical edit, do not rewrite):

- Under the existing content textarea for Inject nodes, add a "Markeer spans" toggle. When enabled, the textarea is replaced with a `<div contentEditable={false}>` that renders the same text but supports mouse selection. On selection end, show a floating 3-button toolbar (`Feit / Aanname / Misleidend`) that creates an `InjectSpanAnnotation`. Existing annotations render as underlined spans in the tag color; clicking one shows a small popover to remove it or add an authorNote.
- Reuse the participant-side `InjectAnnotator` selection detection logic if possible — extract shared behavior into `components/shared/span-annotator.ts` (pure logic: getSelectionRange, splitTextByAnnotations). The builder wraps it with author-only controls (edit/remove/note); the participant wraps it with player-only controls (tag/untag).

Ground-truth annotations are STORED on the inject as part of the graph JSON. They travel with the scenario.

## 1.4 Author-facing spot check

Add a small "Test kijk" toggle at the top of the inspector for Inject nodes. When enabled, the inspector shows the inject exactly as a participant would see it (no ground truth badges, no reliability metadata) so the author can preview what the deceptive framing looks like.

## 1.5 Participant discoverability polish

In `components/participant/inject-verify-menu.tsx`:
- Change the trigger from a small `ShieldCheck` icon to a text-plus-icon pill: `<ShieldCheck size=12 /> Verifieer` (subtle, muted). This is more discoverable.
- After tagging, the pill becomes: `<CircleDot /> Feit` (or Aanname/Misleidend) with the tag color as the dot fill, but text still muted. Follows the "personal marker" pattern.
- Add a first-time-use hint: on the participant's very first inject in a session, an aria-labelled popover pointer nudges the pill: "Klik om te verifiëren — waar of niet?". Hide after first interaction (localStorage flag).

In `components/participant/inject-annotator.tsx`:
- The floating toolbar currently appears near the selection. Add a small "?" affordance next to the three tag dots that opens a one-line tooltip: "Markeer een woord of zin die je verdacht vindt".
- Ensure the toolbar closes on Escape.

## 1.6 Review reveals span-level correctness

In `components/participant/fact-check-review.tsx`, when an inject has both participant annotations *and* `groundTruthAnnotations`, render a two-column diff:

- Left: the inject text with the participant's annotations underlined in their tag color.
- Right: the same text with the ground-truth annotations underlined in the ground-truth color.

Compute per-inject annotation accuracy in `lib/engine/fact-check-score.ts`:

```ts
// Overlap-based match: participant span "matches" ground truth when
// the two spans overlap by >= 50% of the ground-truth span length
// AND the tags agree.
function annotationCorrectness(
  participant: InjectAnnotation[],
  groundTruth: InjectSpanAnnotation[],
): { matched: number; total: number }
```

Include annotation score in the per-round `perRound` breakdown, weighted 0.4 vs 0.6 for inject-level tags (annotations are bonus signal — inject-level judgement dominates).

## 1.7 Definition of done — Part 1

- Builder Inspector for an Inject node: type "The SOC reports encrypted files on 3 servers." → highlight "3 servers" → click Feit → underline appears. Highlight "The SOC reports" → click Aanname → yellow underline appears. Both persisted when the graph saves + reloads.
- Existing scenarios with `reliability: 'unverified'` no longer exist (migrated). Type-check passes with the tightened union.
- Participant session: pill on each inject reads "Verifieer" until tagged, then reads the tag label with a colored dot.
- First-time hint appears exactly once per participant per session (localStorage-guarded).
- Review phase: two-column diff visible for injects with both participant and ground-truth annotations; accuracy line reads "Jij: 4/5 markeringen · 3/4 spans correct".

---

# Part 2 — NIS2 showcase scenario with deep branching

## 2.1 Scope of the scenario

Create `lib/graph/examples-nis2-showcase.ts` — a single self-contained showcase scenario meant to be *the* demo scenario when someone opens the builder and picks "Template". Name: **"NIS2-showcase: Ransomware bij Nederlands MSP-klantenportaal"**.

Design principles:
- Duration: ~90 min end-to-end when auto-advance is on with fit_to_round.
- 6 rounds. Each round has 1 decision node + 3-5 injects with mixed reliability.
- **At least 4 distinct final outcome nodes**, reachable by different decision paths.
- Injects include misleading ones (e.g. a "SOC analyst" WhatsApp claiming containment when logs contradict).
- Chasing injects wired up: if the team fails to file the 24h vroegtijdige waarschuwing before Round 3, an inject from "NCSC" arrives saying "Wij hebben nog geen melding van u ontvangen — bevestig graag of dit incident onder Cbw valt".
- Same for AP (persoonsgegevens): a 72h chase if data leak not confirmed by Round 4.

## 2.2 Story arc (specify concretely, don't paraphrase)

**Round 1 — Detectie & Classificatie (T+0 to T+15m)**
- Trigger inject: SIEM alert — massive file encryption on prod-VMware cluster hosting klantenportaal.
- Misleading inject #1: WhatsApp from "SOC-lead J. Bakker" (senderName mismatches actual SOC roster) claiming "we hebben containment, geen paniek". `reliability = 'misleading'`.
- Fact inject #2: EDR console screenshot showing lateral movement still active. `reliability = 'fact'`.
- Assumption inject #3: Journalist email suggesting "wij horen dat AVG-data gelekt is" (unverified rumor). `reliability = 'assumption'`.
- Decision node: **Classificatie**
  - Option A: "Significant incident onder Cbw — activeer crisisteam"  → progresses.
  - Option B: "Nog technisch incident — SOC lost het op" → branches to a "MISSED_CLASSIFICATION" side path.
  - Option C: "Kritiek crisis — activeer bestuurlijke laag én NCSC-early-warning binnen 1 uur" → optimal path.

**Round 2 — Activatie & Mandaat (T+15m to T+40m)**
- Inject: CEO in vergadering, niet bereikbaar. CFO staat op stand-by als vervanger — is dat vastgelegd?
- Inject: IR-retainer contactcard verschijnt (only visible if selectedRoles includes CISO). WhatsApp met 24/7 nummer.
- Misleading inject: Interne memo van "Head of Legal" die zegt dat AVG-melding "kan wachten tot forensics klaar is". `reliability = 'misleading'` — AVG melding is 72u vanaf constatering, niet vanaf forensics.
- Decision node: **Mandaat**
  - Option A: "CEO bereiken — desnoods via extern nummer" → optimal.
  - Option B: "Wacht op CEO" → time penalty branch, triggers "delegatie-onduidelijkheid" chaser.
  - Option C: "CFO neemt over conform continuïteitsplan" → optimal if CFO substitution documented in scenario config.

**Round 3 — Meldplicht (T+40m to T+80m)**
- Timer pressure: 24h early-warning deadline drawn as a visible countdown chip (see Part 4).
- Inject: NCSC portal placeholder link (fact).
- Inject: Twitter-bericht van klant die screenshot deelt van ransomnote (fact).
- Inject: interne assumption dat "we hebben nog 24u speling" — assumption tag.
- Decision node: **NCSC melding**
  - Option A: "Vroegtijdige waarschuwing indienen conform bijlage 1" → optimal, but triggers a follow-up "AP-melding beslissen" node if persoonsgegevens vermoeden.
  - Option B: "Wachten op meer duidelijkheid" → chaser fires at Round 4 start.

**Round 4 — Containment vs Bewijs (T+80m to T+110m)**
- Injects on the trade-off: forensic partner says "houd systemen aan, we onderzoeken"; ops says "we moeten porren, klanten hebben last".
- Misleading inject: nep-signal dat "backups clean zijn" (fact-check moment).
- Decision node: **Response strategie**
  - Option A: Full isolation + rebuild from clean backups after IR partner sign-off → optimal.
  - Option B: Fast recovery without forensic sign-off → outcome: contained but insurance denies claim.
  - Option C: Pay ransom (playbook allowt) → outcome: partial data restore + legal/reputational scars.

**Round 5 — Communicatie & Klanten (T+110m to T+140m)**
- Injects: journalist follow-up, klantvragen op support, board-brief request.
- Decision node: **Externe communicatie**
  - Options mirror the earlier categorical set (transparent / holding / silent) but with additional constraint: AP/NCSC comms consistent?

**Round 6 — Herstel & Nazorg (T+140m to T+165m)**
- Injects: RTO/RPO status, herstelvolgorde vraagt bestuurlijk akkoord.
- Decision node: **Terug in productie criterium**
  - Options: strict acceptance criteria + IR partner sign-off vs speedy return.

**Outcomes (min 4, ideally 6):**
1. `exemplary_compliance` — all NCSC/AP meldingen op tijd, containment met bewijs, herstel met sign-off. `scoreImpact +6`.
2. `compliant_but_slow` — meldingen tijdig maar besluitvorming te langzaam. `+2`.
3. `missed_24h_warning` — vroegtijdige waarschuwing niet ingediend; NCSC chaser triggered. `-3`.
4. `data_breach_undeclared` — AVG-melding gemist. `-5`.
5. `insurance_denied_no_forensics` — te snel herstel zonder forensics sign-off; verzekeraar keert niet uit. `-2`.
6. `board_governance_fail` — CEO/CFO substitutie niet geregeld; te lang zonder bestuurlijk besluit. `-4`.

Each outcome has a narrative (~200 words), and lessons-learned prompts wired to the specific failure (see Part 3.5).

## 2.3 Chasing injects wiring

Chasing injects fire when a scenario predicate is met on entry to a subsequent round. Extend the graph engine (`lib/graph/engine.ts`) to support a new node type:

```ts
export type GraphNodeType = 'start' | 'round' | 'inject' | 'decision' | 'special' | 'outcome' | 'chaser'
```

A `chaser` node is checked at the start of each round: if its `condition` evaluates true against `SessionState`, its `inject` is pushed. Conditions are simple JSON predicates:

```ts
export interface ChaserNodeData {
  kind: 'chaser'
  inject: InjectNodeData
  condition:
    | { kind: 'notification_missing'; type: 'ncsc_24h' | 'ncsc_72h' | 'ap_72h' | 'ncsc_final'; afterRoundNumber: number }
    | { kind: 'decision_not_taken'; roleActionId: string; afterRoundNumber: number }
    | { kind: 'flag'; key: string; value: boolean }
}
```

Notification state comes from Part 4. Decisions come from `session.decisions`. Flags come from `SessionState.flags` (new field: `flags?: Record<string, boolean>`).

In the showcase scenario, wire:
- Chaser 1: NCSC 24h missing → fires at start of Round 3 → inject from "NCSC-CSIRT" saying "Wij hebben nog geen vroegtijdige waarschuwing van u ontvangen betreffende het incident bij [uw organisatie]. Bevestig graag binnen 4 uur of Cbw-meldplicht op dit incident van toepassing is." `urgency: critical`.
- Chaser 2: AP 72h missing (only if datalek vermoeden confirmed by a decision) → fires at start of Round 5 → inject from "Autoriteit Persoonsgegevens" saying "Uit openbare bronnen vernemen wij een mogelijk datalek bij uw organisatie. Wij verzoeken u binnen 24 uur te bevestigen of AVG-meldplicht van toepassing is."
- Chaser 3: IR-retainer not activated → fires at start of Round 4 → internal Slack inject from "IT Manager": "Ik krijg geen response van forensics — hebben we de retainer wel formeel geactiveerd?"

## 2.4 Register showcase in EXAMPLES

Add to `lib/graph/examples.ts` (which aggregates):

```ts
import { buildNis2Showcase } from "./examples-nis2-showcase"

export const EXAMPLES = [
  ...existingExamples,
  { key: "nis2_showcase", label: "NIS2 showcase: Ransomware MSP", description: "Deep-branching demo met chasers en 6 uitkomsten", build: buildNis2Showcase },
]
```

Place it first in the array so it's the default suggestion in the template picker.

## 2.5 Definition of done — Part 2

- Template picker in the builder shows "NIS2 showcase: Ransomware MSP" as the first option.
- Load the template → canvas populates with ~40 nodes (6 rounds × ~6 nodes + 3 chasers + 6 outcomes + start). Validate passes.
- Play through with Option B choices at Round 1 + Round 3 → within Round 3 or 4 an NCSC chaser inject arrives. Final outcome resolves to `missed_24h_warning`.
- Play through with all-optimal choices → outcome resolves to `exemplary_compliance`.
- The scenario JSON round-trips via save/load without loss.

---

# Part 3 — Supervision assessment layer

## 3.1 The 14 test areas

Encode the toezichthouder-testgebieden as a canonical enum in `lib/engine/supervision.ts`:

```ts
export type SupervisionArea =
  | 'detection_classification'      // 1. Detectie en classificatie
  | 'crisis_activation'             // 2. Crisisactivatie
  | 'roles_mandates'                // 3. Rollen en mandaten
  | 'ir_retainer'                   // 4. IR-retainer
  | 'technical_response'            // 5. Technische respons
  | 'logging_evidence'              // 6. Logging en bewijs
  | 'notification_duty'             // 7. Meldplicht
  | 'business_continuity'           // 8. Bedrijfscontinuïteit
  | 'recovery'                      // 9. Herstel
  | 'crisis_communication'          // 10. Crisiscommunicatie
  | 'emergency_communication'       // 11. Noodcommunicatie
  | 'suppliers_chain'               // 12. Leveranciers en keten
  | 'board_decision_making'         // 13. Bestuurlijke besluitvorming
  | 'aftercare'                     // 14. Nazorg

export interface SupervisionAreaMeta {
  id: SupervisionArea
  numberLabel: string       // "1", "2", ...
  label: string             // Dutch
  question: string          // "Herkent de organisatie het incident? ..."
  evidenceExamples: string[]  // suggested evidence categories
}

export const SUPERVISION_AREAS: SupervisionAreaMeta[] = [ ... ]
```

Populate `SUPERVISION_AREAS` verbatim from the toezichthouder-analyse the user provided (Bevinding column becomes the `question`, Gewenst bewijs column becomes `evidenceExamples`).

## 3.2 Tag decisions and injects with supervision areas

Extend `RoleAction` in `lib/types.ts`:

```ts
export interface RoleAction {
  // ...existing
  supervisionAreas?: SupervisionArea[]   // which testgebieden this action tests
}
```

Extend `DecisionNodeData` in `lib/graph/types.ts`:

```ts
export interface DecisionNodeData {
  // ...existing
  supervisionAreas?: SupervisionArea[]
}
```

Extend `Inject` in `lib/types.ts` similarly (an inject can be evidence for a testgebied when properly handled):

```ts
export interface Inject {
  // ...existing
  supervisionAreas?: SupervisionArea[]
}
```

In the builder inspector, add a `Testgebieden` multi-select for Decision, Inject, and RoleAction. Read from `SUPERVISION_AREAS`. Group visually (e.g. checkbox list with the numberLabel + label). Store selected ids in the node data.

## 3.3 Scoring on the 0-3 scale

Add to `lib/engine/supervision.ts`:

```ts
export type SupervisionScore = 0 | 1 | 2 | 3   // Niet aanwezig / Gedocumenteerd / Uitgevoerd / Effectief

export interface SupervisionAreaResult {
  area: SupervisionArea
  score: SupervisionScore
  rationale: string          // one paragraph tying evidence to score
  evidence: SupervisionEvidence[]
}

export interface SupervisionEvidence {
  kind: 'decision' | 'inject_handled' | 'notification_draft' | 'timeline_event' | 'observation'
  timestamp: number
  summary: string            // short — 1 sentence
  relatedIds?: string[]      // decision id, inject id, etc.
}

export interface SupervisionReport {
  sessionId: string
  scenarioTitle: string
  organizationName?: string
  facilitatorName?: string
  participants: Array<{ id: string; name: string; role?: Role }>
  timeline: SupervisionEvidence[]
  areas: SupervisionAreaResult[]
  overallScore: number       // avg of area scores, rounded to 1 decimal
  lessonsLearned: LessonLearned[]
  traceability: TraceabilityChain[]
  generatedAt: number
}
```

Scoring algorithm (`computeSupervisionReport(session): SupervisionReport`):

For each `SupervisionArea`:
1. Collect all `evidence` items from the session where the source node/action is tagged with that area:
   - Decisions taken (optimal / neutral / bad) → `decision` evidence.
   - Injects that were tagged and correctly identified (from fact-check) → `inject_handled` evidence.
   - Notifications drafted (Part 4) → `notification_draft` evidence.
   - Timeline events (round transitions, phase changes, chaser triggered) → `timeline_event` evidence.
2. Apply scoring rules per area:
   - `notification_duty`: score 3 if all required notifications (24h/72h/1-month) drafted within the wettelijke window; 2 if drafted late; 1 if drafted after chaser fired; 0 if never drafted.
   - `ir_retainer`: score 3 if retainer activated + escalation contact reached + information handoff completed; 2 if activated but late/incomplete; 1 if only mentioned; 0 if never activated.
   - `detection_classification`: score 3 if Round 1 decision selected the correct classification (per scenario ground truth); 2 if any classification decision was made; 1 if only technical incident; 0 if no classification.
   - Fall-back rule for areas without a specific rule: score 3 if all tagged decisions were "optimal"; 2 if mixed; 1 if any decision touching the area; 0 if none.
3. Rationale is generated by joining evidence summaries into a paragraph. No AI — deterministic template.

The scoring rules live in a table-driven module `lib/engine/supervision-rules.ts`. Each area exports a `score(session, evidence): { score, rationale }` function.

## 3.4 Traceability chain

The regulator wants: Risico → maatregel → testdoel → waarneming → tekortkoming → verbeteractie → eigenaar → deadline → sluitingsbewijs → hertest.

Model in `lib/engine/supervision.ts`:

```ts
export interface TraceabilityChain {
  id: string
  risk: string              // "Ransomware bij externe cloud SLA-partner"
  measure: string           // "Cyberverzekering + IR-retainer + BCP"
  testGoal: string          // "Verifieer dat retainer <10 min activeerbaar is"
  observation: string       // "Retainer geactiveerd na 47 minuten"
  gap: string               // "Activatieprocedure onbekend bij OOH-oncall"
  correctiveAction: string  // "OOH-oncall runbook + kwartaalcheck"
  owner: string             // "CISO"
  deadline: string          // ISO date
  proofOfClosure?: string
  retest?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
}
```

Generate one traceability chain per SupervisionAreaResult with score < 3. Auto-fill risk/measure/testGoal from the area meta; observation/gap from the evidence; corrective action/owner/deadline empty (facilitator fills in after the session).

## 3.5 Lessons learned in the required format

Model:

```ts
export interface LessonLearned {
  id: string
  finding: string          // Bevinding — "Het SOC activeerde het crisisteam 52 minuten nadat..."
  evidence: string         // Bewijs — "Tijdstip, log, besluit of concreet voorbeeld"
  impact: string           // Impact
  cause: string            // Oorzaak
  correctiveAction: string // Corrigerende actie
  owner: string            // Eigenaar
  deadline: string         // ISO date
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  proofOfClosure?: string  // Sluitingsbewijs
  retest?: string          // Hertest
}
```

Auto-seed lessons learned from failed decisions + missed notifications + chaser-triggered events. Each seed populates: finding (from decision or event description), evidence (timestamp + log line), impact (from decision consequence field), cause (from linked SupervisionArea question, blank if not obvious). Owner + deadline + corrective action are empty for facilitator to fill.

## 3.6 Supervision report view

Create `components/admin/supervision-report.tsx` — the new debrief page for facilitator + auditor.

Layout:
1. Header: scenario title, organization, facilitator name, session date, overall score.
2. **Testgebieden tabel** — 14 rows, each showing: number + label + score (colored badge 0/1/2/3) + expandable evidence trail.
3. **Traceability chains** — one card per open gap, with the full Risico → maatregel → ... → hertest chain filled in as far as auto-derivable, and empty fields as editable inputs (facilitator finishes them after the workshop).
4. **Lessons learned register** — table with all 11 columns from the required format. Editable inline.
5. **Timeline of evidence** — chronological, filterable by area.
6. **Export** — button to download the whole thing as JSON *and* as a Markdown/PDF-ready file. Use existing `pdf-lib` if it's already installed; if not, JSON + Markdown only.

Mount it in the existing debrief page (or facilitator dashboard "Rapportage" tab) via a top-level "Toezichthouder-rapport" button. Existing debrief stays as-is; this is an additional, more formal report.

## 3.7 Route + persistence

Add `app/api/session/supervision-report/route.ts`:
- `GET ?sessionId=...` → compute via `computeSupervisionReport` and return.
- `PATCH ?sessionId=...` → accept editable fields (lesson.correctiveAction, chain.owner, etc.) and persist to session (or to a separate `SupervisionReportEdits` KV entry keyed by sessionId — pick whichever is cleanest given existing storage patterns).

Facilitator auth required.

## 3.8 Definition of done — Part 3

- Build a scenario, tag 5+ nodes with supervision areas via the inspector multi-select.
- Play through the scenario.
- Open the supervision report → the 14 testgebieden table shows a color-coded score per area, with evidence expandable.
- Failed decisions produce traceability chains with auto-filled risk/measure/testGoal/observation and empty corrective-action.
- Lessons learned register lists seeded entries with the 11 required fields; editable inline; persists on PATCH.
- Export button produces both JSON and Markdown.

---

# Part 4 — Notification duty as active gameplay

## 4.1 Model

The Cbw requires:
- **Vroegtijdige waarschuwing** — onverwijld, uiterlijk binnen 24 uur.
- **Melding met initiële beoordeling** — uiterlijk 72 uur.
- **Tussentijds verslag** — op verzoek.
- **Eindverslag** — uiterlijk één maand na 72h, of voortgangsverslag als incident nog loopt.

Plus AVG:
- **AP-melding** — binnen 72 uur na vaststelling.

Model in `lib/types.ts`:

```ts
export type NotificationType = 'ncsc_24h' | 'ncsc_72h' | 'ncsc_final' | 'ap_72h'

export interface NotificationDraft {
  id: string
  type: NotificationType
  createdBy: string              // participantId
  createdAt: number
  submittedAt?: number           // when the team locked and "sent" it
  content: {
    suspectMalicious?: string    // "vermoeden van kwaadwillig handelen"
    crossBorderImpact?: string   // "grensoverschrijdende gevolgen"
    responsibleContact?: string  // "verantwoordelijke contactpersoon"
    initialImpactAssessment?: string
    iocs?: string
    mitigations?: string
    otherFields?: Record<string, string>
  }
  score?: {
    completeness: number       // 0-1, fraction of required fields filled with >20 chars
    onTime: boolean
    submittedBeforeChaser: boolean
  }
}

export interface SessionState {
  // ...existing
  notifications?: NotificationDraft[]
  incidentDetectedAt?: number  // set on session start — anchor for all deadlines
}
```

## 4.2 UI — notification drafting

Create `components/participant/notification-drafter.tsx`. Accessible from a persistent "Meldplicht" tab in the participant's `RoundPhaseTimeline` sidebar (add a new sibling to the existing "Injects" and "Beslissing" tabs — grep for the tab structure in `play-view.tsx`).

Contents:
- Header with three deadline countdowns: `24u vroegtijdige waarschuwing — resterend 18:32:14` (green when >6h, yellow when >2h, red when <2h). Same for 72u + AVG.
- For each pending notification type: an editable form with the required fields listed under 4.1.
- "Concept opslaan" button (autosaves — POST `/api/session/notifications` — creates or updates a draft).
- "Verzenden" button (locks the draft; sets `submittedAt`).
- After submission: read-only card summarizing the notification with a small "Bewerken (nog wijzigen mag)" affordance if the deadline hasn't passed.

Facilitator can see all drafts live in a new panel `components/admin/notification-tracker.tsx`.

## 4.3 Chaser trigger

Extend the chaser engine from Part 2 with the `notification_missing` condition. It reads `session.notifications` and returns true when no draft of that type has `submittedAt` set and the elapsed time from `incidentDetectedAt` exceeds the deadline.

## 4.4 Scoring integration

The notification draft's score contributes to `notification_duty` supervision area. Rules:
- 3 = all required notifications submitted before their statutory deadline AND completeness >= 0.8.
- 2 = all submitted before deadline but completeness < 0.8.
- 1 = at least one notification submitted, but late or after chaser.
- 0 = none submitted.

## 4.5 Definition of done — Part 4

- Start a session → "Meldplicht" tab visible with three countdowns ticking down.
- Type into the 24h form → autosave POSTs.
- Wait past 24h without submitting → NCSC chaser inject fires.
- Submit the 24h → chaser doesn't fire (or if already fired, no new chaser).
- Supervision report `notification_duty` reflects the actual behavior.

---

# Part 5 — IR-retainer test pattern

## 5.1 Model

`ExerciseConfig` already has `irRetainerName?: string`. Extend with structured operational fields (defaults per scenario, editable per session):

```ts
export interface IrRetainerProfile {
  name: string
  activationNumber: string          // 24/7 phone
  activationEmail?: string
  authorizedActivators: string[]    // names + roles
  slaMinutesToFirstContact: number  // e.g. 30
  handoffChecklist: string[]        // ["asset inventory", "network diagram", "recent logs", "user accounts"]
  scopeIncludes: string[]
  scopeExcludes: string[]
}

export interface ExerciseConfig {
  // ...existing
  irRetainerProfile?: IrRetainerProfile
}
```

## 5.2 Retainer as a special decision + action bundle

In the showcase scenario (Part 2), Round 2 includes a "IR-retainer activatie" special node with three thresholds:
- **Effective** (`score >= 2`): activator was authorized, contact reached within SLA, information handoff started with checklist.
- **Partial** (`score 1`): activated but late or missing handoff items.
- **Failed** (`score 0`): wrong contact, no authorized activator, no handoff.

Score comes from a small in-round mini-flow (component `components/participant/retainer-activation-panel.tsx`):
- Step 1: pick who activates (dropdown of participants; correct = one of `authorizedActivators`).
- Step 2: dial the 24/7 number (button — records timestamp).
- Step 3: handoff checklist (checkboxes for each item in `handoffChecklist`).

Score = 1 if authorized activator picked, +1 if handoff >= 60% completed within SLA. Cap at 2.

Feed the score into the Special node's threshold predicate. Different branches lead to different outcomes.

## 5.3 Retainer evidence in supervision report

`ir_retainer` area score fed by:
- Score 3 = Effective on the retainer special node.
- Score 2 = Partial.
- Score 1 = Retainer mentioned in decisions but not activated.
- Score 0 = Never activated.

## 5.4 Definition of done — Part 5

- Setup form has fields for `irRetainerProfile` (name + number + authorized activators + SLA + checklist).
- Showcase scenario Round 2: participant sees the retainer activation mini-panel with the 3 steps.
- Completing all steps with authorized activator → Effective branch → optimal outcome path.
- Skipping the activator step → Failed branch → contributes to `board_governance_fail` or `insurance_denied_no_forensics` outcome.

---

# Part 6 — Compliance layer builder tab (connective tissue)

## 6.1 Why this exists

Parts 3–5 add scoring and mechanics. Without Part 6 the scenario author is flying blind: they build a graph, play it, and only discover at report time that half of the 14 supervision areas score 0 because no node was tagged for them. Meldplicht chasers fire on invisible defaults, retainer is only defined at session setup. Story and compliance drift apart.

Part 6 puts the compliance layer *inside the builder* so authors design against it, not around it. One dedicated builder screen with four sub-panels: Coverage, Meldplicht, Retainer, Traceability preview.

## 6.2 Location

Add a fifth tab to the builder toolbar (currently: canvas is the main surface; toolbar has Save/Load/New/Validate/Publish). New tab: **Compliance**.

Route: `/admin/builder` stays; the Compliance panel is a slide-in from the right when the toolbar button is clicked (or Cmd+I keyboard shortcut). Same pattern as the existing wizard/preview dialogs.

Component: `components/admin/builder/compliance-panel.tsx`.

## 6.3 Sub-panel: Coverage-check

Purpose: show which of the 14 supervision areas the current graph actually tests.

Model (pure derivation from graph, no server call):

```ts
export interface CoverageEntry {
  area: SupervisionArea
  meta: SupervisionAreaMeta
  touchedByNodes: string[]     // node ids
  touchedByActions: string[]   // roleAction ids
  coverageLevel: 'none' | 'thin' | 'good'  // 0 nodes = none, 1 = thin, 2+ = good
}

export function computeCoverage(graph: ScenarioGraph): CoverageEntry[]
```

UI:

- 14 rows, each with the area number + label + coverage dot (red/yellow/green) + count "3 nodes, 2 actions".
- Click a row → highlights the touched nodes on the canvas (temporary outline animation) and lists them in a small side list. Clicking a listed node zooms/pans to it via `useReactFlow().setCenter(node.position.x, node.position.y, { duration: 400 })`.
- Rows with `coverageLevel: 'none'` show a small "Auto-fix" button that spawns a starter Decision node pre-tagged with that area and connects it to Start (author fine-tunes from there). This is a nudge, not magic — the node is minimal.
- Header stat: "12/14 gebieden gedekt" — turns green at 14/14.

Live update on every graph edit — no manual refresh.

## 6.4 Sub-panel: Meldplicht configuratie

Purpose: control meldplicht behavior per scenario.

Model — extend `ScenarioGraph`:

```ts
export interface MeldplichtConfig {
  enabled: boolean                         // if false, no chasers, no drafter tab
  incidentDetectedAt: 'start' | 'round_1' | 'round_2' | 'round_3'  // when the deadline clock starts
  ncsc24hEnabled: boolean
  ncsc72hEnabled: boolean
  ncscFinalEnabled: boolean
  apEnabled: boolean                       // AVG melding
  chasersEnabled: boolean                  // whether to auto-fire chasers on miss
}

export interface ScenarioGraph {
  // ...existing
  meldplicht?: MeldplichtConfig
}
```

Default: `{ enabled: true, incidentDetectedAt: 'round_1', ncsc24hEnabled: true, ncsc72hEnabled: true, ncscFinalEnabled: false, apEnabled: true, chasersEnabled: true }`.

UI:
- Master toggle "Meldplicht spelen deze sessie". When off, panel collapses and the participant Meldplicht tab is hidden.
- Radio "Wanneer start de deadline-klok?" — four options.
- Four toggles per notification type. Small helper text under each: "Verplicht binnen 24 uur na constatering" etc.
- One toggle "Chasers automatisch vuren bij gemiste deadline".

## 6.5 Sub-panel: Retainer sample profile

Purpose: give the scenario a demo-ready retainer profile so the story is playable out-of-the-box; facilitator overrides at session setup.

Model — extend `ScenarioGraph`:

```ts
export interface ScenarioGraph {
  // ...existing
  irRetainerProfile?: IrRetainerProfile  // reuse the type from Part 5.1
}
```

UI:
- Same fields as the setup form (Part 5.1): name, 24/7 number, authorized activators (multi-input), SLA minutes, handoff checklist (add/remove strings), scope includes/excludes.
- Small warning icon next to fields left empty — retainer scoring will penalize incomplete profiles.
- "Copy from previous scenario" quick action if the author has multiple scenarios saved.

Precedence at runtime: `session.config.irRetainerProfile ?? graph.irRetainerProfile ?? DEFAULT_RETAINER_PROFILE`. Facilitator override at setup wins.

## 6.6 Sub-panel: Traceability preview

Purpose: show authors what each outcome looks like as an auditor artefact before they ever run the scenario.

For each outcome node in the graph:
- Card with outcome label + narrative excerpt.
- Predicted `SupervisionAreaResult` scores based on the path leading to that outcome and the tags on decisions taken. Since the actual path is only known at play time, use worst-case-per-path analysis: for each outgoing edge from a decision, assume the participant took it, then compute the trace of touched areas + expected scores based on decision `consequence`/`scoreImpact` fields.
- Predicted traceability chains (Risico/maatregel/testdoel/observation) filled in as far as auto-derivable. Corrective action + owner remain empty (as at report time).
- A small "Kan sluitingsbewijs ontstaan uit deze outcome?" checkbox — reminder to the author.

This is the *design-time equivalent* of the supervision report. Authors iterate on the graph until previews look coherent.

Implementation note: reuse `lib/engine/supervision.ts` scoring functions but wrap them in a `previewSupervisionReport(graph, outcomeId)` helper that simulates a session state rather than reading a real one. Do NOT duplicate scoring logic — extract the pure-scoring parts of Part 3 into functions that accept a `PseudoSessionState` shape common to both.

## 6.7 Validation additions

Extend `lib/graph/validate.ts` with new warnings (not errors):
- Warn if `computeCoverage(graph).some(c => c.coverageLevel === 'none')` — list the uncovered areas.
- Warn if `graph.meldplicht.enabled` is true but no node is tagged with `supervisionAreas.includes('notification_duty')`.
- Warn if `graph.meldplicht.chasersEnabled` is true but no `chaser` node exists for meldplicht conditions.
- Warn if any outcome has zero decision paths leading to it.
- Warn if any `Special` node with `type='ir_retainer_activation'` has no retainer profile on the graph OR on the ExerciseConfig.

The existing Validate button surfaces these alongside existing rules.

## 6.8 Definition of done — Part 6

- Open the builder, hit the Compliance tab. Panel slides in from the right.
- Coverage row for "noodcommunicatie" shows red. Click "Auto-fix" → a new Decision node appears near Start pre-tagged. Row turns yellow.
- Toggle "Meldplicht spelen deze sessie" off. Save + reload → the meldplicht tab in participant view no longer renders (confirmed by inspection, not full playthrough).
- Edit retainer sample profile → save → load a session with `graphId` set → setup form pre-fills the retainer fields from the graph, editable.
- Traceability preview lists each outcome with a predicted-scores mini-table. Uncovered areas show as `—`.
- Validate button now surfaces coverage warnings when applicable.

---

# File map — all parts

## Files you ADD
```
lib/engine/supervision.ts                              (Part 3)
lib/engine/supervision-rules.ts                        (Part 3)
lib/engine/coverage.ts                                 (Part 6)
lib/graph/examples-nis2-showcase.ts                    (Part 2)
components/shared/span-annotator.ts                    (Part 1 — shared logic)
components/admin/supervision-report.tsx                (Part 3)
components/admin/notification-tracker.tsx              (Part 4)
components/admin/builder/compliance-panel.tsx          (Part 6)
components/participant/notification-drafter.tsx        (Part 4)
components/participant/retainer-activation-panel.tsx   (Part 5)
app/api/session/notifications/route.ts                 (Part 4)
app/api/session/supervision-report/route.ts            (Part 3)
```

## Files you EDIT
```
lib/types.ts                                (Parts 1, 3, 4, 5 — new fields on Inject, RoleAction, ExerciseConfig, SessionState; tighten InjectReliability)
lib/graph/types.ts                          (Part 2 — add 'chaser' node type + ChaserNodeData; Part 3 — supervisionAreas on DecisionNodeData)
lib/graph/engine.ts                         (Part 2 — chaser evaluation on round start)
lib/graph/validate.ts                       (Part 2 — validate chaser nodes)
lib/graph/examples.ts                       (Part 2 — register showcase)
lib/graph/examples-nis2.ts                  (Part 1 — migrate 'unverified' → 'assumption')
lib/session-store.ts                        (Parts 4, 5 — notification actions, retainer state; also flag support)
lib/engine/fact-check-score.ts              (Part 1 — annotation-level correctness)
lib/engine/debrief.ts                       (Part 3 — link supervision report generation)
lib/api-client.ts                           (Parts 3, 4 — new endpoints)
components/admin/builder/inspector.tsx      (Parts 1, 3 — span annotation authoring, supervisionAreas multi-select, remove 'unverified' option)
components/participant/inject-verify-menu.tsx  (Part 1 — pill instead of icon, first-time hint)
components/participant/inject-annotator.tsx (Part 1 — toolbar "?" affordance, Esc close)
components/participant/fact-check-review.tsx (Part 1 — two-column diff, annotation accuracy)
components/participant/play-view.tsx        (Parts 4, 5 — mount notification tab + retainer panel)
components/admin/control-dashboard.tsx      (Parts 3, 4 — mount supervision-report entry + notification-tracker; SURGICAL)
components/admin/setup-form.tsx             (Part 5 — irRetainerProfile fields)
```

## Files you WILL NOT touch
- `lib/graph/analyze.ts` — no engine analytics changes here.
- Anything outside the list above unless a compile error forces it, and then only surgically.

---

# Execution order

Order is 1 → 3 → 4 → 5 → 6 → 2. Part 2 (showcase scenario) is built LAST, on top of the finished compliance layer, so the scenario actually exercises everything.

1. **Part 1.2** — migrate `InjectReliability` union (foundational).
2. **Part 1.3–1.6** — ground-truth span annotations in builder + participant UX polish.
3. **Part 1.7 DoD.**
4. **Part 3.1–3.2** — supervision areas enum + tagging fields on data model.
5. **Part 3.3–3.5** — scoring, traceability, lessons learned data model + auto-seeding.
6. **Part 4** — notification duty end-to-end (drafter tab, chaser condition in engine, scoring wired to `notification_duty` area).
7. **Part 5** — retainer profile on ExerciseConfig + activation mini-flow + special node subtype scoring wired to `ir_retainer` area.
8. **Part 6.2–6.3** — Compliance builder panel skeleton + Coverage sub-panel.
9. **Part 6.4** — Meldplicht configuratie sub-panel (writes to `graph.meldplicht`, participant tab respects it).
10. **Part 6.5** — Retainer sample profile sub-panel (writes to `graph.irRetainerProfile`, ExerciseConfig override wins at runtime).
11. **Part 6.6** — Traceability preview sub-panel via `previewSupervisionReport`.
12. **Part 6.7** — Validate button surfaces coverage warnings.
13. **Part 6.8 DoD.**
14. **Part 3.6–3.7** — Supervision report UI + API (deferred to here so Coverage/Preview components already exist to reuse patterns).
15. **Part 3.8 DoD.**
16. **Part 2** — build the showcase NIS2 scenario ON TOP of the finished compliance layer:
    - Tag every Decision / Inject / RoleAction with `supervisionAreas`.
    - Configure `graph.meldplicht` for the demo defaults.
    - Fill `graph.irRetainerProfile` with the demo IR partner.
    - Author `groundTruthAnnotations` on misleading injects so the reliability game has real correctness.
    - Verify coverage panel reaches 14/14 green.
    - Verify traceability preview shows meaningful predicted scores per outcome.
17. **Part 2.5 DoD** — play through the scenario multiple paths, confirm outcomes match expectations, supervision report populates all 14 areas.
18. Full type check + smoke test → deploy preview → user tests → prod (backup branch `backup/pre-nis2-supervision` at current main HEAD before push).

---

# Non-goals (explicitly)

- Do NOT expose the supervision report to participants during play — it's a facilitator/auditor artefact.
- Do NOT auto-fill corrective actions or owners in the lessons learned register with heuristic guesses. Those fields are for the facilitator + org to complete post-workshop. Auto-filling them would look authoritative and mislead the auditor.
- Do NOT change existing `AssessmentDimensionKey` semantics or remove any dimension. Supervision is a *parallel* report, not a replacement.
- Do NOT invent regulator quotes or fictional Cbw article numbers in the copy. Use only the language the user provided in the source analysis, and the wettelijke deadlines as stated (24h / 72h / 1 month). If a phrase needs sourcing, mark it TODO and defer to the user.
- Do NOT ship the showcase scenario as "the only" default — keep existing templates available (they may fit different training goals).
