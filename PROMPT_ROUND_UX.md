# PROMPT — Round UX: locked routing, whole-round timeline, reliability game

Feed this whole file to Claude Code inside `/Users/pieterbaspluijmaekers/tabletop-upgraded-2`. Do the phases in order. Each phase compiles clean (`pnpm exec tsc --noEmit`) and passes its DoD before the next starts.

## Context

An earlier upgrade (`PROMPT_SCENARIO_BUILDER_V2.md`) is already merged and deployed. It added Homey-Flow style visuals, view-time inject routing, manual early push, discussion sub-phase auto-advance, and a participant phase timer for the BOB/OODA sub-phases.

This next pass finishes what that upgrade left half-done:

- **A. Lock inject routing at session start.** Right now routing is decided per-render on the client. It must be decided *once* when the session starts (or when the lobby stabilises), stored in `SessionState`, visible to the facilitator as a table, and stable for the participant.
- **B. Verify + polish manual early push.** Already implemented in Phase 9 of the earlier plan. Confirm end-to-end and add small UI improvements.
- **C. Whole-round phase timeline.** Participants should see the four top-level round phases (Briefing → Discussie → Beslissing → Review) auto-progressing across the round timer, with a proper timeline UI. Facilitator retains override.
- **D. Reliability as a game mechanic.** Remove the `✓ Feit / ? Aanname / ⚠ Ongeverifieerd` badges from inject cards. Replace with a "fact-check" mechanic where participants must categorise injects themselves through discussion; ground truth revealed in review.

## Global constraints

- No new dependencies. Everything with existing `lucide-react`, shadcn, and Tailwind.
- `ScenarioGraph` schema stays byte-compatible.
- Backwards compat: sessions started before this change (missing new fields) must not crash — treat absent fields as "old behavior".
- No comments except non-obvious WHY.
- Do NOT rewrite `control-dashboard.tsx` end-to-end (still 800+ lines). Surgical edits only.
- Do NOT touch `lib/graph/` internals — routing/timeline work is on `SessionState`, not on the graph.
- Every phase ends with a `pnpm exec tsc --noEmit` clean and a browser smoke test note.

---

# Phase A — Lock inject routing at session start

## A.1 The problem, precisely

`resolveInjectRecipients(inject, presentRoles, teamRoles)` runs today inside `components/participant/inject-feed.tsx` and `components/admin/inject-controls.tsx`. Every render recomputes. This has three bugs:

1. If a participant leaves for a moment (network hiccup, tab reload) their role drops from `presentRoles`, injects re-route to someone else, then jump back — flicker.
2. Facilitator sees a *live* preview column but can't rely on it as a plan; the plan changes as people join.
3. Ground-truth per inject is undefined — different clients could compute a different fallback if their `session.participants` snapshot is momentarily different.

Fix: compute a single routing map at session start (or when explicitly re-plotted by the facilitator), store it in `SessionState`, broadcast, and consult that map at read time.

## A.2 Data model

Extend `SessionState` in `lib/types.ts` (small addition, backwards-compatible):

```ts
export interface InjectRoutePlan {
  version: number                            // increment on every replot
  plottedAt: number
  presentRolesAtPlot: Role[]                 // snapshot used
  routes: Record<string, Role[]>             // key = inject.id → resolved recipient roles
}

export interface SessionState {
  // ...existing fields
  injectRoutePlan?: InjectRoutePlan          // undefined for sessions that predate this change
}
```

Do NOT change `Inject.targetRoles` semantics. The plan is an overlay: at read time, prefer `routePlan.routes[inject.id]` when defined; fall back to the current `resolveInjectRecipients` logic otherwise.

## A.3 Plotting

Create `lib/inject-routing.ts` additions (do not delete the existing `resolveInjectRecipients` — it stays as a fallback):

```ts
export function plotInjectRoutes(input: {
  scenario: Scenario
  presentRoles: Role[]
  teamRoles: Record<'crisis_management' | 'technical_it', Role[]>
}): InjectRoutePlan {
  const routes: Record<string, Role[]> = {}
  const load: Record<Role, number> = Object.fromEntries(input.presentRoles.map(r => [r, 0])) as Record<Role, number>

  for (const round of input.scenario.rounds) {
    for (const inject of round.injects) {
      const resolved = resolveInjectRecipients({
        inject,
        presentRoles: input.presentRoles,
        teamRoles: input.teamRoles,
      })

      // When the fallback chain returned a single-recipient broadcast, prefer the role
      // currently carrying the lowest inject load — spreads injects across the team
      // instead of piling them on the same person.
      const isHashFallback =
        !inject.targetRoles?.length &&
        (!inject.targetTeam || inject.targetTeam === 'all')

      let final = resolved
      if (isHashFallback && resolved.length === 1) {
        const leastLoaded = [...input.presentRoles].sort((a, b) => load[a] - load[b])[0]
        if (leastLoaded) final = [leastLoaded]
      }

      routes[inject.id] = final
      for (const r of final) load[r] = (load[r] ?? 0) + 1
    }
  }

  return {
    version: 1,
    plottedAt: Date.now(),
    presentRolesAtPlot: input.presentRoles,
    routes,
  }
}
```

