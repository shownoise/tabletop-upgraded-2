# PROMPT — Eye Security corporate design + meldplicht rework + bug fixes

Feed this whole file to Claude Code inside `/Users/pieterbaspluijmaekers/tabletop-upgraded-2`. Do the parts in order. Each part compiles clean (`pnpm exec tsc --noEmit`) and passes a manual browser smoke test before the next starts.

## Context

The last deploy (`3fb42f2` → `a709012` → current main HEAD) shipped a big supervision layer + NIS2 showcase scenario. Two problems surfaced:

1. **Runtime feels broken.** TSC is clean but participants report errors and rough edges. This part is diagnostic — find real bugs, don't invent them.
2. **Meldplicht dominates the screen.** The three big countdown chips + drafter form make participants feel like they're doing tax paperwork instead of a crisis simulation. Needs to become a reachable-tool, not screaming furniture.
3. **The app doesn't look like Eye Security.** Colors, buttons, typography, header — everything still says "terminal-styled toy". The corporate design brief lives in `/tmp/eye-cd/eye-security-corporate-design-copy/` and its `SKILL.md` is the source of truth. Palette: Indigo/Grape/Twilight/Lavender/Orange/Lemon. Typography: Silka (fallback Source Sans Pro). Pill buttons. Retire the terminal look.

## Global constraints

- No new dependencies except one font family (see 3.1).
- Backwards-compatible with existing sessions and graphs.
- No comments in new files except non-obvious WHY.
- Dutch user copy stays Dutch.
- Do NOT rewrite `control-dashboard.tsx` or `inspector.tsx` end-to-end.
- Every part ends with `pnpm exec tsc --noEmit` clean AND a browser smoke test note if applicable.

---

# Part 1 — Diagnose + fix runtime errors and broken behavior

## 1.1 Establish what's actually broken

Do NOT guess. Do this in order:

1. Start `pnpm dev` locally.
2. Open `/` in the browser with the browser devtools console open. Note every runtime error / warning that fires on:
   - Landing page load.
   - Facilitator login → `/admin`.
   - Setup form → start session with 2 participants + NIS2 showcase graph.
   - Participants join at `/join`.
   - Play through Round 1 with fact-check tags + one decision.
   - Facilitator opens supervision report panel.
   - Facilitator opens builder at `/admin/builder` → load NIS2 showcase → open Compliance panel → try Coverage / Meldplicht / Retainer / Preview sub-panels.
   - Advance to review phase.
3. Write down each error with: URL, action that triggered it, stack trace top frame, and impact (blocking / cosmetic).

Only after this triage: fix them. Do not preemptively refactor working code.

## 1.2 Known-suspect areas (from the previous agent's deviation notes)

Check these first — they were flagged in prior reports as "verifiable only in browser":

- **Span annotator selection UX** in `components/participant/inject-annotator.tsx` — floating toolbar may misposition on scroll or on injects near the viewport edge. Fix by anchoring to selection rect + clamping to viewport.
- **Autosave debounce** in `components/participant/notification-drafter.tsx` — if it POSTs on every keystroke without debounce, participants will feel jank + hammer the API. Add a 500 ms debounce via `useEffect` + `setTimeout` (no lodash — plain JS).
- **`setCenter` animation** in `components/admin/builder/compliance-panel.tsx` — verify the coverage row → focus node call works when the panel is a Sheet that overlaps the canvas. If the Sheet blocks pointer/focus, close-then-focus.
- **Chaser round-start push flow** — put a `console.warn` breadcrumb in `evaluateChasersOnRoundStart` (existing dev pattern — grep first) and verify the NCSC chaser actually fires in a Round 3 without a submitted 24h notification.
- **Auto-fix Decision node placement** in `compliance-panel.tsx` — verify the node lands near Start (not off-screen at 0,0).
- **`SUPERVISION_AREAS` labels/questions** in `lib/engine/supervision.ts` — the previous agent authored these instead of copying the user's provided text. Replace with the verbatim text from the user's toezichthouder-analyse (they provided it in the parent chat — the analyse under "Waar moet de crisisworkshop op toetsen?" with the 14-row table). Copy the "Wat moet je tijdens de workshop testen?" column into `question` and "Gewenst bewijs" into `evidenceExamples`.
- **Meldplicht clock anchor** — `session.incidentDetectedAt` is currently always `startSession` time. Honor `graph.meldplicht.incidentDetectedAt` when it's set to `'round_1' | 'round_2' | 'round_3'` — set `incidentDetectedAt` when the session enters that round for the first time.
- **Retainer chaser flag key** — currently hardcoded `retainer_activated`. Expose as a scenario-level constant or accept a `flag` field on the ChaserNodeData condition (already partially typed) so authors can customise.

