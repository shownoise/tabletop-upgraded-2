# Core-scope audit — 12 oktober 2026

## Besluit voor de Partner Event-MVP

De kern is één begeleide oefening per zaal/team: een facilitator stuurt
informatie en fasen; een team ziet informatie, kiest per rol en legt keuzes
vast; de zaal ziet voortgang en een afgeronde uitkomst. Alles wat dat niet
sneller, betrouwbaarder of begrijpelijker maakt, is geen standaardscherm in
de MVP.

De minimale gebruikersstroom is:

1. facilitator kiest een bestaand scenario en start een Event;
2. één notulist per team joint met code, kiest een team en wisselt zo nodig
   van actieve rol;
3. team leest injects, bespreekt en kiest;
4. facilitator gaat gecontroleerd door de fasen en sluit een ronde;
5. uitkomst en korte debrief zijn zichtbaar.

## Bewezen in de live test

- Eén solo-deelnemer in **Event-modus** kreeg de zes vereiste rollen in de
  rolswitcher en zag de twee ronde-injects. Dit voldoet aan het gewenste
  “één device, alle rollen”-gedrag voor Partner Event.
- De deelnemer kreeg vóór de start eerst een teamkeuze. Na teamaanmaak verdwijnt
  dat scherm zonder bevestiging van de gekozen teamnaam; dit is verwarrend,
  maar geen dataverlies.
- De classificatie-filters en -labels (`feit` / `aanname`) zijn uit het
  deelnemersscherm gehaald. De classificatievelden blijven in scenario’s en
  rapportdata bestaan; er is geen migratie of inhoudsverlies.
- De live fase-state is niet acceptabel als MVP-contract: zie de
  verificatie voor de reproduceerbare inconsistentie. Daardoor is ook de
  live scoreketen nog geen acceptatiegegeven.

## Standaard zichtbaar in MVP

- scenario kiezen/starten;
- joincode, teamkeuze en rolswitcher in Event-modus;
- ronde, injects, rolkeuze en besliskaarten;
- één duidelijke fasebesturing, voortgang en lock;
- uitkomst, score en korte debrief/rapport.

## Verbergen achter “Uitgebreide begeleiding”

Deze onderdelen hebben een functie, maar vergroten de cognitieve last tijdens
een Partner Event. Verberg ze standaard totdat gebruik en eigenaar zijn
bevestigd; verwijder ze niet zonder gebruiksdata.

- scripted specials (ransomware-onderhandeling, AP-melding, journalist-Q&A);
- toezichthouderrapport, meldplicht, retainerstatus en surprise-/ruis-injects;
- fact-check-annotaties en hun uitgebreide facilitatorpanels;
- volledige zes-assige scorediagnostiek tijdens de ronde (bewaar voor debrief);
- testclients, kwaliteitsrubriek, promptbeheer en rolkaarten in dagelijkse
  adminnavigatie.

## Kandidaten voor gecontroleerde uitfasering

Deze routes bestaan naast de kernroute, maar er is geen gebruiksonderzoek
uitgevoerd. Behandel ze als migratie-/telemetrie-kandidaten, niet als veilig
te verwijderen code.

- legacy templates en de oude format builder;
- parallelle scenario-ingangen buiten `Scenario's → Builder`;
- klant-/userbeheer als Partner Event geen CRM of self-service accountbeheer
  nodig heeft;
- per-rol trainingsflow wanneer Partner Event de enige gelanceerde modus is.

Meet per kandidaat routebezoek en opgeslagen data, bied zo nodig een
expliciete export/migratie, en verwijder pas daarna code en data.

## Grenzen voor de externe developers

De fase-inconsistentie raakt sessieopslag, polling/SSE en lobbyflow. Die laag
is bewust niet aangepast in deze branch. Los eerst één persistente
sessie-state met monotone versie/revisie en idempotente fasecommando’s op;
accepteer daarna pas de score- en reconnect-flow. De producteigenaar kan
intussen scenario-inhoud, wizardprompts, scoringsregels en rapportontwerp
blijven beheren.