The extra "load-balance the hash fallback" step is deliberate: `stableHash(inject.id) % presentRoles.length` produces skewed distributions when the scenario has few injects. Real load balancing here means "same person doesn't drown".

## A.4 When to plot

Plot points:

1. **Session start** (`startSession` in `session-store.ts`): call `plotInjectRoutes` and store on `SessionState`. If the scenario is graph-driven, plot lazily per round in the engine step (routes may be added incrementally — the map is keyed by `inject.id`, so it's append-only).
2. **Explicit facilitator "Replot" action**: when the lobby has changed a lot mid-session and the facilitator wants a fresh distribution. New endpoint `POST /api/session/replot-injects`. Increments `version`, keeps old-inject ids as-is where possible (a re-plot on a fresh present-roles snapshot).
3. **Graph engine `push_inject` output**: when the engine reveals a new round, plot routes for that round's injects and merge into `session.injectRoutePlan.routes`.

Do NOT auto-replot on every join/leave — the whole point is stability.

## A.5 Read-time helper

Create `lib/inject-routing.ts` addition:

```ts
export function getInjectRecipients(
  inject: Inject,
  session: SessionState,
  teamRoles: Record<'crisis_management' | 'technical_it', Role[]>,
): Role[] {
  const planned = session.injectRoutePlan?.routes[inject.id]
  if (planned && planned.length > 0) return planned
  // Fallback for old sessions or graph nodes not yet plotted
  const presentRoles = session.participants.map(p => p.role).filter((r): r is Role => !!r)
  return resolveInjectRecipients({ inject, presentRoles, teamRoles })
}
```

## A.6 Wire read-time helper into consumers

Replace the current inline `resolveInjectRecipients(...)` calls in:

- `components/participant/inject-feed.tsx` (filter block)
- `components/admin/inject-controls.tsx` (recipient chip)

with `getInjectRecipients(inject, session, teamRoles)`.

## A.7 Facilitator "routing table" panel

Add a compact panel to the facilitator dashboard (surgical edit — do not rewrite `control-dashboard.tsx`; add a new sibling component `components/admin/inject-route-plan.tsx` and mount it inside an existing tab or an existing collapsible section — grep for `<Tabs` in the dashboard).

Component contract:

```tsx
interface Props {
  session: SessionState
  teamRoles: Record<'crisis_management' | 'technical_it', Role[]>
  onReplot: () => Promise<void>
}
```

Renders:
- Small header: "Verdeling injects (versie {version}, geplot om {HH:MM})".
- Two-column table: left = inject title + round number, right = participant name(s) (via `ROLE_META[role].label` looked up against `session.participants[].role → participants[].name`).
- Per-row status chip: `Ingepland` / `Ingepland (afwijkend gepusht)` / `Bezorgd` — infer from `session.pushedInjects`.
- Footer button: "Herverdelen op basis van huidige lobby" → calls `onReplot`.

Use existing shadcn `Card`, `Table`, `Badge` primitives.

## A.8 API endpoint for replot

Create `app/api/session/replot-injects/route.ts`:

- `POST` → server calls `plotInjectRoutes` with the current session's participants + full scenario, bumps `version`, persists, broadcasts.
- Facilitator auth required (same guard as other admin routes).
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`.

Add to `lib/api-client.ts`:

```ts
replotInjects: () => post<void>("/api/session/replot-injects", {}),
```

## A.9 Timeline events

Add two timeline event types in `lib/types.ts` (extend `TimelineEventType` union):

- `inject_routes_plotted` — payload `{ version, count }`
- `inject_routes_replotted` — payload `{ version, count, triggeredBy: 'facilitator' }`

Emit inside `session-store.ts` at plot points. Extend `components/shared/timeline-panel.tsx` with two new switch arms (small, in the existing style).

## A.10 Definition of done — Phase A

- Start a session with participants CEO + CISO and a scenario that has an inject targeting `[cfo, legal]`. After start:
  - `session.injectRoutePlan.routes[<that-inject-id>]` is either `[ceo]` or `[ciso]`, and the assignment doesn't flip on refresh.
  - Facilitator "Verdeling injects" panel shows a row with a participant name.
  - The intended participant sees the inject; the other does not.
- Facilitator clicks "Herverdelen" → `version` bumps from 1 to 2, some rows may reassign, timeline logs `inject_routes_replotted`.
- Sessions created before this change still work (undefined `injectRoutePlan` falls through to the read-time fallback).

---

# Phase B — Verify and polish manual early push

The `pushInject` re-time logic ships in the current build (see `PROMPT_SCENARIO_BUILDER_V2.md` Phase 9). This phase just verifies end-to-end and fixes any rough edges.

## B.1 Smoke test walk-through

Facilitator flow to execute manually:

1. Create a scenario with an inject that has `deliverySeconds: 300`.
2. Start the session.
3. Open the facilitator dashboard → Injects panel of the current round.
4. Find the inject. Expected state: badge shows "Ingepland — over 4:59" (or similar), button "Push earlier".
5. Click "Push earlier". Expected: button flips to "Bezorgd", participant client shows the inject immediately.
6. Repeat with an inject that has `deliverySeconds: 0` → button reads "Push nu" (existing behavior).
7. Try clicking "Push earlier" on an already-delivered inject → button disabled, no request fires.

## B.2 UI polish

If the current state chip isn't obvious, tighten in `components/admin/inject-controls.tsx`:

- Idle: `Push nu` (primary button, filled).
- Scheduled future: `Push nu (was over X:XX)` (accent button with a small `Clock` icon).
- Delivered: `✓ Bezorgd om {HH:MM}` (muted, disabled).

Show the delivery time using the actual `pushedAt` from `session.pushedInjects`.

## B.3 Copy alignment

Everywhere in the facilitator UI, use consistent Dutch labels: `Ingepland`, `Bezorgd`, `Push nu`, `Push eerder`. Grep for English fragments (`Delivered`, `Push earlier`) and translate.

## B.4 Definition of done — Phase B

- Manual walk-through matches step-by-step behavior above.
- No English strings remain in inject-controls panel.
- Timeline shows exactly one `inject_advanced` event per manual early push (not two).

---

# Phase C — Whole-round phase timeline

## C.1 Model

Round has four phases: `inject | discussion | decision | review` (`RoundPhase` in `lib/types.ts`). Each round has `timerMinutes` as its overall budget. Distribute across the four phases with configurable weights.

Add to `lib/engine/facilitator-support.ts` (or a new small file `lib/engine/round-phases.ts`, whichever is cleaner):

```ts
export interface RoundPhaseTiming {
  id: RoundPhase
  label: string                              // Dutch: "Briefing", "Discussie", "Beslissing", "Review"
  weight: number                             // fraction of round budget, sums to 1
  minSeconds: number                         // hard floor (avoid absurdly short phases in tiny rounds)
}

export const ROUND_PHASE_TIMINGS: RoundPhaseTiming[] = [
  { id: 'inject',     label: 'Briefing',   weight: 0.15, minSeconds: 60  },
  { id: 'discussion', label: 'Discussie',  weight: 0.55, minSeconds: 180 },
  { id: 'decision',   label: 'Beslissing', weight: 0.20, minSeconds: 90  },
  { id: 'review',     label: 'Review',     weight: 0.10, minSeconds: 45  },
]
```

Rationale:
- Briefing is short — situational awareness, read injects.
- Discussion is the meat — deliberation + BOB/OODA sub-phases.
- Decision is short but weighty — actual choice-making.
- Review is a brief reflection + ground truth reveal (Phase D depends on this).

Weights sum to 1.0. Sum of `minSeconds` = 375s = 6:15, so a round of 6 minutes or less collapses to the minimums (in that order). Otherwise proportional.

Add a helper:

```ts
export function computeRoundPhaseDurations(roundBudgetSeconds: number): Record<RoundPhase, number> {
  const timings = ROUND_PHASE_TIMINGS
  const minSum = timings.reduce((a, t) => a + t.minSeconds, 0)
  const budget = Math.max(roundBudgetSeconds, minSum)
  const extra = budget - minSum

  const out = {} as Record<RoundPhase, number>
  for (const t of timings) {
    out[t.id] = t.minSeconds + extra * t.weight
  }
  return out
}
```

## C.2 Extend SessionState

```ts
export interface RoundPhaseState {
  roundNumber: number
  currentPhase: RoundPhase
  phaseStartedAt: number
  durations: Record<RoundPhase, number>   // computed at round start
}

export interface SessionState {
  // ...existing
  activeRoundPhaseState?: RoundPhaseState
}
```

Both `activeRoundPhaseState` (whole-round) and `activeDiscussionPhase` (BOB/OODA sub-phases within discussion) coexist. The BOB/OODA layer only advances while `currentPhase === 'discussion'`.

## C.3 Auto-advance across all four phases

Extend `tickPhases` in `lib/session-store.ts` (or add a sibling `tickRoundPhase`):

```ts
function tickRoundPhase(session: SessionState): SessionState {
  const state = session.activeRoundPhaseState
  if (!state) return session
  if (session.phaseAutoAdvancePaused) return session
  if (session.graph) return session  // graph-driven: engine controls transitions

  const durationMs = (state.durations[state.currentPhase] ?? 0) * 1000
  const elapsedMs = Date.now() - state.phaseStartedAt
  if (elapsedMs < durationMs) return session

  const order: RoundPhase[] = ['inject', 'discussion', 'decision', 'review']
  const currentIdx = order.indexOf(state.currentPhase)
  const nextPhase = order[currentIdx + 1]
  if (!nextPhase) return session   // round ended; wait for facilitator to advance the round

  return {
    ...session,
    roundPhase: nextPhase,
    activeRoundPhaseState: {
      ...state,
      currentPhase: nextPhase,
      phaseStartedAt: state.phaseStartedAt + durationMs,
    },
    // If we're entering discussion, start the first sub-phase automatically.
    activeDiscussionPhase: nextPhase === 'discussion'
      ? { roundNumber: state.roundNumber, phaseIndex: 0, phaseStartedAt: Date.now(), extended: false }
      : undefined,
  }
}
```

Call `tickRoundPhase` in the same places `tickPhases` runs (inside `mutate` and `broadcastState`), BEFORE `tickPhases` (so sub-phase ticker sees the up-to-date round phase).

## C.4 Initialise on round start

Wherever `currentRound` advances (`nextRound`, `prevRound`, graph engine `start_round` output), set:

```ts
const roundBudgetSeconds = (round.timerMinutes ?? 10) * 60
session.activeRoundPhaseState = {
  roundNumber: round.round_number,
  currentPhase: 'inject',
  phaseStartedAt: Date.now(),
  durations: computeRoundPhaseDurations(roundBudgetSeconds),
}
session.roundPhase = 'inject'
```

## C.5 Participant phase timeline component

Create `components/participant/round-phase-timeline.tsx`. This is the marquee UI piece — it must feel purposeful, not busy.

Design (matte, tactile, matches the existing tt-* design tokens):

```
┌────────────────────────────────────────────────────────────────┐
│  Briefing  ●━━━━━━━●━━━━━━━━━━●━━━━━━━━━━━━━━●━━━━━━━━━━━━━━●  │
│            Discussie          Beslissing      Review           │
│                                                                │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░  Discussie — 2:43 / 5:30           │
└────────────────────────────────────────────────────────────────┘
```

Structure:
- Row 1: four labeled nodes on a horizontal line. Past = filled dot in accent color, current = larger pulsing dot, upcoming = hollow. Connectors between: filled up to current, faded after.
- Row 2: sub-progress bar for the current phase, with `phaseLabel — MM:SS / MM:SS` remaining.
- If current phase is `discussion` and `activeDiscussionPhase` is set, insert a secondary row underneath with the BOB/OODA `PhaseSegments` (existing component) — nested progression.

```tsx
"use client"
import { useEffect, useState } from "react"
import type { RoundPhase } from "@/lib/types"
import type { RoundPhaseState } from "@/lib/types"
import { ROUND_PHASE_TIMINGS } from "@/lib/engine/round-phases"

interface Props {
  state: RoundPhaseState
  paused?: boolean
}

export function RoundPhaseTimeline({ state, paused }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [paused])

  const order: RoundPhase[] = ['inject', 'discussion', 'decision', 'review']
  const currentIdx = order.indexOf(state.currentPhase)
  const durationMs = (state.durations[state.currentPhase] ?? 0) * 1000
  const elapsedMs = Math.max(0, now - state.phaseStartedAt)
  const remainingMs = Math.max(0, durationMs - elapsedMs)
  const pct = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0
  const min = Math.floor(remainingMs / 60000)
  const sec = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0")
  const totalMin = Math.floor(durationMs / 60000)
  const totalSec = Math.floor((durationMs % 60000) / 1000).toString().padStart(2, "0")
  const currentTiming = ROUND_PHASE_TIMINGS.find(t => t.id === state.currentPhase)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-tt-border bg-tt-surface px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {ROUND_PHASE_TIMINGS.map((t, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={t.id} className="flex flex-col items-start gap-1.5">
              <div className="flex items-center gap-2 w-full">
                <span
                  className={`inline-block size-2 rounded-full shrink-0 ${
                    done ? "bg-tt-accent" : active ? "bg-tt-accent animate-pulse ring-2 ring-tt-accent/30" : "bg-tt-border"
                  }`}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest truncate ${
                    done ? "text-tt-bright" : active ? "text-tt-accent" : "text-tt-dim"
                  }`}
                >
                  {t.label}
                </span>
              </div>
              <div
                className={`h-0.5 w-full rounded-full ${
                  done ? "bg-tt-accent" : active ? "bg-tt-accent/40" : "bg-tt-border/40"
                }`}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 h-1 rounded-full bg-tt-border/40 overflow-hidden">
          <div
            className="h-full bg-tt-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-tt-dim shrink-0">
          {currentTiming?.label} — <span className={remainingMs < 30_000 ? "text-red-500" : "text-tt-bright"}>{min}:{sec}</span> / {totalMin}:{totalSec}
        </span>
      </div>
    </div>
  )
}
```

## C.6 Mount in participant view

In `components/participant/play-view.tsx`, mount `<RoundPhaseTimeline state={session.activeRoundPhaseState} paused={session.phaseAutoAdvancePaused} />` near the top of the active-round area — above `RoundTimerCompact` (or replace `RoundTimerCompact` entirely if it becomes redundant; grep first, decide).

Do NOT delete the existing BOB/OODA `PhaseTimer` / `PhaseSegments` — they nest inside the discussion phase, providing sub-progress.

## C.7 Facilitator override

Facilitator dashboard needs three buttons in a "Fase-controle" row (surgical add):

- **← Vorige fase** — call `setPhase(prev)`; if going backwards resets the round timeline entry point, that's acceptable.
- **Volgende fase →** — call `setPhase(next)`; also resets `activeRoundPhaseState.phaseStartedAt = Date.now()` so auto-advance realigns.
- **Pauze auto-advance** (existing toggle, keep as-is).

`setPhase` in `lib/session-store.ts` must be extended: when the phase is set manually, also update `activeRoundPhaseState.currentPhase` and reset `phaseStartedAt`. Do not delete `durations`.

## C.8 Definition of done — Phase C

- Start a session with a 10-minute round. `activeRoundPhaseState.durations` is roughly `{inject: 90, discussion: 330, decision: 120, review: 60}` (proportional after minimums).
- Participants see a four-node timeline. Current phase pulses. Progress bar fills. Time counts down.
- Around minute ~1:30 without any facilitator click, phase auto-advances to Discussie. BOB/OODA sub-phase appears nested. Timeline moves to node 2.
- Facilitator "Volgende fase →" jumps early and resets the countdown.
- "Pauze auto-advance" freezes both timelines.
- Existing sessions without `activeRoundPhaseState` don't crash — the timeline component simply doesn't render.

---

# Phase D — Reliability as a game mechanic

## D.1 Design principle

Right now the participant sees a green ✓ Feit or yellow ? Aanname badge on each inject. This spoon-feeds the answer. Cyber crisis training is exactly about learning to weigh unverified info under time pressure — the badge kills the exercise.

New mechanic, in one line: **"Ground truth is hidden. Participants privately tag each inject. Team accuracy is revealed in review."**

Concretely:

1. Every inject with a `reliability` field defined becomes a "fact-check target". No visible badge.
2. During any phase before review, participants can open a small `Verify` action per inject → three options: `Feit`, `Aanname`, `Misleidend`.
3. Their tag is private (facilitator can see it live; other participants can't).
4. In the `review` phase, ground truth is revealed for every tagged inject, per-participant accuracy is shown, and a team score is computed.
5. Injects with `reliability='misleading'` that a participant *acted on* (submitted a decision that references it) get flagged in the debrief.

This turns unreliable info from a passive label into an active judgement — the whole point.

## D.2 Data model

Extend `lib/types.ts`:

```ts
export type FactCheckTag = 'fact' | 'assumption' | 'misleading'

export interface FactCheckEntry {
  injectId: string
  participantId: string
  tag: FactCheckTag
  taggedAt: number
  changedCount: number   // times participant switched their tag (behavioral signal)
}

export interface SessionState {
  // ...existing
  factChecks?: FactCheckEntry[]
}
```

## D.3 Server actions

Add to `lib/session-store.ts`:

```ts
export async function tagInject(input: {
  participantId: string
  injectId: string
  tag: FactCheckTag
}): Promise<{ ok: boolean; error?: string }>
```

Behavior:
- Idempotent — same tag as before is a no-op.
- On change: bump `changedCount` on the existing entry (or start at 0 on first tag).
- Reject if `session.roundPhase === 'review'` — tags lock at review start.
- Emit timeline event `inject_tagged` (facilitator sees it live).

New API route `app/api/session/tag-inject/route.ts` — participant auth (existing pattern), `runtime = "nodejs"`, calls `tagInject`.

Add to `lib/api-client.ts`:

```ts
tagInject: (input: { participantId: string; injectId: string; tag: FactCheckTag }) =>
  post<void>("/api/session/tag-inject", input),
```

## D.4 Participant UI — remove badges, add action

### D.4.1 Delete the reliability badges

In `components/participant/inject-feed.tsx` remove the three `{inject.reliability === "fact" ...}`, `{inject.reliability === "assumption" ...}`, `{inject.reliability === "unverified" ...}` blocks (lines ~97-111 in current code). Do not delete the `nis2Relevant` badge; that stays.

### D.4.2 Add per-inject Verify action

Under each inject card body (bottom-right, small), add:

```tsx
<InjectVerifyMenu
  injectId={inject.id}
  currentTag={myTag}
  disabled={session.roundPhase === 'review'}
  onTag={(tag) => api.tagInject({ participantId, injectId: inject.id, tag })}
/>
```

Component `components/participant/inject-verify-menu.tsx`:

- Trigger: subtle icon button `<ShieldCheck size=12 />` with muted color when no tag, accented when a tag is set.
- On click → shadcn `Popover` with three vertical options:
  - **Feit** — "Ik heb dit geverifieerd of vertrouw de bron"
  - **Aanname** — "Plausibel maar niet gecheckt"
  - **Misleidend** — "Ik denk dat dit niet klopt"
- Selecting sets the tag; a tiny colored dot appears next to the shield icon indicating your current tag (no text — the categorisation stays private-looking).
- Menu closes automatically.

Important: the dot's color matches the tag, but the icon itself is neutral — someone glancing at another participant's screen shouldn't be able to instantly read the tag. Keep it subtle.

### D.4.3 Live team tag counts (subtle, not spoiler-y)

Under the inject body, opposite the Verify menu, show a small line:

```
3 markeringen · 1 uitgesplitst
```

Where `3 markeringen` is total tags from all participants, `1 uitgesplitst` means at least one participant disagrees with the others. Do NOT show the counts per category — that's the review-phase reveal.

Rationale: participants see that the group is engaging with fact-checking, and see when there's disagreement (prompting discussion), but the tally is hidden until review. Encourages talking to each other instead of copying tags.

Compute from `session.factChecks.filter(f => f.injectId === inject.id)`.

## D.5 Facilitator UI — live tag distribution

Add a new panel `components/admin/fact-check-panel.tsx` in the facilitator dashboard (surgical mount inside an existing tab — grep for existing sibling panels):

Per inject with `reliability !== undefined`:
- Inject title + ground truth badge (only facilitator sees `Feit / Aanname / Misleidend`).
- Tag distribution bar: green (Feit) / yellow (Aanname) / red (Misleidend), proportional widths.
- Per-participant chip: name + their tag (or "—" if unset).
- Change count aggregate: `Totaal 4 wisselingen` — a signal that people are debating.

This panel is the *facilitator superpower* — they can see confusion form, and gently steer discussion without giving the answer.

## D.6 Review phase — ground truth reveal

When `session.roundPhase === 'review'` (auto-triggered by Phase C timeline), the participant view shows a "Fact-check review" block per round:

- Every inject with `reliability !== undefined` gets a card.
- Two columns:
  - **Jouw markering** — the participant's own tag (colored dot + label).
  - **Waarheid** — the ground truth (colored dot + label).
  - Match = green check, mismatch = red cross, unmarked = gray dash.
- Per-round accuracy line: `Jij: 4/5 correct · Team gemiddeld: 3.2/5`.
- After all rounds: cumulative session accuracy shown in the debrief.

Component: `components/participant/fact-check-review.tsx`. Mount above the existing review content.

Team accuracy is computed server-side:

```ts
// lib/engine/fact-check-score.ts
export function computeFactCheckScore(session: SessionState): {
  perParticipant: Record<string, { correct: number; total: number }>
  teamAverage: number
} { ... }
```

Fold this score into `debriefEngine` (existing) as a new dimension: `information_reliability`. Do not break existing debrief dimensions.

## D.7 Misleading + acted-on flag

If a participant submitted a `roleAction` whose `linkedInjectId` (if such a field exists — grep) matches an inject they tagged as `fact` (or didn't tag at all) and whose ground truth is `misleading`, surface a debrief note:

`"Je baseerde je actie op {inject.title} — dat bericht was misleidend. Was er iets aan bron of vorm dat je had kunnen doen twijfelen?"`

If there's no `linkedInjectId` on `RoleAction`, do NOT invent one — instead, in the debrief simply list the misleading injects the participant tagged as `fact`, if any. Grep for a link between decisions and injects; if it doesn't exist, defer that specific enhancement to a later iteration and note it in the DoD.

## D.8 Inspector default cleanup

In the builder inspector (`components/admin/builder/inspector.tsx`), the reliability dropdown currently reads `⚠ Ongeverifieerd`. Keep that label but add a helper text:

`"Alleen jij (facilitator) ziet dit. Participanten moeten zelf de betrouwbaarheid bepalen."`

This makes the game design explicit to scenario authors.

## D.9 Definition of done — Phase D

- Fresh session, participant opens the feed: **no green/yellow/orange reliability badge** on any inject.
- Small shield icon at the bottom-right of each inject with a `reliability` set. Tapping opens a 3-option popover.
- After tagging, the icon shows a small colored dot. Team counter reads `1 markering`.
- Second participant tags differently → counter reads `2 markeringen · 1 uitgesplitst`.
- Facilitator dashboard fact-check panel shows the ground truth + tag distribution + per-participant tags live.
- Round enters review → participant view shows a fact-check review card per inject with correctness marks and a personal + team accuracy line.
- Cumulative accuracy appears in the debrief under a new `Information reliability` dimension.
- Tags are locked (no further changes possible) once `roundPhase === 'review'`.
- Old sessions without `factChecks` don't crash — undefined treated as empty array.

## D.10 Personal visible marker (extra — after tagging, tagger sees it)

Once a participant has tagged an inject, THEY (and only they) see a subtle visible marker on the inject card so they can quickly scan back through the feed and remember what they marked. Other participants still see nothing — the game mechanic is preserved.

Marker design:
- Colored 3px left border on the inject card, replacing the existing accent-neutral border:
  - `fact` → `border-l-emerald-500`
  - `assumption` → `border-l-yellow-500`
  - `misleading` → `border-l-red-500`
- Small colored pill next to the timestamp with the tag label, but rendered in "own-tag" muted style — not the loud reliability badge we deleted:
  - `bg-emerald-500/10 text-emerald-500` (or the tag color variant)
  - Small caps, `font-mono text-[9px]`, `border` variant only.
- The pill is only rendered when `session.factChecks.some(f => f.participantId === myId && f.injectId === inject.id)`.
- Long-tap / hover on the pill shows a small tooltip: "Alleen jij ziet dit — jouw eigen markering".

Implementation notes:
- Compute `myTag` inside `inject-feed.tsx` from `session.factChecks` and pass it as a prop into the inject card renderer.
- Do NOT render the marker for other participants' tags (that stays private).
- In review phase, the marker stays but is joined by the ground-truth reveal card (from D.6).

## D.11 Inline text-highlight annotations (extra — participant markup)

Alongside the whole-inject tag, participants can mark specific spans of the inject body as fact/assumption/misleading. This is annotation over reading — closer to how a real analyst underlines "confirmed by SOC" vs "reported by user".

Model:

```ts
export interface InjectAnnotation {
  id: string
  injectId: string
  participantId: string
  start: number         // char offset in inject.content
  end: number
  tag: FactCheckTag
  createdAt: number
}

export interface SessionState {
  // ...existing
  injectAnnotations?: InjectAnnotation[]
}
```

UI mechanic:
- In the inject content area, when the participant selects text (mouseup with non-empty selection), a floating micro-toolbar appears near the selection with three colored dots (Feit / Aanname / Misleidend). Clicking creates an annotation.
- Highlighted spans in that participant's own feed show as subtle underlines in the tag color: `underline decoration-2 decoration-emerald-500/60` (or yellow/red).
- Clicking an existing highlight shows a small popover to remove it.
- Other participants do NOT see anyone else's highlights (private, matches the game mechanic).
- In review phase, participant sees a diff: their highlighted spans vs the ground-truth annotations (if the scenario author defined any) or just their own highlights alongside the inject-level ground truth from D.6.

Server actions in `session-store.ts`:

```ts
export async function addAnnotation(input: {
  participantId: string
  injectId: string
  start: number
  end: number
  tag: FactCheckTag
}): Promise<{ ok: boolean; error?: string; annotationId?: string }>

export async function removeAnnotation(input: {
  participantId: string
  annotationId: string
}): Promise<{ ok: boolean; error?: string }>
```

Reject `addAnnotation` when `session.roundPhase === 'review'` (locks with tags).

API routes:
- `POST /api/session/annotate-inject` — body `{ injectId, start, end, tag }`
- `DELETE /api/session/annotate-inject?id=...`

Component: `components/participant/inject-annotator.tsx` — wraps the inject body and handles selection → toolbar → dispatch. Use plain DOM `Selection` API; no rich-text editor.

Rendering annotations:
- In `inject-feed.tsx`, split the inject body into segments based on the participant's own annotations. Apply the tag-color underline per segment.
- Overlapping annotations: last-write-wins on the visible color, but keep both in state. Do not spend time on complex range merging — treat each annotation as an independent span with `z-index` order = createdAt.

Scenario-author ground truth for spans (optional, can be deferred):
- Add an optional `Inject.groundTruthAnnotations?: Array<{ start: number; end: number; tag: FactCheckTag }>` field to the type.
- If present, review phase compares participant annotations to these spans (character overlap % → correctness).
- If absent, review only reveals the inject-level ground truth (Phase D.6), and the participant's annotations are shown for their own reference without scoring.

Scoring impact:
- `computeFactCheckScore` gets an optional annotation-level component when `groundTruthAnnotations` is provided by the scenario. Weight it lower than inject-level scoring (annotations are bonus signal, not a required exercise).

## D.12 Definition of done — Phase D extras

- Tag an inject as Feit → left border turns emerald, small "Feit" pill appears next to timestamp, only visible in your own view.
- Second participant sees no marker on that inject in their view.
- Select a phrase inside an inject body → floating toolbar with three dots appears → click yellow → the phrase underlines yellow.
- Refresh the tab → annotations persist (they're in `SessionState`).
- Second participant does not see the underline.
- Review phase: annotations shown alongside inject-level ground truth. If the scenario has `groundTruthAnnotations`, correctness marks appear per span.

---

# File map — all phases

## Files you ADD
```
lib/engine/round-phases.ts                 (Phase C)
lib/engine/fact-check-score.ts             (Phase D)
components/admin/inject-route-plan.tsx     (Phase A)
components/admin/fact-check-panel.tsx      (Phase D)
components/participant/round-phase-timeline.tsx  (Phase C)
components/participant/inject-verify-menu.tsx    (Phase D)
components/participant/inject-annotator.tsx      (Phase D.11)
components/participant/fact-check-review.tsx     (Phase D)
app/api/session/replot-injects/route.ts   (Phase A)
app/api/session/tag-inject/route.ts        (Phase D)
app/api/session/annotate-inject/route.ts   (Phase D.11)
```

## Files you EDIT
```
lib/types.ts                              (A, C, D — new SessionState fields, timeline event types, FactCheckTag)
lib/session-store.ts                      (A — plot, replot, integrate into startSession + graph engine
                                           C — tickRoundPhase, extend tickPhases, extend setPhase
                                           D — tagInject action)
lib/inject-routing.ts                     (A — plotInjectRoutes, getInjectRecipients)
lib/api-client.ts                         (A, D — new endpoints)
lib/engine/debrief.ts                     (D — include information_reliability dimension)
components/participant/inject-feed.tsx    (A — read from plan, D — remove badges + add Verify menu)
components/participant/play-view.tsx      (C — mount timeline, D — mount fact-check-review in review phase)
components/admin/control-dashboard.tsx    (A — mount inject-route-plan panel
                                           C — Vorige/Volgende fase buttons row
                                           D — mount fact-check-panel)
components/admin/inject-controls.tsx      (A — use getInjectRecipients
                                           B — polish state chips)
components/admin/builder/inspector.tsx    (D — helper text under reliability dropdown)
components/shared/timeline-panel.tsx      (A — inject_routes_plotted / replotted arms
                                           D — inject_tagged arm)
```

## Files you WILL NOT touch
- `lib/graph/*` — no builder/graph internals changed.
- Any file outside the list above unless a compile error forces it, and only surgically.

---

# Execution order — checklist

1. Phase A.2 — extend types (`InjectRoutePlan`, add to `SessionState`).
2. Phase A.3–A.5 — `plotInjectRoutes` + `getInjectRecipients`, wire into `startSession` and graph engine.
3. Phase A.6 — swap consumers to `getInjectRecipients`.
4. Phase A.7–A.8 — facilitator panel + replot endpoint.
5. Phase A.9–A.10 — timeline events, DoD smoke test.
6. Phase B — verification + copy polish.
7. Phase C.1–C.4 — round phase timing model + `tickRoundPhase` + init.
8. Phase C.5–C.7 — participant timeline + facilitator override buttons.
9. Phase C.8 — DoD smoke test.
10. Phase D.2–D.3 — types + `tagInject` action + API route.
11. Phase D.4 — remove badges, add Verify menu, subtle counters.
12. Phase D.5 — facilitator fact-check panel.
13. Phase D.6 — review reveal component + score computation + debrief integration.
14. Phase D.7 — misleading-acted-on debrief flag (or defer with note).
15. Phase D.8 — inspector helper text.
16. Phase D.9 — DoD smoke test.
17. Final: full walk-through with 2 participants + 4-phase timeline + fact-check review; deploy preview; user tests; if good, promote to prod (retain existing `backup/pre-builder-v2` semantics — create a fresh `backup/pre-round-ux` branch at current `main` HEAD before pushing).

---

# Non-goals (explicitly)

- Do NOT add per-inject "trust score" cross-session — factChecks reset per session.
- Do NOT show category-level tag counts to participants during play — only the total and the "disagreement" hint. The reveal is a review-phase moment.
- Do NOT auto-tag anything for the participant based on inject type or sender heuristics.
- Do NOT reveal the ground truth to participants at any point before the review phase, even if a facilitator wants to. The training value is the discussion, and revealing early destroys that. If the facilitator absolutely needs to spoil, they can pause auto-advance and jump to review.
