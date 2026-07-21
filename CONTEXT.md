# Session Context

**Current Task**: Graph-driven scenario builder met BOB-model, IR-retainer context, reliability-labels, soft-decisions, IR-consult mechanic. NIS2-showcase compleet, AI-wizard genereert alle nieuwe velden. Laatste prod: tabletop-upgraded-2-2j2nbh4n1.vercel.app.

**Key Decisions**:
- Graph is de scenario-representatie; engine (`lib/graph/engine.ts`) driveert rounds/decisions/specials/outcomes. Legacy AI-generatie blijft parallel bestaan zonder `graphId`. Story-view (`/admin/story`) is de gestripte facilitator-flow voor graph-sessies; classic dashboard blijft voor AI-sessies.
- BOB-training via drie mechanieken: `RoundNodeData.bobPhase`, `Inject.reliability` (misleading toont geen badge — herkennen), `RoleAction.respondsToMisleading` (auto -6 framework_adherence + lesson). Scoring per role-action/decision-option/outcome via `scoreImpact` + `linkedDimension` + `lessonLearned` → live scoreboard in story-view + BOB-fase analyse in downloadbaar rapport.
- IR-retainer als narrative-anchor: `ScenarioGraph.irRetainerName` + `irPlaybook` (markdown, rol-scoped via `## [cfo,ceo] Titel`); role actions kunnen `pushesInject` hebben voor "Consulteer IR-partner" respons; `RoundNodeData.facilitatorPerspective` alleen zichtbaar voor facilitator.

**Next Steps**:
- Multi-team leaderboard (event-mode voor graph-sessies) — refactor session-store van singleton naar map, KV-keys per sessie, event-controller. Groot werk, later.
- KV-vars staan alleen op Production; Preview-deploys hebben in-memory fallback → cross-instance issues (workaround: setup-form cachet graph in localStorage, POST body stuurt graph inline).
- ANTHROPIC_API_KEY nodig voor AI-wizard + AI-fill + AI-suggest (Claude Haiku voor kleine calls, Sonnet voor wizard).
