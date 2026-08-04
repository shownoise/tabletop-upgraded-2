# Bug fixes — do these before any logic changes

Read every file in full before editing. Follow existing design tokens and TypeScript patterns.

---

## Context

This is a tabletop crisis exercise platform. The facilitator's company is the client's
outsourced SOC + IR retainer. Participants are the client's crisis team. The platform
uses SSE for real-time state, BOB/OODA as decision frameworks, and AI-generated scenarios.

---

## Bug 1 — Mixed Dutch/English across all screens

**Root cause:** Several hardcoded English strings bypass the `tr(lang, key)` i18n system.

**Files to fix:**

`components/participant/play-view.tsx` — Find these hardcoded English strings and replace
with Dutch or add to i18n:
- `"A special event has been triggered!"` → `"Er is een speciaal event getriggerd!"`
- `"New inject: ${inj.title}"` → `"Nieuw inject: ${inj.title}"`
- `"Exercise started"` → `"Oefening gestart"`
- `"Exercise ended"` → `"Oefening afgerond"`
- `"Failed to claim role"` → `"Rol claimen mislukt"`
- `"Exercise started. Good luck."` (if present) → `"Oefening gestart. Succes."`
- Any other literal English strings that are user-facing

`app/observe/page.tsx` — All strings are currently Dutch hardcoded. That is fine.
But check for any English labels like `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"` in
`SEVERITY_LABELS` — translate to `"LAAG"`, `"MEDIUM"`, `"HOOG"`, `"KRITIEK"`.

`components/participant/decision-panel.tsx` — Search for any English strings and replace
with Dutch equivalents.

`components/admin/control-dashboard.tsx` — Search for English strings that appear in
the facilitator UI. Hardcoded labels are fine in Dutch; any English-only labels should
be translated or made bilingual.

**Rule:** Every user-facing string must be Dutch. Technical labels in code (variable
names, console logs) stay English. Do a full search for `"` strings in each component
and check each one.

---

## Bug 2 — Markdown `**bold**` renders as literal asterisks

**Root cause:** `inject.content`, `doc.content`, and AI-generated `situation_update`
strings contain markdown formatting (`**bold**`, `*italic*`, `- list item`). These are
rendered with `{inject.content}` as plain text — no markdown parser is applied.

**Fix — create a shared utility:**

Create `lib/render-markdown.ts`:

```typescript
// Minimal markdown → plain-text sanitizer for terminal-style UI.
// Strips formatting markers without adding HTML — keeps the mono/terminal aesthetic.
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')        // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')             // *italic* → italic
    .replace(/^#{1,6}\s+/gm, '')             // ## heading → heading
    .replace(/^[-*+]\s+/gm, '• ')           // - list → • list
    .replace(/`(.+?)`/g, '$1')              // `code` → code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // [text](url) → text
    .trim()
}
```

**Apply in:**
- `components/participant/inject-feed.tsx` — wrap every `{inject.content}` with
  `{stripMarkdown(inject.content)}`
- `components/participant/play-view.tsx` — wrap `{currentRound.situation_update}` with
  `{stripMarkdown(currentRound.situation_update)}`
- `components/participant/decision-panel.tsx` — wrap `action.label` and
  `action.description` with `stripMarkdown()`
- `lib/document-generator.ts` — documents are pre-rendered text; strip there too if
  content is passed through AI generation
- `app/observe/page.tsx` — wrap `{currentRound.situation_update}` with `stripMarkdown()`

Do NOT use a full markdown-to-HTML renderer (no `react-markdown` dependency). The UI
is terminal-style and plain text fits the aesthetic.

---

## Bug 3 — Pre-selected roles still show in role picker

**Root cause:** `RolePickerLobby` in `components/participant/play-view.tsx` uses
`CRISIS_ROLES_ORDERED` (hardcoded, all 7 roles) and never reads
`session.config.selectedRoles`.

**Fix:** In `RolePickerLobby`, filter the displayed roles:

```typescript
const allowedRoles: Role[] = (session.config.selectedRoles?.length ?? 0) > 0
  ? CRISIS_ROLES_ORDERED.filter(r => session.config.selectedRoles!.includes(r))
  : CRISIS_ROLES_ORDERED

// Then map over allowedRoles instead of CRISIS_ROLES_ORDERED
```

Also add `it_manager` and `system_admin` to the picker if they are in `selectedRoles`
but not in `CRISIS_ROLES_ORDERED` — check `ROLE_META` keys and include technical roles
if the config includes them.

**Full ROLES_ALL constant (replace CRISIS_ROLES_ORDERED in the filter source):**
```typescript
const ALL_ROLES: Role[] = [
  "ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager",
  "it_manager", "system_admin"
]
const allowedRoles = (session.config.selectedRoles?.length ?? 0) > 0
  ? ALL_ROLES.filter(r => session.config.selectedRoles!.includes(r))
  : CRISIS_ROLES_ORDERED
```

---

## Bug 4 — BOB phase does not reset when moving to the next round

**Root cause:** `goToNextRound()` in `lib/session-store.ts` (line ~243) sets
`roundPhase: "inject"` but does NOT clear `activeDiscussionPhase` or
`currentDiscussionPrompt`. When the facilitator then opens the discussion phase in
the new round, the old BOB phase index persists.

Also: when `roundPhase` becomes `"inject"` the discussion block in `play-view.tsx`
disappears immediately — so participants see the BOB phases "close" instantly when
the round transitions, before the facilitator has a chance to open discussion again.

**Fix A — session-store.ts `goToNextRound()`:** Add reset fields to the updated state:

```typescript
let updated: SessionState = {
  ...session,
  currentRound: nextIdx,
  roundStartedAt: Date.now(),
  roundPhase: "inject" as RoundPhase,
  activeDiscussionPhase: undefined,      // ADD THIS
  currentDiscussionPrompt: undefined,    // ADD THIS
  currentDiscussionPhaseIndex: undefined // ADD THIS if field exists on SessionState
}
```

Check `lib/types.ts` for the exact field names on `SessionState` related to discussion
phase and clear all of them.

**Fix B — `setPhase("discussion")` in `session-store.ts`:** When the facilitator sets
phase to `"discussion"` for a new round, always start from `phaseIndex: 0` (first BOB
phase), never inherit from previous round. Verify this is the case in `setPhase()`.

---

## Bug 5 — Observe page: add BOB phase indicator and make it dynamic

**File:** `app/observe/page.tsx`

The observe page currently shows round info, inject feed, participants, and decisions.
It is missing: current BOB/OODA phase, phase timer, and round phase indicator.

**Add to the top bar (next to the round timer):**
- Current `session.roundPhase` as a badge: "INJECT" / "DISCUSSIE" / "BESLISSING" / "REVIEW"
  — use distinct colors per phase (inject=blue, discussion=amber, decision=red, review=green)

**Add to the left column, directly below the round situation card:**
- When `session.roundPhase === "discussion"` and `session.currentDiscussionPrompt`:
  Show a BOB phase panel with:
  - Phase number: `session.currentDiscussionPhaseIndex + 1` / total phases
  - Phase name (derive from index: 0=Beeldvorming, 1=Oordeelvorming, 2=Besluitvorming for BOB)
  - The `session.currentDiscussionPrompt` text
  - A progress bar showing phase progress (filled segments, one per phase)

**Add to the right column, above the decisions block:**
- A "Ronde fase" indicator showing the phase flow:
  INJECT → DISCUSSIE → BESLISSING → REVIEW
  with the current phase highlighted

---

## Bug 6 — Notification sound on new inject

**Files:** `components/participant/play-view.tsx` + `components/participant/inject-feed.tsx`

When a new inject is pushed, participants currently get a visual banner. Add an
audible notification.

**Implementation:** Use the Web Audio API — no external dependency needed:

