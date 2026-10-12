# Herbouwplan — Partner Event eerst

## Werkhypothese

Partner Event betekent hier: één begeleide oefening in een zaal, met één
facilitator, een groot gedeeld scherm en een notulist of team dat besluiten
vastlegt. Deelnemers kunnen met een join-code meedoen, maar het event hoeft
nog geen klant-CRM, AI-generatie, scenario-editor of individueel
langetermijnprofiel te hebben. Als het gewenste eventmodel per tafel een
aparte score moet vergelijken, is dat een uitbreiding ná de MVP.

Deze keuze houdt de eerste release gericht op een aantoonbaar goed lopend
event, niet op het herbouwen van alle bestaande beheerfuncties.

## Volgorde van releases

| Versie | Belofte | Nodige functies | Bewust niet opnemen |
| --- | --- | --- | --- |
| 0.0 — foundation | Een veilig, testbaar fundament voor een live event. | Domeincontract voor scenario, event, ronde, rol, inject, besluit en resultaat; relationele datastore; migrations; facilitatorauth; auditlog; expliciete realtime-adapter; feature flags; testdata en CI. | Import van oude data zonder migratieplan, generieke CMS/builder, AI. |
| 1.0 — Partner Event MVP | Een facilitator kan één vooraf gecontroleerd scenario probleemloos in een zaal draaien. | Eén gepubliceerde event-scenario-versie; event aanmaken/starten/pauzeren/volgende ronde; join-code/QR; eenvoudige rol- of teamtoewijzing; gedeeld presenter-scherm; injects en timer; één vastgelegde beslissing per ronde; facilitatorcontrole; korte eindrecap en export van eventresultaat; herstel na refresh. | Klantenbeheer, scenario-editor, AI-wizard, individueel rapport, multi-event analytics, vrije configuratie van scoring. |
| 1.1 — Herbruikbare begeleide sessie | Dezelfde kern werkt herhaalbaar voor meerdere facilitators en scenario's. | Scenario-catalogus; scenario-versies en publiceren; rolkaarten/briefings; instelbare maar begrensde scoring; volledige sessiehistorie; facilitatornotities; betrouwbaar reconnect- en sessieherstel; toegankelijkheids- en mobiele check. | Vrije graph-editor, LLM-generatie, tenant-specifieke vrije teksten. |
| 1.2 — Klantoplevering | Een event wordt een bruikbaar klantproduct. | Klantprofiel; sessie aan klant koppelen; rapport met uitkomsten, besluiten, observaties en aanbevelingen; print/PDF-export; consent/retentie; vervolgactie; beperkte configuratie van vaste teksten en rollen. | Automatisch gegenereerde aanbevelingen, complexe benchmarkdashboards. |
| 2.0 — Auteurservaring en AI | Content kan beheerst worden gemaakt en aangepast. | Visuele ScenarioGraph-builder; validatie, preview en draft→review→publish; scenario-import met expliciete migratie; AI-wizard als draft-assistent; promptversies; AI-evaluaties; kosten-, timeout- en foutobservability. | Ongecontroleerde publicatie van AI-output, directe mutatie van live scenario's. |
| 3.0 — Platform | Meerdere partners/klanten beheren zelfstandig hun programma. | Tenant- en rolmodel; meertaligheid; meerdere gelijktijdige sessies; team/per-tafelvergelijking; integraties; analytics; beheerconsole; SLO's, backup/restore en privacyprocessen. | — |

## Minimum acceptatie voor 1.0

Een Partner Event MVP is pas klaar wanneer een facilitator zonder developer:

1. een vooraf gepubliceerd scenario kiest en een event start;
2. een QR/join-code toont en deelnemers laat aansluiten;
3. alle aanwezigen op het gedeelde scherm dezelfde fase zien;
4. injects, timer en besluiten bedient zonder dubbelklikken of race conditions;
5. na refresh of kort netwerkverlies verder kan;
6. afsluit met een exporteerbare recap van scenario, rondes, besluiten en
   scores/observaties;
7. geen data van een ander event of andere klant kan zien.

Dit zijn end-to-end acceptatietests, niet alleen unit-tests. Voer ze uit met
minstens een facilitator, een notulist, een deelnemer en een observer/presenter
in afzonderlijke browsers.

## Architectuurkeuzes voor de herbouw

- Maak `ScenarioGraph` of een bewust vereenvoudigde eventvariant het enige
  versieerbare scenario-contract. Laat oude templates alleen via een importer
  binnenkomen.
- Scheid content van runtime: scenario's zijn immutable gepubliceerd,
  eventstate is per event mutabel, en rapportdata is een afgesloten snapshot.
- Zet alle state-mutaties achter één sessie-module met idempotency-keys en een
  expliciete transitiekaart. UI's mogen geen sessieregels dupliceren.
- Kies één realtime-adapter die reconnect, ordering en aanwezigheid afhandelt.
  Polling is hooguit een read-fallback, niet de bron van waarheid.
- Maak presenter, facilitator en participant drie kleine clients van dezelfde
  read-modellen, met server-side autorisatie per actie.
- Bouw AI achter een smalle generatie-interface. De output is altijd draft;
  validatie en menselijke publicatie zijn verplicht.
- Meet vanaf 1.0 event-start, join, round transition, decision lock, reconnect
  en export. Zonder die signalen is een live partner-event niet te opereren.

## Migratiepad vanaf de huidige app

1. Inventariseer eerst bestaande scenario's en sessies per eigenaar en
   bewaartermijn. Exporteer niet blind; vooral sessies en rapporten kunnen
   klantgegevens bevatten.
2. Schrijf een import-adapter die oude `ScenarioGraph`-versies normaliseert
   naar het nieuwe gepubliceerde scenario-contract. Bewaar origineel en
   importresultaat naast elkaar totdat de acceptatie compleet is.
3. Migreer scenario's vóór sessies. Oude sessies blijven read-only rapport-
   snapshots; probeer ze niet opnieuw in een nieuwe state-machine af te spelen.
4. Draai parallel één intern event met dezelfde scenario-inhoud en vergelijk
   beslissingen/uitkomst met de huidige app.
5. Pas na die vergelijking een partner-event op de nieuwe runtime toe. Houd de
   huidige app beschikbaar als terugval totdat het rapport is opgeleverd.

## Rollen in de uitvoering

- Producteigenaar: inhoud, promptbeleid, scorebetekenis, vaste teksten,
  rapportontwerp en de acceptatie van een gepubliceerd scenario.
- Externe developers: datastore, sessie- en realtime-contract, i18n, UI-state,
  presenter, observability, security en deployment.
- Facilitator/testteam: eventrehearsal, timing, join/reconnect en rapportcheck.

De eerste sprint is pas waardevol als hij eindigt in een werkende verticale
plak van 1.0 — niet in losse schermen of alleen een datamodel.
