# Logic: per-role parallel decisions + missing role fallback

Read every file in full before editing. Follow existing TypeScript patterns and design tokens.

---

## What currently exists (do not break this)

The platform already supports parallel role decisions:
- `roleActions` is a flat array on each `Round`
- Each action has `allowedRoles: Role[]`
- `decision-panel.tsx` already filters: participant only sees actions where their role
  is in `allowedRoles` (or `allowedRoles` is empty = universal)
- All roles submit their own decision in parallel during the decision phase
- The facilitator sees all submitted decisions per round

This infrastructure is correct. The problem is in **how the AI and static generator
fill `allowedRoles`**: they currently put multiple roles on a single action
(e.g. `["ciso", "it_manager"]`), meaning both roles see the same action and make the
same choice. This is wrong.

---

## Change 1 — Each action belongs to exactly ONE role

### The rule

Every `roleAction` must have `allowedRoles` with **exactly one role** (single ownership).
That role is the only one who sees and decides on that action.

Exception: the universal "do nothing / wait" option always has `allowedRoles: []`
(visible to all roles as a fallback choice).

This means for a round with 5 participating roles, `roleActions` will have ~15-20 items:
- CISO: 3-4 options (technical containment domain)
- CFO: 3-4 options (financial/insurance domain)
- Legal: 3-4 options (regulatory/compliance domain)
- CEO: 3-4 options (authorisation/escalation domain)
- Head of Comms: 3-4 options (communication domain)
- 1 universal "do nothing" with `allowedRoles: []`

### Fix A — update the AI prompt (full model)

**File:** `app/api/session/create/route.ts`

Find the `roleActions` section in the JSON schema (around line 342) and replace the
example with role-separated actions:

```json
"roleActions": [
  {
    "id": "r1-ciso-1",
    "label": "Isoleer getroffen endpoints direct",
    "description": "Naar aanleiding van de EDR-melding: autoriseer isolatie van de getroffen endpoints om laterale beweging te stoppen.",
    "allowedRoles": ["ciso"],
    "isRecommended": true,
    "irPlanAligned": true,
    "consequence": "Beperkt verspreiding; tijdelijke uitval voor betrokken gebruikers."
  },
  {
    "id": "r1-ciso-2",
    "label": "Monitor eerst — nog te vroeg voor isolatie",
    "description": "Wacht op meer bewijs voordat je systemen isoleert.",
    "allowedRoles": ["ciso"],
    "isRecommended": false,
    "irPlanAligned": false,
    "consequence": "Aanvaller blijft actief terwijl je wacht op bevestiging."
  },
  {
    "id": "r1-cfo-1",
    "label": "Informeer cyber-verzekeraar direct",
    "description": "Naar aanleiding van de financiële impact: neem contact op met de verzekeraar om de polis te activeren.",
    "allowedRoles": ["cfo"],
    "isRecommended": true,
    "irPlanAligned": true,
    "consequence": "Behoudt dekkingsrecht; sommige polissen vereisen melding binnen uren."
  },
  {
    "id": "r1-legal-1",
    "label": "Start meldingtijdlijn NIS2/GDPR",
    "description": "Naar aanleiding van het incident: registreer het tijdstip van eerste kennisname en start de 72-uursklok.",
    "allowedRoles": ["legal"],
    "isRecommended": true,
    "irPlanAligned": true,
    "consequence": "Borgt compliance; gemiste deadline leidt tot boetes."
  },
  {
    "id": "r1-do-nothing",
    "label": "Wacht af — meer informatie nodig",
    "description": "Neem nog geen actie; wacht tot het beeld duidelijker is.",
    "allowedRoles": [],
    "isRecommended": false,
    "irPlanAligned": true,
    "consequence": "Kan juist zijn bij onduidelijke signalen; riskant als detectie al helder is."
  }
]
```

Also add this as an explicit directive inside `buildScenarioDirectives()`:

```
PER-ROLE DECISIONS: Every roleActions array must contain a dedicated set of 3-4
options for EACH participating role, where allowedRoles contains EXACTLY ONE role.
Never put multiple roles on a single action (except the universal do-nothing option
which uses allowedRoles: []).

Rules:
- CISO / IT Manager / System Admin: technical containment, forensic, infrastructure decisions
- CFO: financial exposure, insurance notification, cost authorisation
- Legal: regulatory notification (NIS2/GDPR), liability, contractual obligations
- CEO: authorisation of major actions, board/external escalation, communication sign-off
- Head of Comms: media statements, internal communication, social media response
- HR Lead: employee communication, insider investigation initiation
- Ops Manager: business continuity, failover, operational impact decisions

Each option must directly respond to a specific inject in the same round — name the
inject context in the description. Include 1 best practice, 1 acceptable-but-suboptimal,
1 common mistake, and optionally 1 "escalate upward without deciding" option per role.
```

