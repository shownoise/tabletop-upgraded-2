# Verificatie — 12 oktober 2026

## Verifieerde gebruikersstroom

Doel: een facilitator bereikt de beschermde beheeromgeving, een deelnemer
bereikt de join-flow, en de AI-wizard kan vanuit de builder een draftscenario
aanvragen.

De technische keten is:

`/admin/builder` → `AiWizardDialog` → `POST /api/scenario-graph/ai-wizard` →
`requireFacilitator` → `ANTHROPIC_API_KEY` → `runWizardPipeline` →
`ScenarioGraph` terug naar de builder.

De live sessieketen is:

facilitator start sessie → join-code → deelnemer join → rol/toewijzing →
injects en beslissing → facilitator lockt ronde → rapport/recap.

## Uitgevoerde controles

| Onderdeel | Resultaat | Bewijs |
| --- | --- | --- |
| Unit/integratietests | Geslaagd | `pnpm test`: 34 bestanden, 332 geslaagd, 1 overgeslagen. |
| Typecheck | Geslaagd | `pnpm exec tsc --noEmit` zonder output/fout. |
| Productiebuild | Geslaagd | `pnpm build` compileert en genereert 16 statische routes. |
| Offline AI-wizard | Geslaagd | `scripts/wizard-e2e-simulate.ts`: 7/7 configuraties, inclusief worst case, repair en null-output regressie. |
| Publieke landing in productie | Geslaagd | Productie-UI geopend; facilitator- en deelnemersingang zichtbaar. |
| Facilitator-gate in productie | Geslaagd | Klik op facilitator leidt naar `/login?callbackUrl=%2Fadmin`. |
| Deelnemer UI → API in productie | Geslaagd | Naam + niet-bestaande code `ZZZZ` geeft zichtbaar `No active session. Ask the facilitator to create one.`; browserconsole toont de verwachte `POST /api/session/join 400`. |
| Productie-AI fouten in logs | Geen recente match | Gerichte foutlogzoeking van 7 dagen op `ai-wizard` gaf geen resultaat. |
| Live AI-wizard, eerste geauthenticeerde run | Ketting werkt, output afgekeurd | Een vier-ronden test ging door outline, generatie en repair; na circa 211 seconden faalde validatie omdat alle rondes een `discussionGoal` misten. Er is geen scenario opgeslagen of gepubliceerd. |
| Live AI-wizard, herhaaltest na fix | Geslaagd | Een vier-ronden test genereerde een draft met 12 injects in de builder. Browser → API → Anthropic → builder werkte volledig; de test-draft is niet opgeslagen of gepubliceerd. |
| Live Event-sessie, één deelnemer | Deels geslaagd, blocker gevonden | Eén deelnemer kon een team kiezen, zag alle zes vereiste rollen in de rolswitcher en ontving beide injects. Inject → discussie werkte. Fase- en scoreacceptatie is niet geslaagd door inconsistente fase-state, zie hieronder. |

## Aangetroffen issues

1. **Lint-gate ontbreekt.** `pnpm lint` faalt direct met `sh: eslint: command
   not found`. Installeer/configureer ESLint of verwijder het script; maak de
   gekozen controle verplicht in CI.
2. **Next.js-waarschuwing.** De productiebuild meldt dat `middleware` is
   verouderd ten gunste van `proxy`. Geen buildbreker, wel gepland
   onderhoudswerk met auth-regressietest.
3. **AI-wizard herstelt een ontbrekend discussie-doel.** De eerste
   geauthenticeerde run leverde vier verder bruikbare rondes zonder
   `discussionGoal`; de ene repair-pass herstelde dat niet. De regressie is
   afgedekt met een inhoudsgebonden fallback uit `round.situation` en de
   daaropvolgende live run leverde een bruikbare draft. Het concept blijft een
   draft en moet in de builder worden beoordeeld.
4. **Fasestatus is live niet betrouwbaar genoeg voor acceptatie.** In een
   wegwerp-Event-sessie werkte inject → discussie. Een daarna geklikte
   discussie → beslissing-overgang reageerde niet op één van de twee zichtbare
   faseknoppen; de andere werkte wel. Vervolgens verschilden facilitator en
   deelnemer tijdelijk van fase en verscheen de sessie opnieuw als `discussion`.
   Daardoor sloot de automatische beslisperiode zonder inzending en bleef de
   review op 0% coverage / `Nog niet gemeten`. Dit is een blocker in
   sessieopslag/realtime en lobbyflow, niet aangeraakt in deze branch.
5. **Scorerekenwerk is getest, live scoreketen nog niet geaccepteerd.** De
   unit/integratietests bevatten de solo-scoreberekening en slagen. Een live
   besluit → lock → score → refresh → rapport-test blijft open totdat de
   fasestatus persistent en eenduidig is.

## Benodigde afsluitende live test

Een geautoriseerde facilitator logt in op productie en maakt een duidelijk
gemarkeerde wegwerpsessie. Test vervolgens in aparte browsers:

1. open `/admin/builder`, genereer een kleine wizardconfiguratie en bevestig
   dat een draftgraph in canvas verschijnt;
2. start één Event-sessie vanuit een voorbeeldscenario en laat één deelnemer
   alle actieve rollen wisselen;
3. laat de facilitator iedere fase precies één keer wijzigen; verifieer na
   iedere wijziging dezelfde fase na twee polls én na refresh in facilitator
   en deelnemer;
4. dien als team minstens één keuze in, sluit de beslissing af, verifieer een
   niet-nul score en controleer die na refresh in de review en het rapport;
5. sluit af en controleer het sessierapport/export;
6. verwijder of archiveer alleen de expliciet als test gemarkeerde sessie.

Noteer request-ID's, response-statussen en screenshots bij een fout. Gebruik
geen echte klantnamen of persoonsgegevens in deze test.

## Productiegeheimen

Er is geen geheim in broncode, logs of deze documenten opgenomen. De huidige
Vercel CLI (63.1.2) bevestigde dat zeven productiegeheimen niet kunnen worden
uitgelezen en schrijft daarvoor placeholders. Een oudere globale CLI (52.2.1)
schreef lege waarden; dat is geen betrouwbare configuratiediagnose en mag niet
worden geïnterpreteerd als ontbrekende productieconfiguratie.

Tijdens de verificatie is per ongeluk een leeg afzonderlijk Vercel-project
`tabletop-production-env-check` aangemaakt door een onveilige interpretatie
van een CLI-subcommand. Het bevat geen productiegeheimen of appdata. Het is
niet verwijderd; verwijdering vraagt expliciete toestemming van de
Vercel-projecteigenaar.
