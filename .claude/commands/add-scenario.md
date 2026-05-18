Add a new scenario type to the template generator.

Arguments: $ARGUMENTS (scenario type name, e.g. "DDoS / Extortion")

Steps:
1. Read lib/scenario-generator.ts — only the generateScenario() function and one existing scenario function (e.g. generateBEC) as reference
2. Add a branch in generateScenario() for the new type
3. Write 4 round functions with realistic injects, facilitatorNotes, and roleActions
4. Use hasMonitoring() and injectSlice() helpers for securityCapability and difficulty awareness
5. filterActions() must wrap every roleActions array
6. Run: npx tsc --noEmit to verify no type errors