### Fix B — update the lean model prompt

**File:** `app/api/session/create/route.ts` in `generateLean()`

The lean JSON schema example (around line 237) also shows shared `allowedRoles`.
Replace the example roleActions with the same per-role single-ownership pattern:

```json
"roleActions": [
  {"id":"r1-ciso-1","label":"...","description":"...","allowedRoles":["ciso"],"isRecommended":true,"irPlanAligned":true,"consequence":"..."},
  {"id":"r1-ciso-2","label":"...","description":"...","allowedRoles":["ciso"],"isRecommended":false,"irPlanAligned":false,"consequence":"..."},
  {"id":"r1-cfo-1","label":"...","description":"...","allowedRoles":["cfo"],"isRecommended":true,"irPlanAligned":true,"consequence":"..."},
  {"id":"r1-legal-1","label":"...","description":"...","allowedRoles":["legal"],"isRecommended":true,"irPlanAligned":true,"consequence":"..."},
  {"id":"r1-do-nothing","label":"Wacht af — meer informatie nodig","description":"...","allowedRoles":[],"isRecommended":false,"irPlanAligned":true,"consequence":"..."}
]
```

### Fix C — update static scenario generator

**File:** `lib/scenario-generator.ts`

Read the file in full. In every `ransomwareR1`, `ransomwareR2`, `ransomwareR3`,
`ransomwareR4` function (and all other scenario types: insider, BEC, dataexfil),
restructure ALL `roleActions` arrays so each action has exactly one role:

Current (wrong):
```typescript
{ id: "gen-r1-a1", allowedRoles: ["it_manager", "system_admin"], ... }
{ id: "gen-r1-a3", allowedRoles: ["ciso", "head_of_comms"], ... }
```

Correct (one role per action, 3+ options per role):
```typescript
// IT Manager domain
{ id: "gen-r1-itm-1", label: "Isoleer getroffen endpoints", allowedRoles: ["it_manager"], isRecommended: true, irPlanAligned: true, ... },
{ id: "gen-r1-itm-2", label: "Log-analyse uitvoeren zonder isolatie", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, ... },
{ id: "gen-r1-itm-3", label: "Systemen online houden en monitoren", allowedRoles: ["it_manager"], isRecommended: false, irPlanAligned: false, ... },

// System Admin domain
{ id: "gen-r1-sa-1", label: "Forensische kopie veiligstellen", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, ... },
{ id: "gen-r1-sa-2", label: "Back-upstatus controleren", allowedRoles: ["system_admin"], isRecommended: true, irPlanAligned: true, ... },

// CISO domain
{ id: "gen-r1-ciso-1", label: "Crisisoverleg openen met IR-retainer", allowedRoles: ["ciso"], isRecommended: true, irPlanAligned: true, ... },
{ id: "gen-r1-ciso-2", label: "Wachten op meer bewijs", allowedRoles: ["ciso"], isRecommended: false, irPlanAligned: false, ... },

// Universal
{ id: "gen-r1-do-nothing", label: "Wacht af", allowedRoles: [], irPlanAligned: true, ... },
```

Make sure every role that can realistically be in the game (`ceo`, `ciso`, `cfo`,
`legal`, `head_of_comms`, `hr_lead`, `ops_manager`, `it_manager`, `system_admin`)
gets at least 2 options per round if that role is relevant to the round's theme.
Use `filterActions(actions, sel)` at the end — this already handles filtering to
only selected roles. Keep calling it as before; just change the action definitions.

---

## Change 2 — Missing role fallback: reassign injects and decisions

When a role is not present in the exercise, its injects and decisions must not
disappear — they must be reassigned to the closest present role.

### Fix A — define fallback map

**File:** `lib/types.ts`

