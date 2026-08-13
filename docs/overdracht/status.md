# Overdracht — status

Bron van waarheid voor wat gedaan is per klus. Bijgewerkt aan het eind van
elke klus.

| Klus | Branch | Status | Conclusie |
|---|---|---|---|
| P0 Werkafspraken + glossarium | `chore/werkafspraken` | in review (PR volgt) | Git-safety opgezet, oude sessie gered op eigen branch (PR #1), CLAUDE.md herschreven, CONTEXT.md is glossarium met alias-callouts, `docs/agents/` scaffold via `setup-matt-pocock-skills`. |

## Wacht op mij

- Main-branch protection staat **niet** aan op GitHub. Aanzetten (zie
  `docs/overdracht/main-branch-protection.md` — nog te schrijven, of in het
  PR-beschrijving van deze branch).
- PR #1 (`session/compliance-cleanup-wip`) niet mergen tot je door de app hebt
  geklikt en gecontroleerd hebt dat compliance-rail, scoring-review en
  decision-panel werken.
- P8: uitzoeken of "training modus" ergens expliciet in de code zit. Grep gaf
  niets.
- `{{klantnaam}}` / `clientName` — wizard vraagt het wél uit maar dynamic-fill
  ondersteunt het niet. Behandelen in de prompt-klus (P6) of eerder als je
  klantnaam in een injecttekst wil kunnen gebruiken.
