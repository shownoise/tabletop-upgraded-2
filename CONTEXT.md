# Session Context

**Current Task**: Scenario generation — alle setup-form variabelen worden nu meegestuurd in de AI-prompts.

**Key Decisions**:
- `buildScenarioDirectives()` in `app/api/session/create/route.ts` vertaalt elk config-veld naar expliciete AI-instructies (crown jewels by name, sector-regulator, difficulty-pacing, etc.)
- `lib/scenario-generator.ts` heeft scenario-type branches: Ransomware / Insider Threat / BEC / Data Exfiltration
- `selectedRoles` toegevoegd aan `ExerciseConfig` + role-selector in setup-form; AI krijgt rollen + bevoegdheden in prompt

**Next Steps**:
- Testen of Full AI-mode (Sonnet) alle parameters correct verwerkt in gegenereerde injects
- Eventueel: specials (ransomware negotiation chat) ook context-aware maken via config
- Productie deploy gedaan — laatste preview URL: tabletop-upgraded-2-4cpm24bnc.vercel.app
