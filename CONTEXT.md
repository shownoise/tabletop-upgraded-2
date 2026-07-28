# Session Context

**Current Task**: Compliance cleanup + evaluationAspects opt-in + dynamic {{token}} fills + new `nis2_meldplicht_pressure_test` example.

**Key Decisions**:
- Retainer is hardcoded `EYE_SECURITY_RETAINER` in `lib/graph/types.ts`. Retainer-tab weg uit Compliance; nieuwe graphs krijgen `irRetainerName = "Eye Security"` automatisch; `handleLoad` overschrijft oudere waardes.
- Compliance verplaatst van top-toolbar naar left-rail (`components/admin/builder/compliance-rail.tsx`); Sheet heeft nu 2 tabs (coverage + preview); Meldplicht wordt gestuurd via `MeldplichtProfile` (3 cards) + `meldplichtFromProfile()`; individuele booleans blijven in state voor de engine.
- Nodes hebben opt-in `evaluationAspects` (`reliability | facts_assumptions | nis2 | decision_impact | lessons_learned`) — undefined = legacy (alles tonen), `[]` = minimal. Picker opent na drop van inject/round. Inspector heeft `AspectPillBar` + "Meer beoordelen ▾" om aspecten later te wijzigen.
- Dynamische injects/rounds: `dynamic: { enabled, fillFrom }` + `{{sector}}` etc. tokens; `lib/graph/dynamic-fill.ts` vervangt tokens in `app/api/session/create/route.ts` na graph-load, één keer.

**Next Steps**:
- Browser-verificatie: drop inject → picker verschijnt; open "★ NIS2 Meldplicht Pressure Test" template en check dat R1/R3 injects DYN-badge tonen.
- Overweeg engine-uitbreiding om per-decision-option `setFlag` te ondersteunen (nu is chaser gekoppeld aan `decision_not_taken` via de "correcte" roleActionId — werkt, maar minder expressief dan een echte wrong-option flag).
- `PROMPT_COMPLIANCE_CLEANUP.md` is de bron van deze wijzigingen — kan gearchiveerd.