## 1.3 Sanity checks

Add these ONE-TIME defensive checks (do not turn into general error-handling rot):

- In `toParticipantState`: assert that `reliability` and `groundTruthAnnotations` are stripped for non-review injects. If any remain, throw in dev (`process.env.NODE_ENV !== 'production'`), warn in prod. Prevents the game-mechanic spoiler regression.
- In `session-store.ts` `mutate` wrapper: if `tickPhases` or `tickRoundPhase` throws, log to the timeline as `engine_error` with the stack. Do not swallow silently.

## 1.4 Definition of done — Part 1

- List of triaged errors from 1.1 delivered as inline commit message bullets.
- Each triaged error either fixed with a linked commit line or explicitly deferred with a reason.
- `pnpm exec tsc --noEmit` clean.
- Manual smoke test: full session flow with 2 participants completes without red console errors in either participant's browser AND facilitator's browser.

---

# Part 2 — Meldplicht rework: event-triggered pop-in, not wallpaper

## 2.1 The problem

Right now `NotificationDrafter` is always rendered with three ticking countdowns and three multi-field forms. It reads like tax software. New participants see it, panic, and stop paying attention to the actual crisis. Wrong.

What we want: meldplicht is a **gameplay moment** that surfaces *because of the story*. When an inject reveals persoonsgegevens got exfiltrated, that's when a small nudge appears saying "hé, hier komt AVG-meldplicht om de hoek — concept maken?". Otherwise silent.

## 2.2 Data model — trigger events instead of always-on

No persistent dock. Meldplicht becomes a series of **prompts** driven by story events. Add to `SessionState`:

```ts
export interface MeldplichtPrompt {
  id: string
  type: NotificationType          // 'ncsc_24h' | 'ncsc_72h' | 'ap_72h' | 'ncsc_final'
  triggeredAt: number
  triggerReason: {
    kind: 'inject_flagged' | 'decision_taken' | 'chaser_fired' | 'facilitator_manual'
    sourceId?: string             // inject id / decision id
    summary: string               // short Dutch line, e.g. "Persoonsgegevens vermoeden bevestigd"
  }
  status: 'open' | 'drafted' | 'submitted' | 'dismissed'
}

export interface SessionState {
  // ...existing
  meldplichtPrompts?: MeldplichtPrompt[]
}
```

Prompts appear once, sit quietly in a small tray, and stop nagging after they're either submitted or dismissed. No auto-recreate.

## 2.3 What triggers a prompt

Server-side in `session-store.ts`, evaluate on mutations:

- **On inject push**: if inject has `nis2Relevant: true` AND its `supervisionAreas` includes `'notification_duty'`, spawn a `ncsc_24h` prompt (once — dedupe by `type + sourceInjectId`). If the inject text or `type === 'regulatory'` implies AVG, spawn `ap_72h` too.
- **On decision submit**: if the decision node has `supervisionAreas.includes('notification_duty')`, spawn a prompt of the matching type (24h if decision references vroegtijdige waarschuwing, 72h if it references melding-met-beoordeling).
- **On chaser fire** (NCSC/AP notification_missing): spawn a prompt of that type — this becomes the "shit, we forgot" moment.
- **Facilitator manual**: a button in the dashboard "Trigger meldplicht-moment" that spawns a prompt for a chosen type. Backup escape hatch.