Create `lib/sounds.ts`:
```typescript
export function playNotificationSound(type: 'inject' | 'urgent' | 'round') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'urgent') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } else if (type === 'round') {
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } else {
      osc.frequency.setValueAtTime(523, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.25)
    }
    osc.onended = () => ctx.close()
  } catch { /* AudioContext not available — silent fail */ }
}
```

In `play-view.tsx`, in the `onEvent` handler (around line 536):
- `push_inject` or `surprise_inject` → `playNotificationSound('urgent')` if critical,
  else `playNotificationSound('inject')`
- `next_round` → `playNotificationSound('round')`

Add a small mute toggle button in the session HUD or header so participants can turn
sound off. Store the mute preference in `localStorage` under `"ctt:sound_muted"`.

---

## Bug 7 — Role-specific inject routing (IR feedback → CISO only)

**Current state:** Injects are filtered by `targetTeam` (`all` / `crisis_management` /
`technical_it`). This is team-level only. There is no per-role routing.

**Fix A — extend the type:**

In `lib/types.ts`, add to the `Inject` interface:
```typescript
targetRoles?: Role[]   // if set, ONLY these roles see this inject (overrides targetTeam)
```

**Fix B — update inject-feed filtering:**

In `components/participant/inject-feed.tsx`, in the `filtered` computation:
```typescript
const filtered = pushed.filter((p) => {
  const inject = p.inject
  // Role-level targeting takes precedence over team-level
  if (inject.targetRoles && inject.targetRoles.length > 0) {
    if (!participantRole) return false
    return inject.targetRoles.includes(participantRole)
  }
  // Existing team-level filter
  const target = inject.targetTeam
  if (target && target !== "all" && participantTeam && target !== participantTeam) return false
  if (myRoleLabel && isSelfReferential(inject.senderName, myRoleLabel)) return false
  return true
})
```

The observe page (`app/observe/page.tsx`) passes `participantRole={undefined}` to
`InjectFeed` which means it sees all injects — keep this behaviour for the observer.

**Fix C — AI prompt directive:**

In `app/api/session/create/route.ts` in `buildScenarioDirectives()`, add:

```
INJECT ROLE TARGETING: For injects that are only relevant to specific roles, set
"targetRoles": ["ciso"] or ["it_manager", "system_admin"] etc. Use this for:
- IR/SOC technical briefings → targetRoles: ["ciso", "it_manager"]  
- Financial impact updates → targetRoles: ["cfo"]
- Legal/regulatory alerts → targetRoles: ["legal"]
- Internal HR communications → targetRoles: ["hr_lead"]
- General crisis updates, ransom notes, media coverage → targetTeam: "all" (no targetRoles)
The targetRoles field overrides targetTeam when both are present.
```

Also add `targetRoles` to the JSON schema example in the prompt so the AI knows the field exists.

---

---

## Bug 8 — Scenario generation: intermittent error, slow, no progress feedback

### Why it fails intermittently

**File:** `lib/scenario/generator.ts` + `app/api/session/create/route.ts`

Three root causes:

**A — `maxRetries: 0`** in `generateWithAI()` (create/route.ts line ~368):
```typescript
const { instance, warnings } = await generateScenarioInstance(config, apiKey, {
  maxRetries: 0,   // ← one bad JSON response = instant error thrown to user
  ...
})
```
The AI occasionally returns truncated or slightly malformed JSON. With `maxRetries: 0`
the repair logic in `parseJsonWithRepair` gets one shot, fails, throws, and the user
sees an error. Fix: change to `maxRetries: 2`.

**B — `maxTokens: 32000` for full mode** is excessive and often causes the API to
return a slower, larger response than needed. A 4-module scenario needs ~8000-12000
tokens of output. Fix: reduce to `maxTokens: 12000` for full, keep `16000` for lean.

**C — No `AbortController` timeout** on the fetch inside `callAI()`. If Anthropic is
slow, the request hangs indefinitely. Vercel will kill the serverless function after
`maxDuration: 300` seconds, but the user has no feedback until then.

### Fix A — reliability: increase retries and cap tokens

**File:** `app/api/session/create/route.ts` in `generateWithAI()`:

