# Overdracht — status

Bron van waarheid voor wat gedaan is per klus. Bijgewerkt aan het eind van
elke klus.

| Klus | Branch | Status | Conclusie |
|---|---|---|---|
| P0 Werkafspraken + glossarium | `chore/werkafspraken` | gemerged (PR #2) | Git-safety opgezet, oude sessie gered op eigen branch (PR #1), CLAUDE.md herschreven, CONTEXT.md is glossarium met alias-callouts, `docs/agents/` scaffold via `setup-matt-pocock-skills`. Main-protection ruleset actief (0 approvals). |
| P10 Drie bugs | `fix/losse-bugs` | in review | Bug 2 gefixt (weergave). Bug 1 en 3 zijn geen code-fix — één is design (rol-filter, niet hardcoded), één is niet-verifieerbaar zonder browser en de code klopt. |

## Wacht op mij

- PR #1 (`session/compliance-cleanup-wip`) niet mergen tot je door de app hebt
  geklikt en gecontroleerd hebt dat compliance-rail, scoring-review en
  decision-panel werken.
- **P10 bug 1** (2-van-4 opties): geen hardcoded UI-limiet gevonden. Filter in
  `components/participant/decision-panel.tsx:155` toont per deelnemer alleen
  opties waarvan `allowedRoles` de eigen rol bevat (of leeg is). Verwacht je
  4 opties en zie je er 2: check in het testscenario of alle 4 opties de rol
  van de deelnemer in `allowedRoles` hebben staan. Als dat zo is en er tóch
  2 verdwijnen: dan is het een bug (waarschijnlijk in
  `lib/graph/wizard-plan.ts:220` of `lib/graph/preview.ts:46`).
- **P10 bug 3** ("Beslissing afsluiten" springt door): het knop-handler pad
  klopt in de code (`api.forceLock` → `finalizeDecision` → `roundPhase: review`,
  géén auto-advance). Als je in de browser echt naar de volgende ronde springt:
  ligt in session-state (developers). Andere mogelijkheid: je klikte op de
  aangrenzende knop die na review-fase "Start ronde N+2" zegt.
- P8: uitzoeken of "training modus" ergens expliciet in de code zit. Grep gaf
  niets.
- `{{klantnaam}}` / `clientName` — wizard vraagt het wél uit maar dynamic-fill
  ondersteunt het niet. Behandelen in de prompt-klus (P6) of eerder als je
  klantnaam in een injecttekst wil kunnen gebruiken.
- Overweeg vergelijkbare fix voor `components/participant/play-view.tsx:1233`
  waar `{roundDecisions.length}/{totalPlayers} beslissingen ingediend` ook
  misleidend kan zijn bij inherited roles (som van decisions vs. aantal
  deelnemers). Niet gedaan omdat het geen "7 van de 1" oplevert — wel
  vergelijkbare vervorming.