Prompts dedupe on `(type, roundNumber)` — one open prompt per type per round max.

## 2.4 Participant UI — a small quiet tray, not a dock

New component `components/participant/meldplicht-tray.tsx`. Renders as a **small stack** of prompt cards, top-right of the main content column (not a fixed dock, not a sidebar — it lives inline with the round content).

Each prompt card:
- Compact: ~280 px wide, 3 lines tall.
- Header: notification type as a soft chip (`24u Cbw` / `72u Cbw` / `AVG 72u`), plus the trigger reason ("Aanleiding: journalist meldt vermoedelijk datalek").
- One-line prompt: "Wil je een concept opstellen? Duurt 2 minuten."
- Two small pill actions: `Nu concept maken` (primary orange, small size) and `Niet nu` (ghost button).
- After click on `Nu concept maken` → the card expands in place into a **minimal form** (see 2.5). No sheet, no modal.
- After submit → card collapses back to a compact "✓ Concept verzonden — 14:32" line, then fades out after 10 seconds.
- After `Niet nu` → card slides out; prompt status = `dismissed`; a chaser inject arriving later can re-open a new prompt of the same type (different id).

Deadline info is hidden by default. If the user opens the concept-form, then it shows a small "wettelijk uiterlijk: over 22:14:05" line at the top — muted. Not the star of the show.

## 2.5 Simpler form — three fields, not six

The current drafter has six labeled fields. Cut to three, in this order:

- **Wat weten we?** (100-char summary of the incident — replaces `initialImpactAssessment` + `iocs` merged. Placeholder: "Bijv. Ransomware-encryptie op prod-VMware cluster; 3 servers onbereikbaar.")
- **Wie is verantwoordelijk voor deze melding?** (participant picker — a dropdown of session participants; replaces `responsibleContact`).
- **Wat doen we er nu aan?** (short — replaces `mitigations`. Placeholder: "Bijv. Isoleren netwerksegment, IR-retainer geactiveerd om 09:15.")

That's it. `suspectMalicious` and `crossBorderImpact` become checkboxes under an optional "Meer details" expandable — for teams who want to fill them in, out of the way for the rest.

Enable `Versturen` when the three main fields have >= 20 chars each. No 80% threshold gymnastics.

## 2.6 Facilitator side

- Remove the always-on `NotificationTracker` panel. Move it into an on-demand tab inside the supervision report (already the plan).
- Add a small counter in the top nav: `Meldplicht: 2 open · 1 verzonden`. Click to expand a small popover with per-prompt state. Not a panel.
- Add the "Trigger meldplicht-moment" escape-hatch button in a dropdown menu (`Extra acties` or similar existing dropdown — surgical).

## 2.7 Chasers still fire — but they open a fresh prompt

The existing chaser engine (Part 4 previous plan) stays. When a chaser inject arrives ("NCSC: wij hebben nog niks vernomen"), also spawn a fresh `MeldplichtPrompt` of that type in the tray. The chaser inject IS the fiction — the tray prompt is the mechanic. Together they make "oh damn, we forgot" feel like a real story beat, not a UI failure.

## 2.8 Copy tone

Everywhere copy touches meldplicht, keep it **short, calm, human**. No legalese, no "u dient overeenkomstig artikel..." — instead: "Cbw wil binnen 24 uur een eerste bericht. Wat is minimaal genoeg?"

## 2.9 Definition of done — Part 2

- Fresh session with 2 participants, no meldplicht-relevant inject pushed yet: no meldplicht UI visible anywhere in the participant view.
- Push an inject with `nis2Relevant: true` + `supervisionAreas.includes('notification_duty')`: within a second, a small compact prompt card slides in top-right of the participant's main content.
- Click `Nu concept maken` → card expands in place with three simple fields.
- Fill fields, click `Versturen` → card compacts to a "✓ Concept verzonden 14:32" line, fades after 10s.
- Click `Niet nu` on a different prompt → card slides out, doesn't return until a chaser or new trigger.
- If a chaser inject fires because 24h was missed → a new prompt card appears, chaser inject also appears in the feed with critical urgency.
- Facilitator's top nav shows a counter; no more permanent tracker column.
- Total time from a participant seeing the trigger inject to submitting a concept: under 60 seconds if they focus. That's the UX target.

