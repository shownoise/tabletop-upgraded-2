# PROMPT — Tabletop Cleanup + Compliance UX + Dynamic Injects + Extended Scenario

Feed this file to Claude Code from the project root. Work in the order listed. Do NOT jump ahead — each block builds on the previous one.

Follow the repo's dual-graph rules (see `CLAUDE.md`): call `graph_continue` first, respect the caps, register edits at the end.

---

## Goal in one paragraph

The builder is starting to feel busy. We want to (a) declutter the inspector so authors only see the panels they actually need for the current node, (b) simplify the compliance UX — hardcode Eye Security as the retainer, replace the multi-toggle Meldplicht form with a light game-flavoured setup, and turn Compliance Coverage into a first-class left-rail panel with pre-filled auto-suggestions, (c) allow injects and stories to be marked as **dynamic** so their content is filled in at session start based on the game's sector/company profile, and (d) ship one new extensive example scenario (`nis2_meldplicht_pressure_test`) that shows off compliance choices with score penalties, follow-up "you-made-a-mistake" injects, and 3 clearly distinct roles across ~6 rounds.

Do not overengineer. When in doubt, choose the smaller change.

---

## 1) Declutter — pick "what to evaluate" when a node is created

**Files:**
- `components/admin/builder/inspector.tsx` (~1005 lines — read only the sections you need; see `codebase-map.md`)
- `components/admin/builder/canvas.tsx` — where nodes are dropped/created
- `lib/graph/types.ts` — extend node data with an `evaluationAspects` field
- `components/admin/builder/nodes/` — inject and round node cards

**What to do:**