Add this constant (export it — it's needed in multiple files):

```typescript
export const ROLE_FALLBACK: Partial<Record<Role, Role[]>> = {
  head_of_comms: ["ceo", "ciso"],
  ops_manager:   ["cfo", "ceo"],
  hr_lead:       ["legal", "ceo"],
  legal:         ["ciso", "ceo"],
  cfo:           ["ceo"],
  it_manager:    ["ciso", "system_admin"],
  system_admin:  ["it_manager", "ciso"],
  ciso:          ["it_manager", "ceo"],
  ceo:           ["ciso", "cfo"],
}
```

### Fix B — remap on session creation

**File:** `lib/session-store.ts` in `createSession()`

Add a `remapMissingRoles` function and call it before `dbSetSession()`:

```typescript
function remapMissingRoles(scenario: Scenario, selectedRoles: Role[]): Scenario {
  const active = new Set(selectedRoles)

  function resolveRole(role: Role): Role | null {
    if (active.has(role)) return role
    return (ROLE_FALLBACK[role] ?? []).find(r => active.has(r)) ?? null
  }

  return {
    ...scenario,
    rounds: scenario.rounds.map(round => ({
      ...round,
      injects: round.injects.map(inject => {
        if (!inject.targetRoles?.length) return inject
        const remapped = [...new Set(
          inject.targetRoles.map(r => resolveRole(r)).filter(Boolean) as Role[]
        )]
        return { ...inject, targetRoles: remapped.length > 0 ? remapped : undefined }
      }),
      roleActions: round.roleActions?.map(action => {
        if (action.allowedRoles.length === 0) return action
        const remapped = [...new Set(
          action.allowedRoles.map(r => resolveRole(r)).filter(Boolean) as Role[]
        )]
        // If no active role found, open to all (last resort)
        return { ...action, allowedRoles: remapped.length > 0 ? remapped : [] }
      }),
    })),
  }
}
```

In `createSession()`, after scenario is determined and before `dbSetSession()`:

```typescript
const finalScenario = config.selectedRoles?.length
  ? remapMissingRoles(scenario, config.selectedRoles)
  : scenario
// then: createSession uses finalScenario
```

Import `ROLE_FALLBACK` from `lib/types.ts`.

### Fix C — update `filterActions` in static generator

**File:** `lib/scenario-generator.ts`

The current `filterActions` drops actions silently. Replace with remap:

```typescript
function filterActions(actions: RoleAction[], selectedRoles?: Role[]): RoleAction[] {
  if (!selectedRoles?.length) return actions
  const active = new Set(selectedRoles)

  return actions
    .map(action => {
      if (action.allowedRoles.length === 0) return action
      const kept = action.allowedRoles.filter(r => active.has(r))
      if (kept.length > 0) return { ...action, allowedRoles: kept }
      // Remap missing roles to their fallback
      const remapped = [...new Set(
        action.allowedRoles.flatMap(r =>
          (ROLE_FALLBACK[r] ?? []).filter(fb => active.has(fb))
        )
      )]
      return { ...action, allowedRoles: remapped.length > 0 ? remapped : [] }
    })
    .filter(action =>
      action.allowedRoles.length === 0 ||
      action.allowedRoles.some(r => active.has(r))
    )
}
```

Add `import { ROLE_FALLBACK } from "./types"` at the top.

### Fix D — AI prompt: always generate for all domains

**File:** `app/api/session/create/route.ts` in `buildRoleContext()`

The current directive says "ONLY generate roleActions and injects for these roles."
Change to:

```
Roles participating: [${roles.join(", ")}]

Generate role-specific decisions for EVERY participating role. Also generate injects
covering all relevant crisis domains (technical, financial, legal, communications,
operations) — even if the role normally responsible is absent. For absent roles,
assign their decisions to the closest participating role:
- Communications → head_of_comms, else ceo
- Financial → cfo, else ceo
- Legal/regulatory → legal, else ciso
- Technical → ciso or it_manager
- Operational → ops_manager, else cfo or ceo

Never put a role in allowedRoles that is NOT in the participating list.
```

---

## Execution order

1. Fix 2A — add `ROLE_FALLBACK` to `lib/types.ts` (needed by all other steps)
2. Fix 1C — restructure all roleActions in `lib/scenario-generator.ts` to single-role ownership
3. Fix 2C — update `filterActions()` in same file
4. Fix 1A + 1B — update AI prompt schema + add per-role directive in `create/route.ts`
5. Fix 2D — update `buildRoleContext()` in same file
6. Fix 2B — add `remapMissingRoles()` in `lib/session-store.ts`

---

## Constraints

- Do NOT change `RoleAction` type or `Round` type schema — `allowedRoles: Role[]` stays as-is
- Do NOT change `decision-panel.tsx` or `play-view.tsx` — they already correctly filter
  to only show a participant their own role's actions
- `remapMissingRoles` is a pure function — no side effects, no API calls
- `ROLE_FALLBACK` is a runtime constant, not a type — export from `lib/types.ts`
- After `createSession()` mutation: `dbSetSession()` then `broadcastState()` as always
- TypeScript strict — no `any`