---

# Part 3 — Eye Security corporate design system

## 3.1 Typography

Silka isn't on Google Fonts. Options:

1. **If Silka woff2 is available in the design zip**: import via `next/font/local`.
2. **Otherwise**: use Source Sans Pro via `next/font/google` (weight 400/500/700) as the primary; the SKILL.md explicitly allows this as fallback.

Do this in `app/layout.tsx`:

```tsx
import { Source_Sans_3 } from "next/font/google"
const silka = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-silka",
  display: "swap",
})
// then <html className={silka.variable}>
```

If Silka woff2 becomes available later: swap to `next/font/local` — same variable name so nothing else changes.

Set the CSS var `--font-silka` and use `font-family: var(--font-silka), 'Source Sans Pro', 'Segoe UI', system-ui, sans-serif` on `body`.

The current project uses `font-mono` heavily (terminal aesthetic). Grep every `font-mono` and audit:
- Keep `font-mono` ONLY on: participant join code display, inject timestamps, technical metadata chips (SIEM values, IOCs). These read as "system output".
- Change everything else — headings, buttons, form labels, body text, node labels — to the new Silka/Source Sans Pro family.

## 3.2 Color tokens — retire tt-* and remap semantic vars

Rewrite `app/globals.css` root block:

```css
:root {
  /* Eye Security 2026 brand */
  --eye-indigo:   #192440;
  --eye-grape:    #472151;
  --eye-twilight: #624185;
  --eye-lavender: #b5a1e8;
  --eye-orange:   #F49719;
  --eye-lemon:    #F7CF45;
  --eye-white:    #FFFFFF;
  --eye-off:      #F7F5F2;  /* soft off-white for surfaces */
  --eye-ink:      #0d1220;  /* deeper text option */

  /* shadcn semantic vars — light Eye theme */
  --background: var(--eye-off);
  --foreground: var(--eye-indigo);
  --card: var(--eye-white);
  --card-foreground: var(--eye-indigo);
  --popover: var(--eye-white);
  --popover-foreground: var(--eye-indigo);
  --primary: var(--eye-orange);
  --primary-foreground: var(--eye-white);
  --secondary: var(--eye-lavender);
  --secondary-foreground: var(--eye-indigo);
  --muted: #eef0f6;
  --muted-foreground: #5b6478;
  --accent: var(--eye-twilight);
  --accent-foreground: var(--eye-white);
  --destructive: #b91c1c;
  --destructive-foreground: var(--eye-white);
  --border: #d8dae4;
  --input: #d8dae4;
  --ring: var(--eye-orange);
  --radius: 12px;

  /* Legacy tt-* still referenced — remap onto Eye tokens */
  --tt-bg:      var(--background);
  --tt-surface: var(--card);
  --tt-bright:  var(--foreground);
  --tt-dim:     var(--muted-foreground);
  --tt-border:  var(--border);
  --tt-accent:  var(--eye-orange);
  --tt-red:     var(--destructive);
  --tt-blue:    var(--eye-twilight);
  --tt-green:   #16a34a;
  --tt-warn:    var(--eye-lemon);
  --tt-purple:  var(--eye-grape);
}

.dark {
  --background: var(--eye-indigo);
  --foreground: var(--eye-white);
  --card: #1f2b4a;
  --card-foreground: var(--eye-white);
  --popover: #1f2b4a;
  --popover-foreground: var(--eye-white);
  --primary: var(--eye-orange);
  --primary-foreground: var(--eye-indigo);
  --secondary: var(--eye-twilight);
  --secondary-foreground: var(--eye-white);
  --muted: #23305a;
  --muted-foreground: #a2acc4;
  --accent: var(--eye-lavender);
  --accent-foreground: var(--eye-indigo);
  --border: #2b3866;
  --input: #2b3866;
  --ring: var(--eye-orange);

  --tt-bg:      var(--background);
  --tt-surface: var(--card);
  --tt-bright:  var(--foreground);
  --tt-dim:     var(--muted-foreground);
  --tt-border:  var(--border);
  --tt-accent:  var(--eye-orange);
  --tt-blue:    var(--eye-lavender);
  --tt-purple:  var(--eye-lavender);
  --tt-warn:    var(--eye-lemon);
}
```

