# Build instructions: focused fixes

Read each file in full before changing it. Follow existing Tailwind classes and TypeScript patterns.

---

## Context: how this product works

The exercise facilitator's company IS the client's outsourced SOC and contracted IR retainer.
This is the core narrative frame for everything. Participants are the CLIENT's crisis team
(CEO, CISO, CFO, Legal, Comms). They receive briefings FROM the SOC/IR team, not raw
technical system alerts.

---

## Fix 1 — Feedback never shows after round 1 (only starts at round 2)

**File:** `components/participant/play-view.tsx` around line 457

**Root cause:** When `session.id` changes (new session), `prevRoundRef` is reset to -1
but `doneFeedbackRounds` and `localStorage` are NOT cleared. So if a previous session
already marked round 1 feedback as done, the new session skips it.

**Fix:** In the `useEffect` that detects session id change (line ~461), add the reset:

```typescript
if (session.id !== sessionIdRef.current) {
  sessionIdRef.current = session.id
  prevRoundRef.current = -1
  setDoneFeedbackRounds(new Set())
  try { localStorage.removeItem(FEEDBACK_KEY) } catch {}
}
```

---

## Fix 2 — Participants see other roles' decision options

**File:** `components/participant/decision-panel.tsx` around line 200

**Root cause:** The `otherActions` section (lines ~200-215) renders all actions for
OTHER roles, visible and selectable. This lets participants see what other roles will
decide before the group discusses.

**Fix:** Remove the entire `otherActions` block — the divider, the label "Acties van
andere rollen", the grid, and the note below it. Each participant sees ONLY the actions
where `allowedRoles` includes their role (or `allowedRoles` is empty = all roles).

The `otherActions` variable and `ActionButton` component can stay for the "my actions"
grid — just delete the second `{otherActions.length > 0 && (...)}` render block entirely.

Role-deviation tracking still works server-side when someone submits an action outside
their role — do not change `submitDecision` logic.

---

## Fix 3 — Injects too technical for crisis team + SOC framing missing

**File:** `app/api/session/create/route.ts` — `buildScenarioDirectives()`

**Problem:** The AI generates raw SIEM alerts, EDR detections, and system logs that go
directly to crisis management participants (CEO, CFO, Legal). These roles would never
see raw technical output — they receive briefings from the SOC.

**Fix A — SOC/IR retainer framing (replace existing `it_ir_retainer` directive):**

Remove the current `it_ir_retainer` security capability directive and add this as a
top-level directive that always applies:

```
SOC & IR RETAINER CONTEXT: The exercise facilitator organisation IS the client's
outsourced SOC AND contracted IR retainer. Apply this throughout the entire scenario:

- Round 1: The initial detection signal comes from the SOC monitoring dashboard.
  The SOC analyst sends a structured briefing to the CISO/IT Manager — NOT a raw
  SIEM alert. Crisis management roles (CEO, CFO, Legal, Comms) receive a summary
  email or phone notification from the CISO, not the raw alert.
- All rounds: The IR retainer is already on-site or on call. Never write "contact
  your IR partner" — they are already engaged. Write "IR Lead [SOC company name]
  advises..." or "SOC Analyst confirms...".
- Use a consistent fictional SOC company name throughout all injects (pick one at
  generation time, e.g. "SecureNL" or "CyberShield BV", and use it everywhere).
- Technical injects (SIEM, EDR, forensic findings) always come FROM the SOC/IR team
  TO the relevant role, written as a professional briefing — not a raw system dump.
```

**Fix B — Target injects by role and difficulty:**

Add this directive:

```
INJECT TARGETING BY ROLE AND DIFFICULTY:

Every inject must have a targetTeam field set correctly:
- Raw technical details (log excerpts, forensic findings, network diagrams):
  targetTeam: "technical_it" — only CISO, IT Manager, System Admin see these.
- Business impact, legal exposure, financial figures, media coverage:
  targetTeam: "crisis_management" — CEO, CFO, Legal, Comms, HR, Ops receive these.
- Major incident escalations, ransom notes, public news:
  targetTeam: "all" — everyone sees these.

For difficulty "beginner" and "intermediate":
- Crisis management roles receive narrative briefings only (no raw technical data).
  Example: instead of "EDR alert: LSASS dumped via Mimikatz on DC01", write
  "SOC briefing: Attacker has gained admin access on a domain controller.
   IR team is isolating the affected system. No further action needed from IT."
- Technical roles receive the full technical inject on top of the briefing.

For difficulty "advanced":
- Crisis management roles may receive ambiguous or partially technical injects
  to test their ability to ask the right questions.
```

**Fix C — Language (already in prompt but verify it works):**

Confirm the LANGUAGE directive is the very first directive returned by
`buildScenarioDirectives()`. If it is not first in the string, move it to position 0
in the `d` array. All scenario text must be Dutch.

Also add to `lib/scenario/prompts.ts` (`SCENARIO_GENERATOR_SYSTEM_PROMPT`):
First sentence: "All output must be in Dutch (Nederlands). Technical terms (CVE, MITRE,
tool names) may remain in English."

---

## Fix 4 — Documents and authorities not connected to the story

**Problem:** The sidebar shows generic `ROLE_META.authorities` (hardcoded) and
`RoleDocumentsPanel` (static generated documents). These feel disconnected from the
live scenario — a CEO's authorities list is the same regardless of whether it's a
ransomware or insider threat scenario.

**Fix A — `lib/document-generator.ts`:**

Read this file in full. The documents it generates must reference the specific
`ExerciseConfig` context — sector, company size, scenario type, SOC relationship.

Update `generateDocuments(config)` to inject scenario-specific references into
document content. At minimum:
- The IR plan document must mention that the SOC/IR retainer is already contracted
  and on call (not "contact your IR partner").
- The insurance policy document (for CFO) must reference the cyber insurer by a
  plausible fictional name consistent with the sector.
- The GDPR/AP checklist (for Legal) must reference the 72-hour NIS2 window explicitly.

**Fix B — Sidebar label in `components/participant/play-view.tsx`:**

The "Uw bevoegdheden" (authorities) section and "Uw documenten" section are shown
separately in the sidebar. Merge them under one collapsible header
"Your role & documents" so the sidebar is less cluttered. Keep both datasets, just
under one toggle. Collapsed by default on mobile, expanded on desktop.

---

## Fix 5 — Log management: clarify purpose or hide

**File:** `components/admin/control-dashboard.tsx` around line 678

**What it is:** The "log management" or `loggedControls` is actually a **live
assessment scoring system** — facilitators click dimension buttons during the exercise
to score how well the team is performing (e.g. "Decision quality", "Role compliance").
It is a useful feature but completely unlabelled, so facilitators don't know what it is.

**Fix:** Add a section header above the assessment controls with:
- Title: "Live Assessment" (font-mono, small, uppercase)
- One-line explanation: "Score team performance as it happens. Scores feed into the
  final report."
- Keep all existing `logControl` buttons as-is — just add the header and explanation.

Do NOT hide or collapse this — it is core facilitator functionality. Just label it properly.

---

## Fix 6 — Discussion section not prominent enough

**File:** `components/participant/play-view.tsx`

The discussion prompt block (around line 644, only visible when
`session.roundPhase === "discussion"`) is currently buried after the inject feed.

Move it to the **top of the main column**, before the inject feed and before everything
else. Style it to stand out: use a full-width banner with a left border accent, larger
font for the prompt text, and a label "NOW DISCUSSING" in the top-left corner.

---

## Fix 7 — After session creation redirect to lobby, not missing page

**File:** `components/admin/setup-form.tsx` line 231

`router.push("/admin/prepare")` — this path does not exist.
Change to `router.push("/admin/dashboard")`.

Also check `app/admin/dashboard/page.tsx`: when session `status === "lobby"`, show a
clear waiting state with the join code large and visible so participants can pick their
role before the facilitator starts.

---

## Fix 8 — BOB framework labels showing in decision button text

**File:** `app/api/session/create/route.ts` — BOB directive around line 169