```typescript
// full path:
const { instance, warnings } = await generateScenarioInstance(config, apiKey, {
  model: "claude-sonnet-4-6",
  maxTokens: 12000,    // was 32000
  maxRetries: 2,       // was 0
  moduleSlots,
  framework,
  maxModules: 4,       // cap at 4 modules — prevents runaway generation
})

// lean path:
const scenario = await generateLeanScenario(config, apiKey, "claude-haiku-4-5-20251001", 8000)
// was 16000 — 8000 is sufficient for lean
```

**File:** `lib/scenario/generator.ts` in `callAI()` — add a 90-second timeout:

```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 90_000)

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
  signal: controller.signal,
})
clearTimeout(timeoutId)

if (!res.ok) {
  const err = await res.text()
  throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
}
```

### Fix B — progress bar using SSE streaming from the create endpoint

**Goal:** Replace the blocking `fetch()` in `setup-form.tsx` with a streaming
response that emits progress events so the facilitator sees what is happening.

**File:** `app/api/session/create/route.ts`

Change the POST handler to return a `ReadableStream` (SSE) instead of a plain JSON
response. Emit progress events as the generation proceeds:

```typescript
// Structure of each SSE event:
// data: {"stage":"building_prompt","pct":10,"label":"Scenario opbouwen..."}
// data: {"stage":"calling_ai","pct":30,"label":"AI genereert scenario..."}
// data: {"stage":"parsing","pct":75,"label":"Resultaat verwerken..."}
// data: {"stage":"saving","pct":90,"label":"Sessie opslaan..."}
// data: {"stage":"done","pct":100,"sessionId":"...","joinCode":"...","aiGenerated":true}
// data: {"stage":"error","message":"..."}
```

Use a `TransformStream` or manual `ReadableStream` with a controller:

```typescript
export async function POST(req: Request) {
  const body = await req.json()
  // ... parse config as before ...

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        send({ stage: "building_prompt", pct: 10, label: "Scenario opbouwen..." })
        
        // ... generate scenario (call existing generateWithAI / generateScenario) ...
        send({ stage: "calling_ai", pct: 30, label: "AI genereert scenario..." })
        const aiResult = await generateWithAI(config, mode, opts)
        
        send({ stage: "parsing", pct: 75, label: "Resultaat verwerken..." })
        let scenario = aiResult?.scenario ?? generateScenario(config)
        
        send({ stage: "saving", pct: 90, label: "Sessie opslaan..." })
        const session = await createSession(config, scenario, mode, documents)
        
        send({ stage: "done", pct: 100, sessionId: session.id, joinCode: session.joinCode, aiGenerated: !!aiResult?.scenario })
      } catch (err) {
        send({ stage: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
```

**File:** `components/admin/setup-form.tsx`

Replace the `fetch` + `res.json()` pattern with an SSE reader:

```typescript
async function onSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (submitting) return
  setSubmitting(true)
  setError(null)
  setProgress(null)  // new state: { pct: number; label: string } | null

  try {
    const res = await fetch("/api/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, mode, aiIntensity, specialsMode, decisionFramework, moduleSlots }),
    })
    if (!res.body) throw new Error("No response stream")
    
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const event = JSON.parse(line.slice(6))
        
        if (event.stage === "error") throw new Error(event.message)
        if (event.stage === "done") {
          router.push("/admin/dashboard")
          return
        }
        setProgress({ pct: event.pct, label: event.label })
      }
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Aanmaken mislukt")
    setSubmitting(false)
    setProgress(null)
  }
}
```

Add `const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null)`
to the component state.

**Progress bar UI** — add below the submit button (only visible when `submitting`):

```tsx
{submitting && (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-widest text-tt-dim">
        {progress?.label ?? "Verbinden..."}
      </span>
      <span className="font-mono text-[10px] text-tt-accent">{progress?.pct ?? 0}%</span>
    </div>
    <div className="h-1 w-full bg-tt-border overflow-hidden">
      <div
        className="h-full bg-tt-accent transition-all duration-500"
        style={{ width: `${progress?.pct ?? 0}%` }}
      />
    </div>
    {(progress?.pct ?? 0) >= 30 && (progress?.pct ?? 0) < 75 && (
      <p className="font-mono text-[9px] text-tt-dim">
        Dit duurt 20-40 seconden bij smart model. Sluit dit venster niet.
      </p>
    )}
  </div>
)}
```