Do NOT delete the `--tt-*` vars — too many components still reference them. Just remap.

## 3.3 Buttons — pill radius + Silka Bold

Edit `components/ui/button.tsx` (shadcn generated). Change:
- Default variant: `bg-primary text-primary-foreground rounded-full px-8 py-2 font-bold` (was `rounded-md`).
- Outline variant: `border-2 border-foreground text-foreground bg-transparent hover:bg-foreground hover:text-background rounded-full` (secondary Eye pattern).
- Ghost / link variants: leave shape unchanged but bump font-weight to 700 for consistency.
- Sizes: `sm` → `px-4 py-1.5 text-sm`, `default` → `px-8 py-2`, `lg` → `px-12 py-3 text-base`.

Every button in the app inherits — no per-component edits needed.

## 3.4 Card, Input, Badge

- `components/ui/card.tsx`: default `border-border rounded-xl bg-card shadow-sm`. The current `rounded-md` becomes `rounded-xl` (16px) matching the SKILL.md's 8-16px range.
- `components/ui/input.tsx`: `rounded-lg` (12px), `focus-visible:ring-2 focus-visible:ring-primary` (orange focus).
- `components/ui/badge.tsx`: pill-shape (`rounded-full`), Silka Bold, `px-3 py-0.5`.

## 3.5 Header + branding

New component `components/shared/eye-header.tsx`:
- Left: `<img src="/eye-logo-blauw.svg" alt="Eye Security" className="h-6" />` (light backgrounds) or `-wit.svg` (dark).
- Center or right: current nav items.
- Bottom border in `border-lavender` for a subtle brand-line.

Copy the two SVGs from the design zip into `public/`:
- `public/eye-logo-blauw.svg` (dark on light)
- `public/eye-logo-wit.svg` (white on dark)

Mount the header in `app/layout.tsx` above `{children}`. The existing landing page + admin pages may already have their own titles — surgical-remove those, let the shared header do the branding.

Do not add "Eye Security Crisis Tabletop" as literal text — the logo carries the brand. Keep page-specific titles.

## 3.6 Landing page hero

The current `app/page.tsx` role selector likely looks terminal-y. Rework the hero:
- Full-bleed background: Indigo (`bg-eye-indigo`) with a subtle radial-gradient overlay toward Grape.
- Headline in Silka Bold, white, ~48px: e.g. "Cyber Crisis Tabletop" (or whatever is there — keep the copy).
- Sub-headline in Silka Medium, `text-eye-lavender`.
- Two big pill buttons: "Ik ben facilitator" (primary orange) and "Ik ben deelnemer" (secondary white-outline).
- Retain existing routing — this is a visual pass.

## 3.7 Node colors in builder

The Homey-style node headers currently use Tailwind's `sky/amber/violet/fuchsia/emerald`. Retune to Eye palette:

Edit `components/admin/builder/node-theme.ts`:

| Node type | New header background | Rationale |
|---|---|---|
| start   | `bg-eye-indigo` + `text-white` | anchor, primary brand |
| round   | `bg-eye-twilight` + `text-white` | narrative beats — most nodes |
| inject  | `bg-eye-orange` + `text-white` | messages — attention |
| decision| `bg-eye-grape` + `text-white` | choices — deep, weighty |
| special | `bg-eye-lemon` + `text-eye-indigo` | interactive events — bright highlight |
| outcome | `bg-eye-lavender` + `text-eye-indigo` | endings — soft |
| chaser  | Orange-diagonal-stripes pattern | urgent regulatory chase |

