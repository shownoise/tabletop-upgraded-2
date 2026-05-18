# Project Patterns

## Anti-patterns — Never Do These

- Don't read `control-dashboard.tsx` fully unless changing the dashboard — it's 800+ lines
- Don't read `scenario-generator.ts` fully to find one scenario — grep for the function name first
- Don't add `console.log` — use the existing timeline event system
- Don't add comments explaining what code does — only explain non-obvious WHY
- Don't create new files when editing an existing one fits
- Don't add error handling for impossible cases — trust internal invariants

## Type Patterns

```ts
// Adding a new config field:
// 1. Add to ExerciseConfig interface in lib/types.ts
// 2. Parse in POST handler in app/api/session/create/route.ts
// 3. Add directive in buildScenarioDirectives() in same file
// 4. Add UI field in components/admin/setup-form.tsx

// Adding a new role:
// 1. Add to Role union type in lib/types.ts
// 2. Add entry to ROLE_META in lib/types.ts
// 3. Add document in lib/document-generator.ts
```

## Component Patterns

```tsx
// Theme-aware: use Tailwind classes bg-background, text-foreground, border-border
// Dark mode via next-themes ThemeProvider — class="dark" on <html>
// Font: font-mono for labels/codes, default sans for body text
// Spacing: gap-4/gap-8 sections, px-6 py-4 cards
```

## API Route Patterns

```ts
// All session mutations go through lib/session-store.ts
// Always call broadcastState() after mutating session
// Route files: export const dynamic = "force-dynamic" and runtime = "nodejs"
// AI calls: fetch to https://api.anthropic.com/v1/messages directly (no SDK)
```

## State Flow

```
ExerciseConfig (setup-form) 
  → POST /api/session/create 
  → generateScenario() or generateWithAI() 
  → createSession() in session-store 
  → KV store
  → SSE /api/session/state streams to participants
  → toParticipantState() strips facilitator fields
```
