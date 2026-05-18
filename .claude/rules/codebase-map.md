# Codebase Map — tabletop-upgraded-2

## Directory Structure
```
app/
  page.tsx                    ← Landing page (role selector)
  layout.tsx                  ← Root layout + ThemeProvider
  globals.css                 ← Light/dark CSS variables
  admin/
    page.tsx                  ← Facilitator setup page
    dashboard/page.tsx        ← Live control dashboard
  join/page.tsx               ← Participant join page
  api/
    session/
      create/route.ts         ← Session creation + AI generation (MAIN)
      join/route.ts           ← Participant join
      state/route.ts          ← SSE live state stream
      action/route.ts         ← Session actions (start, next round, push inject)
    special/route.ts          ← Special events (negotiation, journalist)

lib/
  types.ts                    ← ALL types + ROLE_META + ExerciseConfig
  scenario-generator.ts       ← Template scenarios (Ransomware/Insider/BEC/Exfil)
  session-store.ts            ← In-memory + KV session state
  document-generator.ts       ← Per-role hypothetical documents
  api-client.ts               ← Client-side API helpers
  use-lang.ts                 ← Language hook (NL/EN)
  i18n.ts                     ← Translations

components/
  admin/
    setup-form.tsx            ← Facilitator config form (ALL setup fields)
    control-dashboard.tsx     ← Live facilitator dashboard (LARGE FILE)
    specials-panel.tsx        ← Special events trigger panel
  participant/
    join-form.tsx             ← Join with code + role selection
    play-view.tsx             ← Participant session view
    inject-feed.tsx           ← Live inject messages
    session-hud.tsx           ← Timer + round indicator
  auth/
    login-form.tsx            ← Facilitator login
  shared/
    timeline-panel.tsx        ← Event timeline
  theme-toggle.tsx            ← Dark/light toggle
  lang-toggle.tsx             ← NL/EN toggle
```

## Key Files by Task

| Task | File |
|---|---|
| Change AI prompt / scenario generation | `app/api/session/create/route.ts` |
| Add/change scenario type template | `lib/scenario-generator.ts` |
| Add/change role definitions or authorities | `lib/types.ts` → `ROLE_META` |
| Change setup form fields | `components/admin/setup-form.tsx` + `lib/types.ts` ExerciseConfig |
| Change what participants see | `components/participant/play-view.tsx` |
| Change live session logic | `lib/session-store.ts` |
| Add new inject type or channel | `lib/types.ts` → InjectType / InjectChannel |

## Search Strategy — Use This Order

1. **Known file** → `Read` directly (use table above)
2. **Known symbol** → `grep -r "symbolName" app/ lib/ components/ --include="*.ts" --include="*.tsx" -l`
3. **Unknown location** → grep first, then read only the matching file
4. **Never** do recursive broad reads of entire directories

## Important Invariants

- `toParticipantState()` in `session-store.ts` strips facilitator-only fields before broadcasting
- `localStorage` (not sessionStorage) for participant identity — survives refresh
- SSE stream + 4s polling fallback for Vercel multi-instance
- All config variables flow through `ExerciseConfig` → `buildScenarioDirectives()` in create route
- `selectedRoles` filters `roleActions` in template generator via `filterActions()`
- `ROLE_META` is the single source of truth for role labels, teams, authorities