Keep the icon squares in the header — swap the icon backgrounds to `bg-white/20` (already the case).

For selected-state ring + soft-body-tint: use each color at `-100/-50/-30` opacity variants — Tailwind arbitrary values (`bg-[color:var(--eye-twilight)]/10`) since the color palette isn't in the default Tailwind config yet.

## 3.8 Tailwind config

Extend `tailwind.config.ts` (or the CSS `@theme` block if the project uses Tailwind v4 — grep first to be sure):

```ts
theme: {
  extend: {
    colors: {
      'eye-indigo':   '#192440',
      'eye-grape':    '#472151',
      'eye-twilight': '#624185',
      'eye-lavender': '#b5a1e8',
      'eye-orange':   '#F49719',
      'eye-lemon':    '#F7CF45',
    },
    borderRadius: {
      pill: '30px',
    },
    fontFamily: {
      silka: ["var(--font-silka)", "'Source Sans Pro'", "system-ui", "sans-serif"],
    },
  },
},
```

If this project uses Tailwind v4 with `@theme inline` in `globals.css`, add there instead. Grep `@theme` first.

## 3.9 Participant view — new look

The participant view is the primary surface participants see. This is where the design must shine.

- Background: `bg-eye-off` (soft off-white) light mode, `bg-eye-indigo` dark mode.
- Round timeline: keep the current 4-node layout, but active-dot fills with `bg-eye-orange`, past-dots `bg-eye-twilight`, upcoming `bg-eye-lavender`.
- Inject cards: white with `border-eye-lavender/40`, `rounded-xl`, `shadow-sm`. Header meta metadata in `text-eye-twilight`. Urgency high = left border 4px `border-eye-orange`.
- The Verify pill: `bg-eye-orange/10 border-eye-orange/40 text-eye-orange` when tagged, `border-eye-lavender text-eye-twilight` when idle.
- Decision cards: `border-eye-grape/30` with lemon accent on the "recommended" option.

## 3.10 Facilitator dashboard — reduce clutter

The dashboard is functionally fine but visually noisy. Apply:
- Cards: `rounded-xl` `border-eye-lavender/40` `bg-card` `shadow-sm`.
- Section headers: Silka Bold in `text-eye-indigo`, no more all-caps monospace unless it's system output.
- Tabs (if `Tabs` primitive is used): active tab border-bottom `border-eye-orange`, others muted.
- Buttons at the top (start / reset / export): primary orange, secondary indigo-outline.
- Timeline event dots: colored per event category from the Eye palette instead of the current mixed set.

## 3.11 Dark mode

The current dark mode uses a green-terminal aesthetic. Retire that:
- Dark background = `--eye-indigo`, dark surface = a slightly lighter indigo (`#1f2b4a`).
- Accents unchanged (orange/lemon/lavender all readable on indigo — see WCAG table in the SKILL.md).

Verify all text meets contrast. Fix any low-contrast combos.

## 3.12 Retire the "circle system"

The SKILL.md explicitly says the previous circle system is retired. Grep for decorative circles (`rounded-full` on non-button non-avatar elements, `.circle`, `<Circle ... size={large} />`). If any are structural decoration (not a functional dot indicator), remove or replace with a rectangular accent.

## 3.13 Definition of done — Part 3

- Landing page opens with indigo hero + orange primary CTA + white outline secondary CTA. Logo top-left.
- Participant view: soft off-white background, indigo text, orange verify pill, lavender-tinged inject cards. Feels like Eye Security brochure, not a terminal.
- Facilitator dashboard: white cards on off-white background, indigo section headers in Silka, orange primary buttons.
- Builder canvas: node headers colored per Eye palette (indigo/twilight/orange/grape/lemon/lavender/chaser-stripes). Palette panel matches.
- Dark mode: indigo background, no more green terminal feel.
- Buttons everywhere are pill-shaped.
- Fonts: no more monospace on body text — only on system-output metadata.
- Both light + dark themes verified.