1. Add a new optional field on `InjectNodeData` and `RoundNodeData`:
   ```ts
   evaluationAspects?: Array<'reliability' | 'facts_assumptions' | 'nis2' | 'decision_impact' | 'lessons_learned'>
   ```
   Default = `undefined` (author didn't opt in yet).

2. In `canvas.tsx`, when the user drops a new `inject` or `round` node, show a small popover **before** committing the node — one line prompt "Wat wil je hier beoordelen?" with 5 checkboxes matching the enum above. Include a "Skip / minimal" button that creates the node with `evaluationAspects: []`.
   - Keep it dumb: no wizard, no multi-step. One popover, one confirm.
   - Persist choice into the node's `data.evaluationAspects`.

3. In `inspector.tsx`, gate the following fields on `evaluationAspects` containing the matching key:
   | Aspect key            | Fields it enables in the inspector |
   |-----------------------|------------------------------------|
   | `reliability`         | "Betrouwbaarheid (BOB)" select (~line 413) |
   | `facts_assumptions`   | The `InjectSpanEditor` fact/assumption annotator (~line 866+) |
   | `nis2`                | `nis2Relevant` toggle + supervision area picker |
   | `decision_impact`     | scoreImpact / linkedDimension fields on decisions |
   | `lessons_learned`     | `lessonLearned` textarea |

   When an aspect is off, the field is hidden entirely — no greyed-out placeholder. Add a small "+ Meer beoordelen" chevron at the bottom of the inspector that reopens the popover so authors can add aspects later.

4. On the node card in the canvas (`components/admin/builder/nodes/*`), render tiny badges for each active aspect (e.g. `NIS2`, `BOB`, `FA`) — max 3 visible, "+N" for the rest. Use existing `NODE_THEME` colours; don't invent a new palette.

**Do NOT** touch existing nodes' behaviour when `evaluationAspects` is `undefined` — treat undefined as "show everything" so nothing regresses.

---

## 2) Compliance — hardcode Eye Security, simplify Meldplicht, promote Coverage

**Files:**
- `components/admin/builder/compliance-panel.tsx`
- `components/admin/builder/toolbar.tsx` (Compliance button → move to left rail)
- `components/admin/builder/palette.tsx`
- `lib/graph/types.ts` — `MeldplichtConfig`, `DEFAULT_MELDPLICHT`
- `lib/engine/supervision.ts` — `computeCoverage`, `SUPERVISION_AREAS`
- `lib/graph/examples.ts` and/or `lib/builtin-templates.ts` — where retainer defaults live

### 2a) Retainer = Eye Security, always

- Remove the `RetainerTab` from `CompliancePanel`. Delete the "Retainer" tab button.
- Delete the `retainer` case from the `Tab` union.
- In `lib/graph/types.ts`, add a constant:
  ```ts
  export const EYE_SECURITY_RETAINER: IrRetainerProfile = {
    name: "Eye Security",
    activationNumber: "+31 (0)88 6600 700",
    authorizedActivators: ["CISO", "IT Manager", "CEO"],
    slaMinutesToFirstContact: 15,
    handoffChecklist: [
      "Incident samenvatting (wat, waar, wanneer)",
      "Getroffen systemen en gebruikers",
      "Reeds genomen containment-stappen",
      "Beschikbare logs en toegangen voor forensics",
      "Contactpersoon 24/7",
    ],
    scopeIncludes: ["Forensics", "Containment support", "Coordinatie NCSC/AP-meldingen", "Communicatie-advies"],
    scopeExcludes: ["Losgeld-onderhandeling zonder schriftelijke opdracht", "Herstel via derde partij"],
  }
  ```
- Set `graph.irRetainerProfile = EYE_SECURITY_RETAINER` and `graph.irRetainerName = "Eye Security"` as the default in new graphs (see `useGraphState` or wherever `createEmptyGraph` lives — grep for it, don't guess).
- Remove the "IR retainer naam" input from the Playbook dialog in `toolbar.tsx`. Keep the playbook textarea.

### 2b) Meldplicht — game-flavoured, one screen

Replace the current `MeldplichtTab` body with a single-screen "obligation profile" picker. The intent: the user picks the incident profile once, we derive the deadlines.

- Add to `MeldplichtConfig` (backward-compatible):
  ```ts
  incidentProfile?: 'personal_data_only' | 'critical_service_only' | 'both'
  ```
- Render three big radio cards ("AVG-incident", "NIS2 verstoring", "Beide — brede impact"). Selecting one sets the underlying booleans automatically:
  - `personal_data_only`: `apEnabled=true`, `ncsc24hEnabled=false`, `ncsc72hEnabled=false`, `ncscFinalEnabled=false`, `chasersEnabled=true`
  - `critical_service_only`: `apEnabled=false`, `ncsc24hEnabled=true`, `ncsc72hEnabled=true`, `ncscFinalEnabled=true`, `chasersEnabled=true`
  - `both`: everything true
- Show a small "clock-start" segmented control ("start / ronde 1 / ronde 2 / ronde 3") — that's the only remaining knob.
- Below the cards, render a compact **derived timeline strip** ("24u → NCSC waarschuwing · 72u → NCSC + AP-melding · 1 mnd → eindverslag") so authors see what they just enabled. This is the game-flavour element the user asked for.
- The old individual toggles are gone from the UI but keep the fields in `MeldplichtConfig` because the engine reads them.

### 2c) Compliance → left rail, coverage-first

- Remove the "Compliance" button from `toolbar.tsx`.
- In `palette.tsx`, add a persistent left-rail section **below** the drag chips (do not turn coverage into a draggable chip — it opens a panel):

  ```
  ┌────────────────────────┐
  │ COVERAGE               │  ← header
  │ ● 3/6 gebieden gedekt  │  ← summary
  │ [Auto-fix ontbrekende] │  ← primary button
  │ [Open compliance…]     │  ← opens the existing sheet on the 'coverage' tab
  ├────────────────────────┤
  │ Meldplicht: Beide      │  ← current incident profile as a chip
  │ Retainer: Eye Security │  ← hardcoded chip, non-editable
  └────────────────────────┘
  ```

  Wire the coverage count to `computeCoverage(graph)` — same call already used inside the sheet.

- The "Auto-fix ontbrekende" button loops over uncovered `SUPERVISION_AREAS` and calls `onAutoFixCoverage(areaId)` for each — this is what the user meant by "auto suggesties al ingevuld die je dan kan gebruiken". Confirm the existing `onAutoFixCoverage` handler in `canvas.tsx` (or wherever it's wired) actually inserts a suggestion node/action — if it doesn't, extend it so it drops a pre-filled inject stub tagged with the missing supervision area. Do not silently no-op.

- Inside the sheet, keep only two tabs now: `coverage` and `preview`. `meldplicht` becomes a small collapsible above the coverage list (the game-flavoured version from 2b). Remove `retainer`.

### 2d) Overview from compliance

Add a compact "Wat heb je gedekt?" summary at the top of the `coverage` tab — one line per NIS2-area with a green/yellow/red dot and a click-to-focus behaviour. This already partly exists; consolidate the current list styling so it reads as an overview, not a form.

---

## 3) Dynamic injects & stories — mark-then-fill on session start

**Files:**
- `lib/graph/types.ts` — extend `InjectNodeData` and `RoundNodeData`
- `lib/scenario-generator.ts` — sector-based fill logic (already has sector-aware pieces; extend, do not duplicate)
- `components/admin/builder/inspector.tsx` — add the "Dynamic" toggle + placeholder syntax hint
- `app/api/session/create/route.ts` — call the fill step when a graph is loaded for a session

### 3a) Data model

Add to both `InjectNodeData` and `RoundNodeData`:
```ts
dynamic?: {
  enabled: boolean
  fillFrom: Array<'sector' | 'companySize' | 'crownJewels' | 'criticalSystems' | 'irRetainerName'>
}
```

Author writes content with placeholder tokens:
```
Een medewerker bij {{sector}} meldt dat {{criticalSystems}} traag reageert…
```

At session-create time, we do a straight string replace using `ExerciseConfig` values from the setup form.

### 3b) Inspector UX

- In the inspector for `inject` and `round` nodes, add a small "**Dynamisch invullen**" section (collapsed by default). Inside:
  - Toggle "Vul in op basis van gameconfig"
  - Multi-select chips for `fillFrom` (checkboxes for the enum)
  - A one-line preview of allowed placeholder tokens
- When dynamic is on, render a subtle amber left border on the content textarea and a "3 placeholders" counter so the author knows the node is templated.

### 3c) Fill step

- In `app/api/session/create/route.ts`, after loading the graph (`ExerciseConfig.graphId`), walk all nodes with `data.dynamic?.enabled === true` and replace `{{token}}` tokens against `ExerciseConfig`. Only tokens listed in `fillFrom` are substituted — unlisted tokens are left as-is so authors get a visible red flag if they mistyped.
- If a token has no value in `ExerciseConfig`, leave it verbatim (don't crash, don't blank the field).
- Apply substitution to: `title`, `content`, `situation_update`, and `openingPrompts[*]` only. Nothing else.

### 3d) Do NOT

- Do NOT invent a template language. Only `{{sector}}`, `{{companySize}}`, `{{crownJewels}}`, `{{criticalSystems}}`, `{{irRetainerName}}`.
- Do NOT introduce mustache/handlebars — a simple `replaceAll` is enough.
- Do NOT run the fill step at render time on every SSE broadcast. Once, at session create, and store the filled graph in the session state.

---

## 4) The extensive scenario — `nis2_meldplicht_pressure_test`

**Files:**
- `lib/graph/examples.ts` — where `EXAMPLES` array lives (see `toolbar.tsx` line 19)
- `lib/scenario-generator.ts` — if a template-based approach fits better; check first

Add one new `EXAMPLES` entry (`key: 'nis2_meldplicht_pressure_test'`) that ships pre-built with:

### 4a) Roles (exactly 3, distinct, non-overlapping authority)

Use existing roles from `ROLE_META` — do not add new ones. Pick these three and reference them by their existing IDs in the graph:
1. **CISO** — technical containment, evidence preservation, forensic scoping
2. **Legal & DPO** — AP/NCSC notification wording, regulator-facing communication, retention decisions
3. **CEO / Board** — external comms, ransom decision, business continuity trade-off

Each round's `roleActions` must have 1–2 actions per role, no overlap. If `ROLE_META` doesn't have exactly these three, use the closest three that already exist and note the mapping at the top of the file.

### 4b) Structure (6 rounds)

1. **R1 — Detectie & twijfel.** Alarm van MDR, onduidelijke scope. Decision: "Retainer activeren?" — correct = activate Eye Security, wrong = "we wachten tot ochtend" (−2 points). If wrong, R2 opens with a chaser inject "MDR-team stopt met alert-follow-up want geen escalatie ontvangen" with a facilitator note "je hebt de retainer te laat geactiveerd — verhaal vervolgt".
2. **R2 — Impact clarifies.** PII-lek waarschijnlijk, meerdere klantsystemen down. Decision: "72u AP-melding voorbereiden?" Correct = start voorbereiding, wrong = "eerst intern uitzoeken" (−3 points). Chaser: "AP heeft signaal opgevangen via een externe klacht" bij fout antwoord.
3. **R3 — Media pressure.** Journalist inject. Decision: "Statement naar buiten?" — three options with different score impacts. Wrong option triggers a follow-up inject "je woordvoerder heeft iets gezegd wat forensics tegenspreekt".
4. **R4 — Ransom demand.** Attacker inject met deadline. Decision: "Betalen / niet betalen / onderhandelen via IR-partner". Betalen = grote −5, niet betalen zonder plan = −2, via Eye Security = +2. Follow-up inject na fout: "OFAC-listing geconstateerd door forensics" (retroactively laat zien waarom betalen verkeerd was).
5. **R5 — 24u/72u check.** Systeem-driven inject die de status van meldingen toont. Deze ronde heeft geen decision — het is een compliance checkpoint via de coverage panel.
6. **R6 — Debrief & outcome.** Terminal outcome-nodes gekoppeld aan de cumulatieve score-lijn.

### 4c) Wrong-choice pattern (this is the interaction the user wants)

For every "wrong" decision option:
- Attach `scoreImpact: <negative>`
- Attach `lessonLearned: "<one sentence — what a real IR consultant would flag>"`
- Wire a `chaser` node that fires 60–120s after the wrong choice, containing:
  - `title`: "Terugkoppeling — <topic>"
  - `content`: two paragraphs — first paragraph is the in-fiction consequence, second paragraph is a facilitator-visible hint (annotated with `reliability: 'fact'` and `authorNote`) explaining why the choice was wrong.
- The chaser must NOT branch the story into a different arc. The main sequence continues to the next round regardless of the wrong choice — this is the "verhaal vervolgt dan wel" requirement.

Encode this consistently by re-using the existing `ChaserNodeData` + `advancesGraph: false` on the decisions. Check `lib/engine` for the actual chaser-firing predicate before assuming — if `advancesGraph: false` doesn't route through the current engine, add the smallest engine change needed. Do not build a new branching system.

### 4d) Dynamic markers on the example

Mark the R1 alarm inject and R3 journalist inject as `dynamic.enabled = true` with `fillFrom: ['sector', 'criticalSystems']`. Use placeholder tokens in their content. This proves out feature (3) end-to-end.

### 4e) Compliance wiring on the example

Set the graph's `meldplicht.incidentProfile = 'both'` and populate supervision-area coverage such that `computeCoverage(graph)` returns at least 5/6 covered. This shows the coverage panel doing useful work by default.

---

## 5) Cleanup pass (grab-bag, small)

- Remove the `Retainer` and `Preview` tab strings from any i18n dictionaries in `lib/i18n.ts` if only used by the removed retainer tab.
- Delete any dead code in `compliance-panel.tsx` after 2a/2b (RetainerTab, FieldRow if unused, `IrRetainerProfile` import if orphaned).
- If the compliance button has a keyboard shortcut hint anywhere, remove it.
- Do NOT rewrite `control-dashboard.tsx` or `session-store.ts` — those are 800+ / 2000+ lines and out of scope. Only touch them if a change from 1–4 above literally requires it, and keep the diff minimal.

---

## 6) Verification checklist

Before finishing, verify by running through the app in your head (or via `pnpm dev` + browser):

- [ ] New inject dropped on canvas → popover appears → choose 2 aspects → inspector only shows those aspects → node card shows 2 badges
- [ ] Compliance no longer in top toolbar; left rail shows Coverage summary; Auto-fix button drops suggestion nodes
- [ ] Meldplicht tab is one screen: 3 profile cards + clock-start + derived timeline strip. No individual boolean toggles visible.
- [ ] Retainer tab is gone. Graph loads with `irRetainerName = "Eye Security"` by default.
- [ ] New graph → toggle Dynamic on an inject → content has `{{sector}}` → session-create with sector `"Healthcare"` → participant sees `"Healthcare"` in the delivered inject.
- [ ] Load `nis2_meldplicht_pressure_test` template → 6 rounds, 3 roles, wrong choices show negative score + chaser inject with hint; the story still advances to R2/R3/etc.
- [ ] `pnpm tsc --noEmit` clean (or `/check` per `.claude/rules/codebase-map.md`).

---

## Constraints

- **Order matters.** Do sections 1 → 2 → 3 → 4 → 5 in that sequence. Section 4 depends on 2 (Eye Security default) and 3 (dynamic markers).
- **No new dependencies.** Everything above can be done with the current `package.json`.
- **No behaviour changes for existing graphs** where `evaluationAspects` or `dynamic` are undefined. Backward compatibility is required — session-store already persists graphs.
- **Do not delete `IrRetainerProfile` from `lib/types.ts`.** The engine still reads it. Only remove the *editor UI* and hardcode the value.
- **Do not introduce a template engine** for dynamic fills. Plain `String.prototype.replaceAll` on 5 known tokens. Nothing more.
- **Follow the dual-graph rules** in `CLAUDE.md`: call `graph_continue` first, respect the confidence caps, register edits at the end with `graph_register_edit`.
- **Do not read `control-dashboard.tsx` or `scenario-generator.ts` fully.** Grep for the symbols you need. See `.claude/rules/patterns.md`.
- **After finishing, update `CONTEXT.md`** with a two-line summary and next steps (per `CLAUDE.md` Session End rules).
