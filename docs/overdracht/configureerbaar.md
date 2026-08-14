# Inventarisatie — teksten en configuratie

Wat kun je zelf aanpassen zonder in code te duiken, en wat niet. Fase 1 van P4:
alleen kijken, geen wijzigingen. Fase 2 (centraliseren van goedgekeurde teksten
naar één configuratie-module) wacht op jouw goedkeuring per rij.

## Legenda "Bron"

- **builder** — je kunt het per scenario aanpassen in de scenariobuilder
  (`/admin/builder`) of setup-form (`/admin`). Aanpassing raakt alleen dat ene
  scenario.
- **scenario-data** — het staat wél in scenario-data (`ScenarioGraph`), maar de
  builder-UI biedt geen editor. Aanpassing vereist JSON-editen of nieuw veld
  in de builder.
- **code** — hardcoded in een `.ts` / `.tsx` bestand. Aanpassing vereist een
  code-wijziging en deployment.
- **i18n** — staat in `lib/i18n.ts` (356 keys, EN + NL). Ontworpen om ooit een
  vertaallaag te worden; nu edit je hem in code.

## Legenda "Kan ik het aanpassen zonder code?"

- **Ja** — in de UI zonder tussenkomst
- **Ja, per scenario** — via builder, alleen voor dit scenario
- **Nee** — code-wijziging nodig
- **Deels** — sommige velden wel, sommige niet

## De tabel

