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
| Unit/integratietests | Geslaagd | `pnpm test`: 34 bestanden, 330 geslaagd, 1 overgeslagen. |
| Typecheck | Geslaagd | `pnpm exec tsc --noEmit` zonder output/fout. |
| Productiebuild | Geslaagd | `pnpm build` compileert en genereert 16 statische routes. |
| Offline AI-wizard | Geslaagd | `scripts/wizard-e2e-simulate.ts`: 7/7 configuraties, inclusief worst case, repair en null-output regressie. |
| Publieke landing in productie | Geslaagd | Productie-UI geopend; facilitator- en deelnemersingang zichtbaar. |
| Facilitator-gate in productie | Geslaagd | Klik op facilitator leidt naar `/login?callbackUrl=%2Fadmin`. |
| Deelnemer UI → API in productie | Geslaagd | Naam + niet-bestaande code `ZZZZ` geeft zichtbaar `No active session. Ask the facilitator to create one.`; browserconsole toont de verwachte `POST /api/session/join 400`. |
| Productie-AI fouten in logs | Geen recente match | Gerichte foutlogzoeking van 7 dagen op `ai-wizard` gaf geen resultaat. Dit is geen bewijs van een succesvolle wizard-run. |

## Aangetroffen issues

1. **Lint-gate ontbreekt.** `pnpm lint` faalt direct met `sh: eslint: command
   not found`. Installeer/configureer ESLint of verwijder het script; maak de
   gekozen controle verplicht in CI.
2. **Next.js-waarschuwing.** De productiebuild meldt dat `middleware` is
   verouderd ten gunste van `proxy`. Geen buildbreker, wel gepland
   onderhoudswerk met auth-regressietest.
3. **AI-wizard live nog niet bevestigd.** Vercel redigeert
   productiegeheimen bewust als `[SENSITIVE]`, waardoor de echte
   `ANTHROPIC_API_KEY` niet veilig naar deze werkruimte kan worden gehaald.
   Zonder geauthenticeerde facilitator-sessie is de route terecht niet aan te
   roepen. De route zelf valideert sleutel, config, rate limit en pipeline;
   de offline keten slaagt.
4. **Complete live sessie nog niet bevestigd.** Er is geen testevent
   aangemaakt, omdat dit een echte productiesessie en geauthenticeerde mutaties
   vereist. Daardoor zijn de succesvolle join, rolkeuze, besluit, lock,
   reconnect en rapportweergave nog open.

## Benodigde afsluitende live test

Een geautoriseerde facilitator logt in op productie en maakt een duidelijk
gemarkeerde wegwerpsessie. Test vervolgens in aparte browsers:

1. open `/admin/builder`, genereer een kleine wizardconfiguratie en bevestig
   dat een draftgraph in canvas verschijnt;
2. start één sessie vanuit een bekend scenario;
3. laat een deelnemer joinen, een rol ontvangen, injects zien en een besluit
   indienen;
4. lock de beslissing als facilitator, ga naar de volgende ronde en refresh
   zowel facilitator als deelnemer;
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