The AI adds `[Beeldvorming]`, `[Oordeelvorming]`, `[Besluit]` tags into
`roleAction.label` and `roleAction.description`. Update the BOB directive so labels
are only allowed inside `facilitatorNotes.hints`, never in `roleAction.label` or
`roleAction.description`:

```
Add BOB phase labels ONLY inside facilitatorNotes.hints (e.g. "BOB — Beeldvorming: ...").
Never add BOB labels inside roleAction.label or roleAction.description.
```

**File:** `components/participant/decision-panel.tsx`

Add a sanitize function as a safeguard and apply it to `action.label` and
`action.description` before rendering:

```typescript
function stripFrameworkLabel(text: string): string {
  return text.replace(/\[\s*(Beeldvorming|Oordeelvorming|Besluit(?:vorming)?|[BOD])\s*\]/gi, '').trim()
}
```

---

## Fix 9 — Duplicate facilitator notes in facilitator dashboard

**File:** `components/admin/control-dashboard.tsx`

Facilitator notes appear twice — once in the main panel (around line 533) and once in
another sub-panel or sidebar section. Find both render locations by searching for
`facilitatorNotes` in this file. Remove the second occurrence entirely. Keep the main
panel version which shows `discussionGoal`, `keyQuestions`, `hints`, and `redFlags`.

---

## Fix 10 — Inject delivery delay

**File:** `lib/session-store.ts`

Find `pushInject()`. After `dbSetSession(updated)`, confirm `broadcastState(updated)`
is called immediately with no delay. If there is any `setTimeout`, `await` on a timer,
or polling interval between save and broadcast, remove it.

**File:** `app/api/session/state/route.ts`

Read this file. If there is a polling interval (e.g. `setInterval` every 4 seconds)
used as a fallback for SSE, ensure it does not delay the initial inject delivery.
The SSE push on state change must be instantaneous — the polling fallback is only for
reconnection, not for first delivery.

---

## Fix 11 — Decision phase in next round jumps straight to end

**Files:** `lib/session-store.ts` + `components/participant/play-view.tsx`

**Root cause:** When `goToNextRound()` is called it resets `roundPhase` to `"inject"`,
but something in the participant UI may still be triggering the end state.

Check two things:
1. In `goToNextRound()` in `session-store.ts`: `status: "ended"` must ONLY be set when
   `session.currentRound >= session.scenario.rounds.length - 1`. Add an explicit guard
   if not already present.
2. In `play-view.tsx`: the `DecisionPanel` must only render when
   `session.roundPhase === "decision"`. If there is any condition that renders it
   during `"inject"` or `"discussion"` phase, remove it.

---

## Fix 12 — Timer controllable by the team during discussion

**File:** `components/participant/play-view.tsx`

The `RoundTimerCompact` component is passive. Add a local pause/resume button next to
it, visible only during `session.roundPhase === "discussion"`. Use local `useState`
(no server state). When paused: timer stops locally, button shows "Resume". When
resumed: timer continues from where it stopped.

No new API calls. Timer initial value stays from `currentRound.timerMinutes`.

---

## Execution order

1. Fix 1 — feedback localStorage reset (2 lines)
2. Fix 2 — remove other roles' options from decision panel
3. Fix 7 — fix redirect after session creation
4. Fix 11 — decision phase round transition guard
5. Fix 3A + 3B + 3C — SOC framing + inject targeting + Dutch language in AI prompt
6. Fix 8 — BOB labels: directive update + sanitize function
7. Fix 9 — remove duplicate facilitator notes
8. Fix 6 — move discussion banner to top
9. Fix 5 — label the Live Assessment section
10. Fix 4A — document generator scenario context
11. Fix 4B — merge authorities + documents sidebar
12. Fix 10 — verify inject broadcast is immediate
13. Fix 12 — team-controlled timer

---

## Constraints

- No new files unless strictly necessary
- No breaking changes to `SessionState` — new fields are optional
- After every session mutation: `dbSetSession()` then `broadcastState()`
- TypeScript strict — no `any`
- Keep existing Tailwind class names and design tokens (`tt-accent`, `tt-border`, etc.)
