Add a new built-in scenario template.

Arguments: $ARGUMENTS (scenario type name, e.g. "DDoS / Extortion")

Steps:
1. Read `lib/template-types.ts` for the `ScenarioTemplate` shape, then read `BEC_TEMPLATE` in `lib/builtin-templates.ts` as the shorter reference example (grep for it — the file is 42KB, don't read it whole)
2. Add a new exported `ScenarioTemplate` const in `lib/builtin-templates.ts`
3. Register it in the `BUILTIN_TEMPLATES` array at the bottom of that file
4. Write the rounds as `RoundTemplate[]`: each needs `situationUpdateTemplate`, `timerMinutes`, `injects`, and the full `facilitatorNotes` block (`discussionGoal`, `keyQuestions`, `hints`, `expectedDecisions`, `redFlags`, `debriefPoints`)
5. Pick `tags` from the `TemplateTag` union and set `difficulty`, `contentMode`, `estimatedDurationMinutes`, `organizationContext` and `outcomes`
6. Run `pnpm exec tsc --noEmit` and `pnpm test`

Note: a template is the authoring format. What actually runs a session is a
`ScenarioGraph` (`lib/graph/types.ts`), built in `/admin/builder`. Adding a
template does not by itself make a playable session.