---

# File map — all parts

## Files you ADD
```
components/shared/eye-header.tsx           (Part 3.5)
public/eye-logo-blauw.svg                  (Part 3.5, copy from /tmp/eye-cd/.../assets/logos/)
public/eye-logo-wit.svg                    (Part 3.5, copy from /tmp/eye-cd/.../assets/logos/)
```

## Files you EDIT
```
app/globals.css                            (Part 3.2, 3.8 if @theme)
app/layout.tsx                             (Part 3.1, 3.5 — font + header)
app/page.tsx                               (Part 3.6 — hero)
tailwind.config.ts (or @theme block)       (Part 3.8)

components/ui/button.tsx                   (Part 3.3)
components/ui/card.tsx                     (Part 3.4)
components/ui/input.tsx                    (Part 3.4)
components/ui/badge.tsx                    (Part 3.4)

components/admin/builder/node-theme.ts     (Part 3.7)
components/admin/builder/palette.tsx       (Part 3.7 — icon squares reflect new colors)

components/participant/play-view.tsx       (Parts 2.2–2.7, 3.9)
components/participant/notification-drafter.tsx  (Part 2 — retire; keep tiny "expanded form" export for MeldplichtTray)
components/participant/meldplicht-tray.tsx (Part 2 — NEW: tray + compact prompt cards + inline expanded form)
components/participant/round-phase-timeline.tsx  (Part 3.9)
components/participant/inject-feed.tsx     (Part 3.9)
components/participant/inject-verify-menu.tsx   (Part 3.9)

components/admin/control-dashboard.tsx     (Parts 2.5, 3.10 — SURGICAL)
components/admin/notification-tracker.tsx  (Part 2.5 — move to report panel only)
components/admin/supervision-report.tsx    (Part 3.10 — Eye colors)

lib/engine/supervision.ts                  (Part 1.2 — replace SUPERVISION_AREAS text with verbatim toezichthouder source)
lib/session-store.ts                       (Part 1.2 — meldplicht clock anchor logic)
components/admin/builder/compliance-panel.tsx  (Part 1.2 — auto-fix node placement fix)
components/participant/inject-annotator.tsx (Part 1.2 — toolbar positioning)
```

## Files you WILL NOT touch
- Anything under `lib/graph/` beyond what Part 1.2 requires.
- The scenario JSON files (they carry no visual data).
- Anything not on the edit list — surgical only.

---

# Execution order

1. **Part 1.1** — run the dev server, triage errors. Deliver the list before touching code.
2. **Part 1.2** — fix triaged bugs + the known-suspect areas. Type-check + smoke test.
3. **Part 2** — meldplicht sheet rework. Smoke test.
4. **Part 3.1** — font (Source Sans Pro via next/font/google; document Silka-later swap).
5. **Part 3.2** — CSS tokens + tt-* remap. Smoke test — nothing should be visibly broken.
6. **Part 3.3–3.4** — button/card/input/badge shape + font. Smoke test.
7. **Part 3.5** — header + logos.
8. **Part 3.6** — landing hero.
9. **Part 3.7–3.8** — builder node colors + Tailwind config.
10. **Part 3.9** — participant view polish.
11. **Part 3.10** — facilitator dashboard polish.
12. **Part 3.11** — dark mode verify + fixes.
13. **Part 3.12** — retire decorative circles.
14. Final full walk-through in light + dark mode → deploy preview → user tests → prod (backup branch `backup/pre-eye-redesign` at current main HEAD before push).

---

# Non-goals

- Do NOT add micro-animations everywhere — Eye's brief is quiet + human. Keep motion subtle.
- Do NOT invent Eye copy — no marketing slogans. Existing product copy stays.
- Do NOT rebuild any feature just because it looks old — visual pass only. Behavior unchanged unless Part 1 explicitly fixes a bug.
- Do NOT try to license and embed Silka woff2 without the user's explicit permission. Source Sans Pro is the default until they hand over the font files.
- Do NOT change the runtime engine, scoring, or graph schema.
