# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — this repo's glossarium (Dutch). Contains
  the alias-conflicts (e.g. `evaluationAspects` ≠ scoringsdimensies) that
  otherwise cause repeated confusion.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. This
  directory may not yet exist; if so, proceed silently.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md              ← glossarium
├── docs/
│   ├── overdracht/         ← handover notes, status, session records
│   ├── agents/             ← skill configuration (this file lives here)
│   └── adr/                ← architecture decision records (created lazily)
└── src/  (app/, lib/, components/)
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
