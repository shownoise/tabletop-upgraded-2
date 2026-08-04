# Bouwopdracht: Crisis simulatie — alles werkend maken

## Wat er nu mis is

Er zijn twee kernproblemen:

1. **Smart model genereert altijd het standaard template** — de AI-generatie faalt stil
   en valt terug op `generateScenario(config)` zonder dat de gebruiker dit ziet.
2. **LearningObjectives worden nooit gegenereerd** — de types en tracking-code bestaan
   wel, maar het AI-schema (`lib/types/scenario-instance.ts`) en de bridge
   (`lib/scenario/bridge.ts`) kennen het concept niet. De AI kan ze dus nooit aanmaken.

Lees eerst deze bestanden volledig voordat je iets aanpast:
- `app/api/session/create/route.ts`
- `lib/scenario/generator.ts`
- `lib/scenario/bridge.ts`
- `lib/types/scenario-instance.ts`
- `lib/types.ts` (de bestaande `LearningObjective` interface staat hier al)
- `components/participant/special-modal.tsx`
- `components/admin/report-view.tsx`

---

## Fix 1 — Diagnose en herstel AI-generatie

**Bestand: `app/api/session/create/route.ts`**

De `generateWithAI()` functie vangt alle fouten op en returnt `{ aiError }`, waarna de
POST handler stil terugvalt op het statische scenario. De gebruiker ziet nooit wat er
misgaat.

Stap A: Voeg aan het begin van de `catch` block in `generateWithAI()` een
`console.error("[generateWithAI] FULL ERROR:", err)` toe met de volledige stack trace.

Stap B: Als `aiResult` een `aiError` bevat én `aiIntensity` is `"lean"` of `"full"`,
gooi dan een HTTP 500 terug met `{ error: aiError }` in plaats van stil terug te vallen.
De setup-form toont dit dan aan de gebruiker. Stille fallback is alleen acceptabel als
`aiIntensity === "off"`.

Stap C: Controleer of `ANTHROPIC_API_KEY` aanwezig is. Als de key ontbreekt, log dan
`"[generateWithAI] ANTHROPIC_API_KEY is not set"` en return een duidelijke foutmelding.

---

## Fix 2 — LearningObjectives in het AI-schema

**Bestand: `lib/types/scenario-instance.ts`**

Voeg toe aan de `ModuleInstance` interface een optioneel veld:

```typescript
learning_objectives?: Array<{
  id: string
  description: string        // max 15 woorden, actiegericht
  module: string             // ModuleId waarde
  measuredBy: 'decision' | 'special' | 'manual'
  triggerActionIds?: string[]
  triggerSpecialType?: string
}>
```

**Bestand: `lib/scenario/bridge.ts`**

In de `moduleToRound()` functie: map `mod.learning_objectives` naar
`round.learningObjectives`. Gebruik het `LearningObjective` type uit `lib/types.ts`.
Voeg de import toe bovenaan. De mapping is direct: elk veld van `mod.learning_objectives[i]`
komt overeen met `LearningObjective`. Zet `achieved: false` als default.

```typescript
// In moduleToRound(), voeg toe aan de return:
learningObjectives: mod.learning_objectives?.map(obj => ({
  ...obj,
  achieved: false,
})) ?? [],
```

Voeg `LearningObjective` toe aan de import bovenaan het bestand.

---

## Fix 3 — LearningObjectives in de AI-prompt

**Bestand: `lib/scenario/generator.ts`**

Zoek de functie `buildPrompt()`. Voeg aan het einde van de module-instructies toe dat
elke `ModuleInstance` een `learning_objectives` array moet bevatten met 1-2 objectives.

Voeg deze tekst toe aan de relevante sectie van de prompt-builder:

```
Every module MUST include a "learning_objectives" array with 1–2 items. Each item:
{
  "id": "obj-{module_id}-{n}",
  "description": "<max 15 words, action verb, e.g. 'Team escaleert incident naar CISO binnen ronde'>",
  "module": "<module_id>",
  "measuredBy": "decision" | "special" | "manual",
  "triggerActionIds": ["<actionId>"]  // only if measuredBy="decision"
  "triggerSpecialType": "<type>"       // only if measuredBy="special"
}
```

Voeg ook toe aan `lib/scenario/prompts.ts` (het system prompt) dat `learning_objectives`
een verplicht veld is per module, met een voorbeeld.

---

## Fix 4 — RoleActions ontbreken in de AI-output