| Onderdeel | Waar staat het nu | Bron | Kan ik zonder code? |
|---|---|---|---|
| **Startbriefing per rol — mandaat samenvatting** | `lib/types.ts:44,59,74,88,102,116,129,143` — `ROLE_META[role].mandateSummary` | code | Nee |
| **Startbriefing per rol — authorities lijst** | `lib/types.ts:45-51,60-66,75-80,89-94,103-108,117-121,130-135,144-148` — `ROLE_META[role].authorities[]` | code | Nee |
| **Startbriefing per rol — override in scenario** | `ScenarioGraph.roleBriefings` (`lib/graph/types.ts:310`) — per rol een `{text, playbookGaps[]}` | scenario-data (wizard vult 'm) | Ja, per scenario (via builder — verifieer: bestaat er een editor voor?) |
| **Stuurvragen per ronde (opening)** | `RoundNodeData.openingPrompts?: string[]` (`lib/graph/types.ts:58`) — 2-3 vragen voor discussiestart | scenario-data (wizard vult) | Ja, per scenario |
| **Review-vragen per ronde** | `RoundNodeData.reviewPrompts?: string[]` (`lib/graph/types.ts:71`) — Nederlandse review-vragen gekoppeld aan outcome-assen | scenario-data (wizard vult) | Ja, per scenario |
| **Valkuilen ("red flags") per ronde** | `FacilitatorNotes.redFlags[]` in `lib/types.ts:479`, meegegeven op `RoundNodeData.facilitatorNotes` | scenario-data | Ja, per scenario |
| **Discussie-doel per ronde** | `FacilitatorNotes.discussionGoal` (`lib/types.ts:475`) | scenario-data | Ja, per scenario |
| **Hints per ronde (facilitator-only)** | `FacilitatorNotes.hints[]` (`lib/types.ts:477`) | scenario-data | Ja, per scenario |
| **Verwachte beslissingen per ronde** | `FacilitatorNotes.expectedDecisions[]` (`lib/types.ts:478`) | scenario-data | Ja, per scenario |
| **Facilitator-perspectief per ronde** | `RoundNodeData.facilitatorPerspective?` (`lib/graph/types.ts:60`) — IR-consultant kijk, alleen zichtbaar voor facilitator | scenario-data | Ja, per scenario |
| **IR-playbook (in-session naslag)** | `ScenarioGraph.irPlaybook?` (`lib/graph/types.ts:304`) — markdown-blob rechts in de participant view | scenario-data | Ja, per scenario |
| **Rolkaarten** (`/admin/role-cards`) | `app/admin/role-cards/page.tsx` — leest ROLE_META | code | Nee |
| **Meldplicht — bevoegde autoriteit** | `lib/regulatory/regimes.ts:16` — `authorityLabel` per regime. Default = "Autoriteit Persoonsgegevens (AVG) + CSIRT/NCSC (NIS2)" | code (defaults) + scenario-data (per-scenario override) | Deels — kiezen uit bestaande regimes ja; nieuwe autoriteit is code |
| **Meldplicht — hardcoded NIS2 tekst in UI** | `lib/i18n.ts:159,187,215,367,395,423` — `modeHint_training`, `exercise_goal_nis2_readiness`, `plan_nis2` | i18n | Nee (P2 vraag 3 gaat hierover) |
| **Uitleg-schermen — opening-briefing** | `components/participant/opening-briefing.tsx` — combineert `ROLE_META` + `roleBriefing` | code + scenario-data | Deels — inhoud ja, layout nee |
| **Uitleg-schermen — event-mode-help** | `components/admin/event-mode-help.tsx` — vaste helpteksten | code | Nee |
| **Foutmeldingen — algemeen (toasts)** | Verspreid: geen centrale catch. Voorbeeld: `components/participant/decision-panel.tsx:52` `setError("Selecteer een actie.")` | code, hardcoded | Nee |
| **Foutmeldingen — validate.ts (builder)** | `lib/graph/validate.ts:159` — dingen als *"Inject … heeft geen type informatie — kies feit, aanname of fabel"* | code, hardcoded | Nee |
| **Knoplabels — via `tr(lang, key)`** | Componenten roepen `tr(lang, "decisionSubmitted")` etc. → `lib/i18n.ts` | i18n | Nee |
| **Knoplabels — hardcoded** | Talrijke componenten met letterlijke NL/EN strings. Voorbeeld: `components/admin/control-dashboard.tsx:342` `Beslissing afsluiten` | code, hardcoded | Nee |
| **Setup-form velden en helpteksten** | `components/admin/setup-form.tsx` — labels, placeholders, tooltips | code, hardcoded | Nee |
| **Scenario-naam** | `ScenarioGraph.name` | scenario-data (wizard vult, builder editable) | Ja, per scenario |
| **Ronde-titel** | `RoundNodeData.title` | scenario-data | Ja, per scenario |
| **Situatieschets per ronde** | `RoundNodeData.situation_update` | scenario-data | Ja, per scenario |
| **Inject-tekst** (title + content) | `InjectNodeData.title` en `.content` | scenario-data | Ja, per scenario |
| **Inject-classificatie label** ("feit"/"aanname"/"fabel") | Enum in code (`lib/graph/types.ts:97`) + filter buttons in `components/participant/inject-feed.tsx:617` | code | Nee (P2 vraag 1 gaat hierover) |
| **Optie-tekst decision** | `DecisionOption.label` | scenario-data | Ja, per scenario |
| **Lesson learned per optie** | `DecisionOption.lessonLearned?` | scenario-data | Ja, per scenario |
| **Learning objectives per ronde** | `RoundNodeData.learningObjectives?: LearningObjective[]` | scenario-data | Ja, per scenario |
| **Outcome-narratief (einde sessie)** | `OutcomeNodeData.narrative` + `lessonLearned?` | scenario-data | Ja, per scenario |
| **Escalatie-labels ("normal", "elevated", "high", "critical")** | `components/participant/session-hud.tsx:12` — hardcoded Engelse strings | code | Nee (P2 vraag 4) |
| **Urgency-labels op injects** | Waardes uit `Urgency` type (`lib/types.ts:360`) — `low/medium/high/critical`, ge-render als letterlijke Engelse strings in `inject-feed.tsx:730` | code | Nee |
| **Ronde-fase labels ("inject", "discussion", "decision", "review")** | `PHASE_ORDER` in `components/admin/control-dashboard.tsx:39`. NL-vertalingen in `ROUND_PHASE_LABELS_NL` (te vinden elders — geen grep gedaan) | code | Nee |
| **IR-retainer naam** | Hardcoded `"Eye Security"` via `EYE_SECURITY_RETAINER` in `lib/graph/types.ts:248` | code | Nee |
| **Rollen (de 8 rol-namen zelf)** | `Role` type en `ROLE_META` in `lib/types.ts:10,37` | code | Nee |
| **Special conditions (backups nooit getest, etc.)** | `SPECIAL_CONDITIONS` in `lib/wizard/config.ts:68` — 7 stuks met `label` + `narrativePrompt` | code | Nee |
| **Regulatory regime keuze** | `lib/regulatory/regimes.ts` — nu 1 default (`nl_avg_nis2`). Wizard: `DEFAULT_REGULATORY_REGIME_ID` | code | Nee |

## Wat is de grootste opsplitsing?

- **~65% van de tekst die je een deelnemer laat lezen komt uit `scenario-data`** —
  briefings, situatieschetsen, injects, opties, outcomes, playbook. Dat kun je
  per scenario aanpassen zonder tussenkomst.
- **~30% zit in i18n.ts** (356 keys) — UI-labels, hints, foutmeldingen die door
  `tr(lang, "key")` heen lopen. Dat is opzettelijk voorbereid op een
  vertaallaag maar staat nu in code.
- **~5% is hardcoded** — verspreide knoplabels, escalatie/urgency strings,
  validate.ts foutmeldingen, `EYE_SECURITY_RETAINER`.

De 65% is dus al aanpasbaar. De 30% i18n is precies wat de externe developers
gaan aanpakken. De 5% hardcoded is de rommel die opgeruimd hoort te worden.

## Voorstel voor fase 2 (wacht op jouw akkoord per rij)

Wat ik graag centraal zou zetten in één configuratie-module (buiten i18n om,
dus geen vertaallaag — alleen "één plek voor niet-scenario-specifieke NL
teksten"):

1. **Escalatie-labels** in `session-hud.tsx:12` en de urgency-render in
   `inject-feed.tsx:730` — zet de labels in één const, in NL.
2. **`EYE_SECURITY_RETAINER` naam** — al centraal, hoeft niets aan.
3. **Ronde-fase labels** — check waar `ROUND_PHASE_LABELS_NL` staat en of alle
   verwijzingen die gebruiken.
4. **Foutmeldingen uit validate.ts** — verzamel naar één map met beschrijvende
   keys, roep aan via functie. Ook al ga je i18n later doen, dit maakt de
   eerste rondes makkelijker vindbaar.
5. **Knoplabels die nu niet via `tr()` gaan** — bijvoorbeeld "Beslissing
   afsluiten" in `control-dashboard.tsx:342`. Kandidaten voor doorschuiven
   naar `tr(lang, ...)` OF naar dezelfde centrale const.

Wat NIET in fase 2:

- ROLE_META authorities/mandateSummary — dit is de spec van de rollen, die
  hoort in code (dat is een type-invariant, niet een tekst-tweak).
- Scenario-specifieke teksten — die horen in de builder, niet in een centrale
  module.
- i18n keys — die pas de developers aan als ze de vertaallaag opzetten.

## Wat de developers moeten meenemen (fase 3)

Uit dezelfde analyse: velden die per ronde/rol instelbaar zouden moeten zijn in
de builder maar dat nu niet zijn.

- **`facilitatorPerspective` per ronde** — bestaat in het type, maar heeft die
  een editor in de UI? (Ik heb niet gecontroleerd of `/admin/builder`
  inspector alle velden bewerkbaar toont.)
- **`meldingMoments` per ronde** — vergelijkbaar: bestaat het veld, is er een
  editor.
- **`irPlaybook` op scenario-niveau** — grote markdown-blob, veel waarde als
  je 'm per klant kan aanpassen. Verifieer editability.
- **`roleBriefings` overrides per rol** — waarschijnlijk wél editable, maar
  worth een expliciete check.
- **`aiPromptTemplate` op round/inject** — bedoeld voor dynamische AI-fill
  per node. Wie beheert dat, en waar?

Bij bevestiging kan ik hier een aparte "voor developers" issue-lijst van maken.
