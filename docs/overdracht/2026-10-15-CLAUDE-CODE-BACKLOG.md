# Claude Code — actuele ontwikkelbacklog

**Status op 15 oktober 2026.** Dit is de startplek voor het resterende werk.
Gebruik dit document samen met `CONTEXT.md`, niet met de oudere
`docs/overdracht/status.md`: die snapshot stopt op augustus en is historisch.

## Huidige, geverifieerde stand

- `main` staat op `1ba77b1` en Vercel productie draait op
  `https://tabletop-upgraded-2.vercel.app`.
- Er staat **geen open pull request**. De oudere remote featurebranches zijn
  squash-merge resten; maak daar geen nieuwe PR van.
- Partner Event heeft nu graph-gebonden keuzes, zesdimensionale scorevectoren,
  rol-overname voor een solo-deelnemer, en een draft-only AI-wizard.
- De AI-wizard is op productie doorlopen met een nieuw vier-rondenconcept. Hij
  herstelt kapotte JSON en incomplete beslissingstekst gericht. Ontbrekende
  keuzes, scores of graph-links blokkeren; inhoudelijke waarschuwingen (zoals
  dominante score-afwegingen of onvoldoende aansluiting tussen rondes) openen
  als concept zodat de scenarioauteur ze handmatig kan aanpassen.
- Score-outcomes met een `scoreRange` zijn automatische einduitkomsten. Zij
  hoeven geen getekende inkomende edge te hebben en geven niet langer een
  onterechte validatiefout.

## Werkvolgorde

### 1. Eerst: maak de live Event-kern betrouwbaar

| Volgorde | Ticket | Klaar wanneer |
| --- | --- | --- |
| P0 | [#58](https://github.com/shownoise/tabletop-upgraded-2/issues/58) | Eén server-authoritative fase-overgang, één duidelijke facilitatorbediening, en facilitator/deelnemer zien na refresh dezelfde fase. |
| P1 | [#60](https://github.com/shownoise/tabletop-upgraded-2/issues/60) | Partner Event toont alleen inject → overleg → keuze → dimensiefeedback → volgende ronde; zijpanelen staan standaard uit zonder data te verwijderen. |
| P2 | [#70](https://github.com/shownoise/tabletop-upgraded-2/issues/70) | Vier-browser end-to-end test bewijst fase, mandaat, keuze, score, rapport en refresh in één wegwerpevent. |

Pak P0 en P1 niet als cosmetische fixes op: de fase is nu in meerdere velden
vertegenwoordigd (`roundPhase` en `activeRoundPhaseState`) en de twee
facilitatorbedieningen kunnen verschillende routes kiezen. Centraliseer eerst
de servertransitie en laat de UI uitsluitend die transitie aanroepen.

### 2. Daarna: maak het platform geschikt voor echte events

| Volgorde | Ticket | Klaar wanneer |
| --- | --- | --- |
| P3 | [#71](https://github.com/shownoise/tabletop-upgraded-2/issues/71) | Ontwerp voor datastore, realtime, idempotentie, retentie en veilige migratie is goedgekeurd; dit is vóór elke datamigratie. |
| P4 | [#72](https://github.com/shownoise/tabletop-upgraded-2/issues/72) | Een read-only presenter/observer-view volgt dezelfde eventstate zonder vertrouwelijke facilitator- of deelnemerdata. |
| P5 | [#73](https://github.com/shownoise/tabletop-upgraded-2/issues/73) | Teksten, talen en runtime-overrides werken werkelijk in alle views en zijn versioneerbaar. |
| P6 | [#74](https://github.com/shownoise/tabletop-upgraded-2/issues/74) | CI heeft werkende quality gates en de auth-route volgt de huidige Next.js-conventie. |

Ticket #71 is bewust een ontwerp- en migratiepoort. Huidige sessieopslag en
realtime zijn overgangstechniek; verander geen bestaande sessies of scenario's
zonder export, backfill, rollback en expliciete goedkeuring.

## Wat bewust geen nieuw ticket is

- **AI-wizard basisstabiliteit** is geen blokker meer. Recente wijzigingen
  #64–#69 dekken gescoorde keuzes, gerichte herstelpogingen en duidelijke
  waarschuwingen. Nieuwe AI-problemen moeten met invoer, route-response en
  gevalideerd concept als concrete bug worden aangemaakt.
- **Featureverwijdering** gebeurt niet op naam. Gebruik #60 om onderdelen in
  Partner Event uit te schakelen; verwijder pas later na aantoonbaar ontbreken
  van gebruik en controle van git-log/blame.
- **Scenariotekst, prompts, scoringsbetekenis en rapportontwerp** blijven bij
  de producteigenaar. Externe developers bouwen het platform eromheen.

## Waar Claude Code moet beginnen

1. Lees `AGENTS.md`, daarna `CONTEXT.md`, `.claude/rules/codebase-map.md` en
   `.claude/rules/patterns.md`.
2. Pak één ticket per branch. Werk nooit direct op `main`; squash-merge na
   groene CI.
3. Voor de Event-kern: begin bij `lib/session-store.ts`,
   `app/api/session/set-phase/route.ts`,
   `components/admin/control-dashboard.tsx` en
   `components/participant/play-view.tsx`.
4. Test minimaal `npm test -- --run`, `npx tsc --noEmit` en
   `npx next build --webpack`; doe bij P0–P2 ook de browseracceptatie van
   #70.
5. Gebruik wegwerpdata voor live tests. Download of commit nooit productie-
   geheimen, sessies of persoonsgegevens.

## Productgrens voor Partner Event

De kern blijft: **inject → overleg → keuze → scoretrade-off → volgende
ronde**. Een optie met nul op alle dimensies heeft geen score-invloed. Elke
andere optie heeft een expliciete vector voor containment, forensiek,
bedrijfscontinuïteit, juridisch, verantwoording en kosten. Als de eigenaar van
een rol ontbreekt, krijgt de toegewezen deelnemer die keuze met een expliciete
mandaatwissel.