**Bestand: `lib/scenario/bridge.ts`**

De `moduleToRound()` functie zet nooit `roleActions` op de ronde — die is altijd
`undefined` voor AI-gegenereerde scenario's. Daardoor zien deelnemers geen keuzes.

In de `DecisionBox` interface (`lib/types/scenario-instance.ts`) staan al `questions`.
Bouw vanuit `mod.decisions` een minimale `roleActions` array:

```typescript
roleActions: mod.decisions.flatMap((d, di) =>
  d.options?.map((opt, oi) => ({
    id: `${mod.id}-d${di}-o${oi}`,
    label: opt.label,
    description: opt.description ?? '',
    allowedRoles: opt.allowedRoles ?? [],
    irPlanAligned: opt.recommended ?? false,
    isRecommended: opt.recommended ?? false,
    consequence: opt.consequence,
  })) ?? []
),
```

Controleer eerst hoe `DecisionBox` en zijn `options` eruit zien in
`lib/types/scenario-instance.ts`. Pas de mapping aan op de werkelijke veldnamen.
Als `options` niet bestaat: voeg het toe aan `DecisionBox`.

---

## Fix 5 — Bug: kwaliteit zichtbaar vóór keuze in specials

**Bestand: `components/participant/special-modal.tsx`**

**Al gedeeltelijk gefixt**, maar controleer de `ScriptedChoices` component. De knoppen
mogen GEEN `QUALITY_STYLE[choice.quality]` of kwaliteitsbadge tonen zolang
`lastChoiceId === null`. Alle knoppen krijgen dezelfde neutrale klasse:
`"border-border bg-card hover:bg-muted"`.

Kwaliteitskleur en badge verschijnen alleen via `ChoiceHint` ná de keuze.
De `QUALITY_STYLE` en `QUALITY_BADGE` maps blijven bestaan voor gebruik ná selectie.

---

## Fix 6 — Rapport: Leerdoelen sectie

**Bestand: `components/admin/report-view.tsx`**

Lees dit bestand eerst volledig. Voeg een sectie "Leerdoelen" toe na de bestaande
scores-sectie. De `SessionReport` bevat al `perObjective` en `scores.objectivesAchieved`.

Toon een tabel of lijst met per objective:
- Ronde nummer
- Beschrijving
- Status: groene vink ("Behaald") of rood kruis ("Niet behaald")

Stijl consistent met de rest van het rapport (bestaande Tailwind classes volgen).
Toon de sectie alleen als `report.perObjective?.length > 0`.

---

## Fix 7 — Statisch scenario: voeg ook learningObjectives toe

**Bestand: `lib/scenario-generator.ts`**

De statische generator (`generateScenario()`) genereert nooit `learningObjectives`.
Zoek de functies `generateRansomware()`, `generateInsiderThreat()`, `generateBEC()`,
`generateDataExfil()`. Voeg aan elke ronde in deze functies een minimale
`learningObjectives` array toe gebaseerd op de ronde-inhoud.

Voorbeeld voor ransomware ronde 1:
```typescript
learningObjectives: [
  {
    id: "obj-r1-1",
    description: "Team declareert incident en activeert IR-procedure",
    module: "detection_sensemaking",
    measuredBy: "decision" as const,
    triggerActionIds: [], // vul in met de actionId(s) die dit doel bereiken
    achieved: false,
  }
]
```

Gebruik de bestaande `roleActions` van die ronde om de juiste `triggerActionIds` te
bepalen: kijk welke actie `irPlanAligned: true` heeft en gebruik die id.

---

## Volgorde van uitvoering

1. Fix 1 (AI diagnose) — voer uit, kijk in de logs wat de echte fout is
2. Fix 2 + Fix 3 (schema + prompt) — samen uitvoeren
3. Fix 4 (roleActions in bridge) — na Fix 2
4. Fix 5 (quality bug check) — snel te verifiëren
5. Fix 6 (rapport UI) — zelfstandig
6. Fix 7 (statisch scenario objectives) — zelfstandig

## Constraints

- Geen nieuwe bestanden aanmaken tenzij strikt noodzakelijk
- Na elke sessie-mutatie: `dbSetSession()` en `broadcastState()` aanroepen
- `toParticipantState()` mag nooit `triggerActionIds`, `isRecommended` of governance flags
  doorsturen naar deelnemers
- TypeScript strict — geen `any` toevoegen
- Geen comments die uitleggen wat de code doet