Disable the submit button and show a spinner while `submitting` is true (already done —
verify it does not allow double-submit).

---

## Execution order

1. Bug 4 — BOB reset in goToNextRound (session-store, 3 lines)
2. Bug 3 — Role picker selectedRoles filter (play-view, 5 lines)
3. Bug 8A — maxRetries + maxTokens fix (create/route.ts + generator.ts, fast wins)
4. Bug 8B — SSE progress stream (create/route.ts + setup-form.tsx, largest change)
5. Bug 2 — stripMarkdown utility + apply everywhere
6. Bug 1 — Dutch strings audit (play-view, observe, decision-panel)
7. Bug 7 — targetRoles type + inject-feed filter + AI prompt
8. Bug 5 — Observe page dynamic BOB phase panel
9. Bug 6 — Notification sound (new file + hook into onEvent)

---

## Constraints

- No new npm dependencies (use Web Audio API for sound, not a library)
- No breaking changes to SessionState — `targetRoles` is optional
- After every session mutation: `dbSetSession()` then `broadcastState()`
- TypeScript strict — no `any`
- Keep design tokens: `tt-accent`, `tt-border`, `tt-surface`, `tt-bright`, `tt-dim`
- `stripMarkdown` must be a pure function — no side effects, no HTML output

---

# Logic proposal — decision-making redesign

Do NOT implement this yet. Read it, understand it, then wait for confirmation.

## Current problem

Participants see their full decision options during the discussion phase — this leads
them to anchor on the pre-written answers instead of forming their own view. Also,
some roles get only 1 option which is not engaging.

## Proposed new decision flow

### Phase 1 — Discussion (what we know now)

Show only the **decision question** — one sentence that frames what the team must decide.
Example: "Does your organisation pay the ransom or recover from backups?"

No answer options visible. Participants discuss based on the injects they have received.

The session lead (BOB chair) advances through the BOB phases (Beeldvorming →
Oordeelvorming → Besluitvorming) as now.

### Phase 2 — Individual verdict (new, between discussion and decision)

When the facilitator moves to the decision phase, each participant first types a
**free-text verdict**: their recommendation in 1-2 sentences, before seeing any
pre-written options.

Store this as `reasoningDraft` on the decision (already has a `reasoning` field —
use that). The participant submits the draft, then the option list appears.

### Phase 3 — Choose + confirm

Now the pre-written options appear. The participant selects the option that best
matches their draft and submits.

The `reasoning` field stores the free-text draft. The `actionId` stores the chosen option.

### Phase 4 — Review (end of round)

After all participants have submitted, the facilitator moves to the review phase.
Now show each participant their chosen option, the recommended option, and a brief
explanation of why certain choices were better or worse.
This is where the "correct answer" is revealed — not before.

## Decision options: more variety

Every `roleActions` array should have **4 options per relevant role**:
1. Best practice (irPlanAligned: true, isRecommended: true)
2. Acceptable but suboptimal (irPlanAligned: true, isRecommended: false)
3. Common mistake (irPlanAligned: false, isRecommended: false)
4. Worst case / do nothing (irPlanAligned: false, isRecommended: false)

Update the AI directive to enforce 4 options per decision set, with at least 1 decoy
and 1 "do nothing" option.

## Implementation files

When ready to implement, the changes are in:
- `components/participant/play-view.tsx` — hide options during discussion phase
- `components/participant/decision-panel.tsx` — add free-text step before options appear
- `lib/types.ts` — `reasoningDraft?: string` on `SubmittedDecision` (optional)
- `app/api/session/create/route.ts` — 4-option directive in AI prompt
- `components/participant/feedback-screen.tsx` — show correct answer reveal in review phase
