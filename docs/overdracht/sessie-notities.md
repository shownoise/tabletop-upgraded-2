# Sessie-notities

Werkende notities uit sessies vóór de overdracht. Verplaatst uit `CONTEXT.md`
omdat dat bestand voortaan het glossarium is.

## 2026-08 — Compliance cleanup + evaluationAspects + dynamische tokens

**Waarom deze notitie er is**: een eerdere sessie liet lokale wijzigingen open in
de working tree. Die zijn gered op branch `session/compliance-cleanup-wip`
(PR #1). Deze notitie beschrijft waarom die wijzigingen ontstonden.

**Key decisions van die sessie**:

- Retainer is hardcoded `EYE_SECURITY_RETAINER` in `lib/graph/types.ts`.
  Retainer-tab is weg uit Compliance; nieuwe graphs krijgen automatisch
  `irRetainerName = "Eye Security"`; `handleLoad` overschrijft oudere waardes.
- Compliance verplaatst van top-toolbar naar left-rail
  (`components/admin/builder/compliance-rail.tsx`). Sheet heeft nu 2 tabs
  (coverage + preview). Meldplicht wordt gestuurd via `MeldplichtProfile`
  (3 cards) + `meldplichtFromProfile()`; individuele booleans blijven in state
  voor de engine.
- Nodes hebben opt-in `evaluationAspects`
  (`reliability | facts_assumptions | nis2 | decision_impact | lessons_learned`)
  — undefined = legacy (alles tonen), `[]` = minimal. Picker opent na drop van
  inject/round. Inspector heeft `AspectPillBar` + "Meer beoordelen ▾" om
  aspecten later te wijzigen.
- Dynamische injects/rounds: `dynamic: { enabled, fillFrom }` +
  `{{sector}}` etc. tokens; `lib/graph/dynamic-fill.ts` vervangt tokens in
  `app/api/session/create/route.ts` na graph-load, één keer.

**Open verificatie**:

- Browser-verificatie: drop inject → picker verschijnt; open
  "★ NIS2 Meldplicht Pressure Test" template en check dat R1/R3 injects
  DYN-badge tonen.
- Engine-uitbreiding overwegen om per-decision-option `setFlag` te ondersteunen
  (nu is chaser gekoppeld aan `decision_not_taken` via de "correcte"
  roleActionId — werkt, maar minder expressief dan een echte
  wrong-option flag).
- `PROMPT_COMPLIANCE_CLEANUP.md` (indien nog aanwezig) is de bron van deze
  wijzigingen — kan gearchiveerd.
