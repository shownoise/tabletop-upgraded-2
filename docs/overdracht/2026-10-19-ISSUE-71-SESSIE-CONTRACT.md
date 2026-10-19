# Sessie- en realtimecontract — ontwerp voor issue #71

**Status: ONTWERP. Geen code, geen migratie uitgevoerd.**
Dit document is de poort die issue #71 vraagt ("Eerst opleveren — geen
migratiecode zonder dit"). Er is in deze ronde niets aan runtime-code
gewijzigd; `lib/session-store.ts` en `lib/db.ts` zijn ongemoeid.

Leesvolgorde: deel 1 (wat er echt staat) → deel 2 (wat breekt) → deel 3 t/m 5
(het doelcontract) → deel 6 (uitrol). Deel 1 bevat correcties op
`docs/overdracht/architectuur.md` en `docs/overdracht/bekende-bugs.md`; waar de
code de documentatie tegenspreekt, wint de code.

---

## Deel 1 — Feitelijke inventarisatie

### 1.1 Hoe is een sessie vandaag gesleuteld?

Eén vaste, globale sleutel. Geen sessie-id in de sleutel.

`lib/db.ts:25-30`

```ts
const KEYS = {
  session: "ctt:session",
  templates: "ctt:templates",
  users: "ctt:users",
  graphIndex: "scenario-graph-index",
} as const
```

`dbGetSession()` en `dbSetSession()` nemen **geen** parameter
(`lib/db.ts:90`, `lib/db.ts:98`). Alle lees- en schrijfacties gaan naar
`ctt:session`. De TTL is 24 uur:

```ts
await kv.set(KEYS.session, session, { ex: 60 * 60 * 24 }) // 24h TTL
```

`SessionState.id` bestaat wél (`lib/types.ts:623`, `genId("ses")`), maar wordt
nergens als opslagsleutel of routeparameter gebruikt. Hij is puur een label in
de blob.

### 1.2 Wat betekent "één actieve sessie" precies?

Sterker dan "er is maar één sessie zichtbaar". Concreet:

| Gevolg | Bewijs |
|---|---|
| Een tweede `createSession()` **overschrijft** de eerste zonder waarschuwing | `lib/session-store.ts:516` — `await dbSetSession(session)`, geen bestaanscheck |
| Twee facilitators op productie delen één state | er is geen eigenaarsveld; `getSession()` geeft iedereen dezelfde blob |
| De joincode is niet uniek per sessie, hij is het enige onderscheid dat er is | `joinSession` vergelijkt `session.joinCode` met de ingevoerde code (`lib/session-store.ts:745`) |
| Elke sessie verdampt na 24 uur, ook onafgerond | de `ex`-TTL hierboven |
| Elke API-route is impliciet "de ene sessie" | geen enkele route onder `app/api/session/` neemt een sessie-id uit pad of body |

Dit is geen ontbrekende feature maar een isolatiedefect: acceptatiecriterium
"twee gelijktijdige events kunnen elkaars state niet bereiken" is vandaag niet
alleen onwaar, het is structureel onhaalbaar zonder herkeying.

### 1.3 Waar muteert state — en wat zit er binnen een lock?

Er is een lock (`withSessionLock`, `lib/db.ts:136`), maar vrijwel geen mutatie
gebruikt hem. Van de 30 schrijfplekken in `lib/session-store.ts` zitten er
**2** binnen `withSessionLock` en **28** erbuiten.

Binnen de lock:

- `mutate()` (`lib/session-store.ts:559-575`)
- `settleAndGetState()` (`lib/session-store.ts:459-471`)

Buiten de lock — rauwe `dbGetSession()` → muteren → `dbSetSession()`, onder
andere:

| Functie | Regel | Waarom het erg is |
|---|---|---|
| `createSession` | 516 | overschrijft een lopende sessie |
| `joinSession` | 759 | twee gelijktijdige joins → één deelnemer verdwijnt (lost update) |
| `startSession` → via `mutate` | — | wél gelockt |
| `goToNextRound` | 1078, 1084, 1090, 1113, 1122 | **vijf** schrijfplekken in één functie |
| `endSessionForced` | 1137 | |
| `goToPrevRound` | 1155 | |
| `pushInject` | 1189 | |
| `submitDecision` | 1696 | de kernactie van het hele product |
| `facilitatorPickGraphOption` | 2332 | |
| `facilitatorSkipDecision` | 2294 | |
| `fileMelding` | 2250, 2259 | |
| `tagInject` / `addAnnotation` / `removeAnnotation` | 972, 1004, 1023 | |

Het ergste samenspel: `settleAndGetState()` **is** gelockt en **schrijft**, en
hij wordt aangeroepen door het poll-endpoint (`app/api/session/state/route.ts:13`)
dat elke client elke 2 seconden raakt. Een poll die de lock pakt en een
fase-tick wegschrijft, kan een gelijktijdige ongelockte `submitDecision`
overschrijven — en omgekeerd. Met 10 deelnemers zijn dat 5 lock-acquisities per
seconde tegen een lock met 5 s TTL en precies twee pogingen
(`lib/db.ts:150-155`), daarna `throw new Error("Session busy")`.

### 1.4 Wat is al idempotent, en wat niet?

**Wel** — `submitDecision` dedupliceert op natuurlijke sleutel
(`lib/session-store.ts:1537-1547`): bestaande rijen met dezelfde
`(participantId, roundIndex, role)` worden eruit gefilterd en vervangen, in
EVENT-mode aangevuld met `(groupId, roundIndex, actionId)`. Een dubbelklik
produceert dus geen tweede *rij*.

**Niet** — de bijwerkingen van diezelfde submit zijn niet idempotent. Bij een
tweede submit van dezelfde keuze:

- `action.pushesInject` maakt een nieuwe inject met `genId("resp")`
  (`lib/session-store.ts:1644`) en appendt die: **twee** antwoordinjects.
- `graphState.branchLog` krijgt een **tweede** entry
  (`lib/session-store.ts:1683`).
- `triggerEngine(updated, { kind: "decision_made" })`
  (`lib/session-store.ts:1676`) loopt een tweede keer — de graph kan twee keer
  doorstappen.
- De automatische fase-overgang `decision → review`
  (`lib/session-store.ts:1629-1639`) wordt opnieuw geëvalueerd.

Dat is precies wat acceptatiecriterium "refresh/reconnect dupliceert nooit een
keuze of een fase-overgang" verbiedt.

Verder: **geen** client-geleverde idempotency key, request-id, nonce of
`If-Match` in de hele codebase. En `SessionState.version`
(`lib/types.ts`, commentaar "Monotonically increasing revision — bumped on
every persisted mutation") wordt op **twee** plekken geschreven
(`lib/session-store.ts:465` en `:570`) en **nergens gelezen** voor
conflictdetectie — niet in een route, niet in de clienthook. Het veld is
decoratief, en omdat de 28 ongelockte writes hem niet bumpen is hij ook niet
monotoon.

### 1.5 Waar wordt autorisatie gehandhaafd — en waar niet?

Facilitatorroutes gebruiken `requireFacilitator()` (`lib/auth-guard.ts`), dat
NextAuth-rol `admin|facilitator` eist. Dat werkt.

Deze muterende routes hebben **geen** auth-guard en **geen** verificatie van
deelnemersidentiteit:

```
app/api/session/join/route.ts
app/api/session/submit-decision/route.ts
app/api/session/ready/route.ts
app/api/session/melding/route.ts
app/api/session/regulatory-filing/route.ts
app/api/session/participant-view/route.ts
app/api/session/tag-inject/route.ts
app/api/session/annotate-inject/route.ts
app/api/session/annotate-inject/remove/route.ts
app/api/session/group/create/route.ts
app/api/session/group/join/route.ts
app/api/session/special/form/route.ts
app/api/session/special/message/route.ts
```

Dat deelnemers geen account hebben is een legitieme keuze. Het probleem is dat
er ook geen *bearer* is: identiteit is een `participantId` uit `localStorage`
(`lib/use-session-stream.ts:32-35`) die als **querystring** meegaat:

```ts
const qs = participantId ? `?participantId=${encodeURIComponent(participantId)}` : ""
```

De server vertrouwt die waarde ongecontroleerd — zowel in de SSE-route
(`app/api/events/route.ts:36-37`) als in het poll-endpoint
(`app/api/session/state/route.ts:17-19`). Wie een `participantId` kent, is die
deelnemer. Ids zijn `p_` + 12 hex (48 bit, niet te brute-forcen), maar ze staan
in URL's en dus in logs en proxies.

Rolscheiding presenter/facilitator bestaat niet op serverniveau:
`app/api/events/route.ts:12` en `app/api/session/state/route.ts:10` doen beide

```ts
const isAdmin = !!session?.user
```

Elke ingelogde gebruiker krijgt de **volledige** facilitatorstate, inclusief
`toParticipantState`-gestripte velden. Een presenter/observer op het grote
scherm is dus of een volledige facilitator of een deelnemer; er is geen derde,
read-only projectie met eigen autorisatie. (Issue #72 raakt dit; het contract
hieronder maakt het expliciet.)

### 1.6 Realtime: wat er echt staat

| Wat `architectuur.md` zegt | Wat de code doet |
|---|---|
| "`/api/session/state` (SSE stream) opent een SSE-stream per client" | **Onjuist.** `app/api/session/state/route.ts` is een gewone JSON-`GET` (`NextResponse.json`). De SSE-stream staat in `app/api/events/route.ts`. |
| "polt óók elke 4 seconden" | **Onjuist.** `lib/use-session-stream.ts:90` — `}, 2000)`. |
| "de view filtert facilitator-only velden client-side via `toParticipantState`" | **Onjuist.** `toParticipantState` draait server-side, in beide routes. |
| "41 routes" | 46 route-bestanden onder `app/api/`. |

De echte opzet:

- `app/api/events/route.ts` — SSE. Abonneert op een **in-process** `Set`
  (`lib/session-store.ts:70-74`, `globalThis.__ctt_listeners__`). Heartbeat elke
  15 s. Geen `Last-Event-ID`, geen sequencenummer, geen replay-cursor.
- `broadcastState()` (`lib/session-store.ts:88`) loopt over die lokale `Set`.
  Op Vercel Fluid Compute betekent dat: een mutatie op instance A bereikt
  abonnees op instance B **nooit**.
- Daarom polt elke client elke 2 s `/api/session/state`, en dat endpoint
  roept `settleAndGetState()` aan — dus de poll **schrijft**.

Netto: polling is vandaag de bron van waarheid en de SSE-stream is een
optimistische versnelling. Dat is de omgekeerde verhouding van wat het
herbouwplan voorschrijft. Daarbij: een functie-invocatie op Vercel heeft een
`maxDuration` van standaard 300 s op alle plannen, dus de SSE-stream wordt in
een event van 90 minuten minstens ~18 keer geforceerd afgebroken en opnieuw
opgezet — elke keer met een volledige state-dump zonder cursor.

### 1.7 Wat is persistent, wat verdwijnt?

| Data | Sleutel | Overleeft cold start? | Overleeft 24 u? |
|---|---|---|---|
| Sessie-state | `ctt:session` | ja, met KV | **nee** (TTL) |
| SSE-abonnees | `globalThis.__ctt_listeners__` | nee | n.v.t. |
| In-memory fallback | `globalThis.__ctt_mem__` | nee | nee |
| Scenario-graphs | `scenario-graph:<id>` + `scenario-graph-index` | ja | ja |
| Sessie-archief | `admin:sessions-archive` (**één** key) | ja | ja |
| Templates | `ctt:templates` (één array) | ja | ja |
| Facilitators | `ctt:users` (één array) | ja | ja |

Zonder `KV_URL`/`KV_REST_API_URL` valt alles terug op in-memory
(`lib/db.ts:40-41`) — ook in productie, stil, met alleen een `console.error`
als het pakket niet laadt (`lib/db.ts:50`).

Belangrijk: het archief wordt **alleen** geschreven in `resetSession()`
(`lib/session-store.ts:521-538`). Gebeurt die reset niet, dan loopt de 24-uurs
TTL af en is de sessie weg — nooit gearchiveerd, geen rapport.

### 1.8 Twee fase-machines die niet dezelfde zijn

`lib/scoring/event-mode.ts:12-21` definieert een complete, geteste machine:

```ts
export type EventModePhase = 'briefing' | 'overleg' | 'keuze' | 'lock' | 'review'
const VALID_TRANSITIONS: Record<EventModePhase, EventModePhase[]> = { ... }
export function isValidTransition(from, to) { ... }
```

met `canForceLock` en `computeImplicitSubmissionsAtLock`. De runtime gebruikt
deze functies **niet**: `isValidTransition` wordt alleen opnieuw geëxporteerd
in `lib/scoring/index.ts:33` en nergens aangeroepen.

Wat de runtime wél gebruikt is `lib/engine/round-phases.ts`:

```ts
export const PHASE_ORDER: readonly RoundPhase[] = ['inject', 'discussion', 'decision', 'review'] as const
```

Dus: andere namen, **vier** in plaats van vijf fasen, en geen
transitievalidatie. De `lock`-fase — het enige moment waarop "hierna verandert
er niets meer aan deze ronde" afdwingbaar is — bestaat in de runtime niet. Er
is een gevalideerde state machine aanwezig en hij staat buiten de stroom.

### 1.9 Platformrisico in de huidige stack

`lib/db.ts` importeert `@vercel/kv`. Dat pakket is als first-party
Vercel-product **uitgefaseerd**; duurzame opslag loopt nu via
Marketplace-integraties (Neon Postgres, Upstash Redis). Hetzelfde geldt voor
`@vercel/postgres`. Dit is geen acute storing, maar het betekent dat de huidige
opslaglaag op een doodlopend pakket staat en dat elke "we laten KV zoals het
is"-optie een aflopende houdbaarheid heeft.

---

## Deel 2 — Wat breekt

Per bestaand artefact: wat kapot gaat, en hoe het gemigreerd of leesbaar
gehouden wordt. Dit is de sectie waar goedkeuring op moet.

### 2.1 Opgeslagen scenario's (`scenario-graph:<id>`)

**Wat er is.** `ScenarioGraph` (`lib/graph/types.ts:295`) met `version: number`,
`createdAt`, `updatedAt` en `publishStatus?: 'draft' | 'published'`.
Opgeslagen op `scenario-graph:<id>`, plus een array-index op
`scenario-graph-index`.

**Wat breekt:**

1. **Er is geen versiehistorie om te migreren.** `dbSaveScenarioGraph`
   (`lib/db.ts:259`) doet `kv.set(graphKey(graph.id), graph)` — elke save
   **overschrijft** de vorige. `version: number` is een auteursveld, niet een
   monotone opslagversie. Bij invoering van immutable versies is de huidige rij
   dus "versie N van onbekende N"; alle eerdere inhoud is al weg.
2. **De publish-gate gaat lopende praktijk blokkeren.** `publishStatus` wordt
   gezet door de wizard (`lib/wizard/pipeline.ts:492`, altijd `'draft'`) en door
   `legacy-template-migration.ts:125` (`'draft'`), maar **nergens afgedwongen**:
   grep vindt geen enkele controle vóór `createSession`. Er draaien dus
   vermoedelijk sessies op `draft`-graphs. Zodra publiceren verplicht wordt,
   starten die niet meer.
3. **De index kan al gaten hebben.** `dbSaveScenarioGraph` doet twee
   ongecoördineerde writes (graph, dan index). Een gefaalde tweede write geeft
   een graph die bestaat maar niet in `dbListScenarioGraphs()` opduikt.

**Migratie.** Importer, geen in-place verandering. Per KV-graph één
`scenario`-rij plus één `scenario_version`-rij met
`version = graph.version ?? 1`, `graph` verbatim in `jsonb`, `content_hash` over
de gecanoniseerde JSON, en `graph_schema_version = 1`. De originele KV-key
blijft staan en wordt niet aangeraakt.

**Aanname die de eigenaar moet bevestigen:** graphs met
`publishStatus !== 'published'` die al in een gedraaide sessie voorkomen,
importeren we als `published` (anders breekt herhaalbaarheid van bestaande
events), met een vlag `needs_owner_review = true`. Alternatief is ze als draft
importeren en de eigenaar laat ze één keer handmatig publiceren. Dit is een
inhoudelijke keuze, geen implementatiekeuze.

**Rollback.** Neon-rijen verwijderen. KV blijft gezaghebbend tot fase 7.

### 2.2 Lopende sessies (`ctt:session`)

Dit is het gevaarlijkste artefact, en de eerlijke conclusie is: **niet
migreren**.

**Wat breekt:**

1. **Een sessie in de lucht is niet overzetbaar.** Het nieuwe model leidt state
   af uit een append-only event log. Die log bestaat retroactief niet.
   `SessionState.timeline` lijkt een log maar is er geen: hij is afgekapt op
   2000 entries (`MAX_TIMELINE`, `lib/session-store.ts:541`, met
   `.slice(-MAX_TIMELINE)` — oudste entries worden weggegooid) en bevat
   weergave-events, niet de commando's die tot de state leidden. Een replay is
   niet reconstrueerbaar.
2. **`version` is onbruikbaar als startrevisie.** 28 van 30 writes bumpen hem
   niet (§1.3), dus hij is niet monotoon en zegt niets over hoeveel mutaties er
   zijn geweest.
3. **Pre-existente dataverlies-bug, geen migratiebreuk.** Door de 24-uurs TTL
   is elke sessie ouder dan een dag nu al onherroepelijk weg, ongearchiveerd.
   Dat is vandaag waar en wordt door de migratie niet slechter — maar het
   betekent dat er geen historische sessievoorraad is om over te zetten.

**Migratie.** Cutover-regel, hard: de nieuwe engine geldt **alleen** voor
sessies die ná het omzetten van de feature flag zijn aangemaakt. Een event dat
op het moment van cutover loopt, maakt af op de oude engine. Geen replay, geen
dubbel draaien.

Als een harde cutover onvermijdelijk is terwijl er een sessie leeft: die sessie
eerst afsluiten en als `report_snapshot` dichtzetten (§3.3), daarna op v2
opnieuw vanaf de lobby starten. Dat is deelnemersverlies van de lopende ronde
en moet vooraf met de facilitator worden afgesproken — niet achteraf gemeld.

**Rollback.** Flag terug; `ctt:session` is nooit aangeraakt.

### 2.3 Oude rapporten (`admin:sessions-archive` + `/api/session/report`)

**Wat er is.** `lib/admin/sessions-archive.ts` schrijft `SessionSnapshot` —
metadata plus `snapshot: SessionState`, de volledige blob, met in de code zelf
de schatting "~100KB". Alles in **één** KV-key: `const KEY = "admin:sessions-archive"`,
als `Record<sessionId, SessionSnapshot>`.

**Wat breekt — en deels al gebroken is:**

1. **Het archief loopt tegen een harde grens.** Eén key met ~100 KB per sessie,
   tegen een waardelimiet in de orde van 1 MB op de gangbare KV/Upstash-tier:
   na ruwweg tien gearchiveerde sessies faalt de write of kapt hij af. Er is
   geen foutpad: `upsertSnapshot` doet `await kv.set(KEY, next)` zonder
   grootte- of resultaatcontrole, en de aanroeper vangt alles weg met
   `console.warn("[session-archive] snapshot failed:")`
   (`lib/session-store.ts:532`). Archiveren kan dus stil mislukken.
2. **Gelijktijdig archiveren verliest een snapshot.** `upsertSnapshot` is een
   read-modify-write **zonder lock** (eigen `getKv()`, niet
   `withSessionLock`). Twee resets tegelijk → één snapshot weg.
3. **Het rapport is geen snapshot maar een live projectie.**
   `app/api/session/report/route.ts` doet `getSession()`, eist
   `session.status !== "ended"` → 400, en `!session` → 404. Het leest **niet**
   uit het archief. Omdat `resetSession()` juist het moment is dat archiveert én
   `ctt:session` op `null` zet, is het rapport alleen bereikbaar in het venster
   tussen "ended" en "reset". Daarna 404 — terwijl de data in het archief staat.
4. **Oude rapporten bewegen mee met de code.** De cijfers worden bij elke
   GET herberekend uit `lib/scoring/` en `scoreCoverage(...)`. Een wijziging in
   een scoringsformule herschrijft dus retroactief een rapport dat een klant al
   gezien heeft. `SCORING_VERSION = '1.0.0'`
   (`lib/scoring/constants.ts:3`) bestaat met expliciete semver-afspraak
   ("major = dimension added/removed"), maar wordt niet in de snapshot gestempeld.

**Migratie.** Backfill per `SessionSnapshot` naar `report_snapshot`:
het rapport éénmalig berekenen met de huidige code, de **uitkomst** opslaan in
`payload jsonb`, `scoring_version = '1.0.0'` stempelen, en de rauwe
`SessionState` meeslepen in `legacy_session_state jsonb` zodat niets verdwijnt.
`/admin/report/[sessionId]` leest daarna eerst de snapshot. Oude rapporten
worden read-only en bevriezen.

**Aanname:** `scoring_version` van historische sessies zetten we op `'1.0.0'`,
de waarde die op archiveermoment gold. Als er eerder een andere formule liep, is
dat niet meer vast te stellen — expliciet vastleggen in het snapshotrecord als
`scoring_version_inferred = true`.

**Rollback.** KV-key onaangeroerd; snapshot-rijen weggooien.

### 2.4 Templates en facilitator-accounts

`ctt:templates` en `ctt:users` zijn enkele JSON-arrays met dezelfde
lost-update-structuur (`dbSaveUser`, `dbSaveTemplate`: lees array, muteer,
schrijf array). Omzetten naar rijen is mechanisch en risicoarm.
`dbCreateUserIfEmailFree` gebruikt al een `SET NX`-reservering
(`lib/db.ts:243`) — in Postgres wordt dat een `unique` index op `lower(email)`.
Let op: `dbEnsureAdminUser` weigert in productie te seeden met het historische
default-wachtwoord (`lib/db.ts:314`); dat gedrag moet behouden blijven.

### 2.5 Wat níet breekt

- De zes scoringsdimensies (`OUTCOME_DIMENSIONS = ['CONT','FOR','BC','JUR','VER','KOS']`,
  `lib/scoring/constants.ts:6`) zijn pure data op opties in de graph. Geen
  opslagafhankelijkheid.
- `lib/scoring/` is I/O-vrij en blijft ongewijzigd.
- `toParticipantState()` blijft de projectiefunctie; alleen de aanroeper
  verandert.
- `migrateLegacyRole` (`lib/session-store.ts:41`, `system_admin → it_manager`)
  moet mee naar de importer, niet weg.

---

## Deel 3 — Datamodel: drie gescheiden artefacten

Het herbouwplan vraagt dit al ("Scheid content van runtime"); hier staan de
velden. Postgres-dialect, `jsonb` voor de domeinblobs die al bestaan.

### 3.1 Immutable gepubliceerde scenarioversie

```sql
CREATE TABLE scenario (
  id              uuid PRIMARY KEY,
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  owner_user_id   uuid REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scenario_version (
  id                   uuid PRIMARY KEY,
  scenario_id          uuid NOT NULL REFERENCES scenario(id),
  version              integer NOT NULL,
  publish_status       text NOT NULL CHECK (publish_status IN ('draft','published','archived')),
  graph                jsonb NOT NULL,          -- ScenarioGraph, verbatim
  graph_schema_version integer NOT NULL,        -- contract van de jsonb zelf
  scoring_version      text NOT NULL,           -- SCORING_VERSION bij publiceren
  content_hash         text NOT NULL,           -- sha256 over gecanoniseerde graph
  wizard_seed          text,
  needs_owner_review   boolean NOT NULL DEFAULT false,
  published_at         timestamptz,
  published_by         uuid REFERENCES app_user(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, version)
);
```

Invarianten, af te dwingen met een trigger en niet alleen met discipline:

- Een rij met `publish_status = 'published'` wordt **nooit** ge-`UPDATE`d, op
  `publish_status → 'archived'` na. Wijzigen betekent een nieuwe rij met
  `version + 1`.
- `content_hash` is onveranderlijk zodra gepubliceerd. Mismatch bij uitlezen is
  een incident, geen waarschuwing.
- `graph_schema_version` is losgekoppeld van `version`: het eerste beschrijft
  het *contract* van de jsonb, het tweede de redactionele versie van de
  scenario-inhoud. Die twee verwarren is de klassieke manier om een migratie
  onomkeerbaar te maken.

### 3.2 Mutabele eventstate

```sql
CREATE TABLE event_session (
  id                  uuid PRIMARY KEY,
  scenario_version_id uuid NOT NULL REFERENCES scenario_version(id),  -- POINTER, geen copy
  facilitator_user_id uuid NOT NULL REFERENCES app_user(id),
  client_id           uuid REFERENCES admin_client(id),
  join_code           text NOT NULL,
  mode                text NOT NULL CHECK (mode IN ('training','event')),
  status              text NOT NULL CHECK (status IN ('lobby','active','ended','abandoned')),
  revision            bigint NOT NULL DEFAULT 0,
  current_round       integer NOT NULL DEFAULT -1,
  current_phase       text,
  phase_started_at    timestamptz,
  phase_deadline_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  ended_at            timestamptz,
  retention_until     date NOT NULL
);

-- Joincode is uniek onder de levende sessies, niet globaal en voor altijd.
CREATE UNIQUE INDEX event_session_join_code_live
  ON event_session (join_code) WHERE status IN ('lobby','active');

CREATE TABLE event_participant (
  id             uuid PRIMARY KEY,
  session_id     uuid NOT NULL REFERENCES event_session(id) ON DELETE CASCADE,
  display_name   text NOT NULL,
  role           text,
  group_id       uuid,
  token_hash     text NOT NULL,       -- sha256 van de bearer; token zelf nooit opgeslagen
  is_notetaker   boolean NOT NULL DEFAULT false,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON event_participant (session_id);
```

De **bron van waarheid** is de log, niet de projectie:

```sql
CREATE TABLE event_log (
  session_id       uuid NOT NULL REFERENCES event_session(id) ON DELETE CASCADE,
  seq              bigint NOT NULL,          -- per sessie monotoon, 1,2,3,...
  type             text NOT NULL,
  actor_kind       text NOT NULL CHECK (actor_kind IN ('facilitator','participant','presenter','system')),
  actor_id         uuid,
  payload          jsonb NOT NULL,
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq),
  UNIQUE (session_id, idempotency_key)
);

-- Gematerialiseerde huidige state: een cache van de log, altijd herbouwbaar.
CREATE TABLE event_projection (
  session_id  uuid PRIMARY KEY REFERENCES event_session(id) ON DELETE CASCADE,
  revision    bigint NOT NULL,        -- == max(seq)
  state       jsonb NOT NULL,         -- vorm van het huidige SessionState
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

`state jsonb` mag in fase 3 letterlijk de huidige `SessionState`-vorm houden,
minus `scenario`/`graph` (die komen via `scenario_version_id`). Dat scheelt de
grootste herschrijving en houdt `toParticipantState()` en heel `lib/scoring/`
onaangeraakt.

De `UNIQUE (session_id, idempotency_key)` is het hele idempotentiemechanisme.
Geen applicatielogica, een constraint.

### 3.3 Afgesloten rapport-snapshot

```sql
CREATE TABLE report_snapshot (
  id                       uuid PRIMARY KEY,
  session_id               uuid NOT NULL REFERENCES event_session(id),
  scenario_version_id      uuid NOT NULL REFERENCES scenario_version(id),
  sealed_at                timestamptz NOT NULL,
  sealed_by                uuid REFERENCES app_user(id),
  scoring_version          text NOT NULL,
  scoring_version_inferred boolean NOT NULL DEFAULT false,
  schema_version           integer NOT NULL,
  payload                  jsonb NOT NULL,   -- volledig zelfdragend rapport
  legacy_session_state     jsonb,            -- alleen bij backfill uit KV
  content_hash             text NOT NULL,
  pii_minimised_at         timestamptz,
  retention_until          date NOT NULL,
  UNIQUE (session_id)
);
```

`payload` is **zelfdragend**: de berekende cijfers, de keuzes met labels, de
outcome-vectoren en de scenariotitel staan erin. Het rapport mag niet opnieuw
door `lib/scoring/` hoeven. Dat is de enige manier om "oude sessies blijven
leesbaar" waar te maken terwijl de formules doorontwikkelen.

Sealen gebeurt in dezelfde transactie als `status → 'ended'`. Niet bij reset —
dat is de huidige fout.

---

## Deel 4 — Één server-side state machine

### 4.1 Fasen en transities

Ik stel voor de **runtime-namen** aan te houden
(`inject | discussion | decision | review`, `lib/engine/round-phases.ts`) en
daar **`lock`** aan toe te voegen, omdat dat de enige fase is die
"na dit moment verandert deze ronde niet meer" afdwingbaar maakt en omdat
`computeImplicitSubmissionsAtLock` al bestaat. De Nederlandse labels uit
`event-mode.ts` worden presentatie, geen tweede machine.

| Van | Commando | Naar | Wie mag | Guard |
|---|---|---|---|---|
| — | `create_session` | `lobby` | facilitator | `scenario_version.publish_status = 'published'` |
| `lobby` | `join` | `lobby` | deelnemer | joincode klopt, status `lobby` of `active` |
| `lobby` | `start_session` | `active` / r0 `inject` | facilitator | ≥1 deelnemer, ronde bestaat |
| `inject` | `advance_phase` | `discussion` | facilitator | — |
| `inject` | `phase_timeout` | `discussion` | system | `now ≥ phase_deadline_at` |
| `discussion` | `advance_phase` | `decision` | facilitator | — |
| `decision` | `submit_decision` | `decision` | deelnemer | fase = `decision`, rol mag de actie |
| `decision` | `advance_phase` | `lock` | facilitator | — |
| `decision` | `all_submitted` | `lock` | system | `missingDecisionRoles() = ∅` |
| `lock` | `advance_phase` | `review` | facilitator | — |
| `review` | `next_round` | r+1 `inject` | facilitator | volgende ronde bestaat |
| `review` | `end_session` | `ended` | facilitator | — |
| elke | `force_end` | `ended` | facilitator | — |
| `ended` | — | — | — | terminaal; `report_snapshot` is gezegeld |

Harde regels:

- **`lock` is onomkeerbaar** voor de submissies van die ronde. `submit_decision`
  in `lock` of `review` wordt `409`, niet stil genegeerd.
- `prev_round` bestaat als facilitatorcorrectie, maar schrijft een
  **compenserend** event (`round_reopened`) en verwijdert niets. De log blijft
  append-only; een correctie is zichtbaar.
- Niemand buiten deze tabel muteert. Eén module, de drie clients roepen hem
  aan. Dit is exact wat vandaag niet zo is: `submitDecision` voert nu zelf een
  `decision → review`-overgang uit (`lib/session-store.ts:1629`) — een
  deelnemer verricht een fase-transitie via een ongelockte write. In het nieuwe
  contract is dat het `all_submitted`-commando van `actor_kind = 'system'`, met
  een vaste idempotency key, dus precies één keer.

### 4.2 Idempotentie

Elke muterende aanroep draagt `Idempotency-Key`. De client genereert hem per
**gebruikersgebaar** (één klik = één key, een retry hergebruikt hem) — uuidv7,
zodat hij ook sorteerbaar is.

```
POST /api/v2/sessions/{sessionId}/commands
  Idempotency-Key: 018f3e...       (verplicht)
  If-Match: 417                    (optioneel, alleen facilitator)
  { "type": "advance_phase", "payload": { ... } }
```

Serverzijde, één transactie:

1. `INSERT INTO event_log (...) ON CONFLICT (session_id, idempotency_key) DO NOTHING`
2. Geen rij ingevoegd → replay. Lees het bestaande event, geef `200` met
   `{ replayed: true, revision }` en de huidige projectie.
3. Wel ingevoegd → guard evalueren, projectie bijwerken,
   `event_session.revision = seq`.

Systeemtransities krijgen een **deterministische** key, geen random waarde:

```
auto:{session_id}:{round}:{phase}:timeout
auto:{session_id}:{round}:all_submitted
```

Daardoor kunnen tien gelijktijdige pollers de fase-timeout tegelijk opmerken en
leidt dat tot precies één transitie — de `UNIQUE`-constraint beslist. Dit
vervangt zowel de 5-seconden KV-lock als de schrijvende poll uit §1.3.

### 4.3 Revisie en ordening

- `event_log.seq` is per sessie monotoon, toegekend binnen de transactie
  (`SELECT coalesce(max(seq),0)+1 ... FOR UPDATE` op de `event_session`-rij, of
  een per-sessie sequence). Eén schrijver per sessie tegelijk, gegarandeerd door
  rij-niveau locking — geen globale lock meer, dus **geen** kruisbesmetting
  tussen gelijktijdige events.
- `event_session.revision` spiegelt `max(seq)` en is wat clients zien.
- Elke response en elk streamframe draagt `revision`. Clients negeren frames
  met `revision ≤` wat ze al hebben. Dat is het ontbrekende stukje van vandaag:
  `version` bestaat maar wordt nooit vergeleken (§1.4), dus een laat
  aankomende stale poll kan een nieuwere SSE-state overschrijven.
- Facilitatorcommando's mogen `If-Match: <revision>` sturen. Mismatch → `409`
  met de huidige state, zodat het dashboard niet blind een fase overschrijft die
  iemand anders net heeft gezet.
- Deelnemerssubmissies gebruiken **geen** `If-Match`: ze zijn commutatief via
  de natuurlijke sleutel `(participant, round, role)` plus idempotency key.
  Een deelnemer hoort nooit een conflict te zien.

### 4.4 Autorisatie per actor

Drie actoren, drie tokens, drie projecties. Server-side, per commando.

| | facilitator | notulist | deelnemer | presenter |
|---|---|---|---|---|
| **Identiteit** | NextAuth-sessie + eigenaar van `event_session` | deelnemer met `is_notetaker` | bearer-token, gehashed in `event_participant` | sessie-scoped presenter-token |
| Sessie aanmaken / starten | ja | nee | nee | nee |
| Fase wisselen, `lock`, `next_round`, `end` | ja | nee | nee | nee |
| Inject pushen, special triggeren | ja | nee | nee | nee |
| `submit_decision` | als correctie, gelogd als `actor_kind=facilitator` | ja (namens groep) | ja (eigen rol) | **nee** |
| Eigen view-state, annotaties, fact-checks | ja | ja | ja | nee |
| Volledige state incl. facilitator-velden | ja | nee | nee | **nee** |
| Deelnemersnamen | ja | ja | ja | **nee** (rol/groep) |
| Read-only live projectie | ja | ja | ja | ja |

Twee dingen die dit expliciet repareert:

1. **`isAdmin = !!session?.user` verdwijnt.** Toegang wordt getoetst tegen
   `event_session.facilitator_user_id`, niet tegen "is ingelogd". Een
   facilitator ziet alleen de eigen sessies. Dat is wat
   "geen data van een ander event of andere klant" vereist.
2. **De presenter krijgt een eigen token en een eigen projectie.** Geen
   facilitator-velden, geen persoonsnamen. De presenter kan niets muteren —
   afgedwongen door `actor_kind`, niet door de UI.

Het ongeverifieerde `?participantId=` uit §1.5 vervalt: de deelnemer stuurt
`Authorization: Bearer <token>`, de server zoekt `token_hash` op en leidt
`participant_id` **zelf** af. Een id in een querystring kan dan niemand meer
imiteren.

### 4.5 Reconnect, presence, timeout, conflict

**Reconnect.** De stream wordt cursor-gebaseerd:

```
GET /api/v2/sessions/{id}/stream?since=417
Authorization: Bearer ...
```

De server stuurt eerst alle `event_log`-rijen met `seq > 417`, dan tailt hij.
Elk frame heeft `id: <seq>`, zodat de browser bij een herverbinding automatisch
`Last-Event-ID` meestuurt. Omdat `maxDuration` op Vercel een stream na ten
hoogste 300 s afbreekt, is dit geen edge case maar de normale gang van zaken:
een event van 90 minuten herverbindt ~18 keer per client en pikt dankzij de
cursor steeds precies op waar het was, zonder volledige state-dump.

Refresh is daarmee hetzelfde pad als reconnect: client leest
`revision` uit `localStorage`, vraagt `?since=`, krijgt het verschil. Een
herhaalde submit draagt dezelfde idempotency key en is een no-op. Dat is
acceptatiecriterium 2.

**Presence.** `event_participant.last_seen_at` wordt bijgewerkt door een
heartbeat van 10 s (de stream houdt hem bij; geen apart endpoint nodig).
`online` is een afgeleide: `last_seen_at > now() - 30s`. Presence staat
**niet** in de log — het is vluchtige data en zou de log vervuilen. Join en
leave staan er wel in.

**Timeout.** `phase_deadline_at` staat op de sessie en wordt server-side
berekend uit `phase_started_at` plus de duur uit
`computeRoundPhaseDurations()`. Clients tonen alleen. Verlopen wordt lazy
afgehandeld bij de eerstvolgende lees- of schrijfactie, via het
deterministische `auto:`-commando uit §4.2. Geen cron nodig, geen schrijvende
poll, en structureel precies één transitie.

**Conflict.** Drie soorten, drie antwoorden:

| Situatie | Antwoord |
|---|---|
| Dubbele submit (refresh, dubbelklik) | `200 { replayed: true }`, niets gebeurt |
| Facilitator stuurt stale `If-Match` | `409` + huidige state; dashboard hersynchroniseert |
| Submit na `lock` | `409 phase_locked`, met de reden in de body |
| Twee facilitators op één sessie | laatste `advance_phase` wint, maar beide staan in de log met actor |

### 4.6 Audit trail

De log *is* de audit trail; er is geen apart mechanisme nodig. Verplichte
types, direct toetsbaar tegen het acceptatiecriterium:

`session_created` · `session_started` · `participant_joined` ·
`participant_left` · `role_assigned` · `phase_advanced` ·
`phase_auto_advanced` · `decision_submitted` · `decision_revised` ·
`round_locked` · `round_reopened` · `inject_pushed` · `special_triggered` ·
`melding_filed` · `session_ended` · `report_sealed` · `report_exported`

Elk event heeft `actor_kind`, `actor_id`, `seq`, `created_at` en
`idempotency_key`. Een test die "start/join/transition/choice/lock/export" op
één sessie afloopt en daarna de log assert, is daarmee een gewone
integratietest op één tabel.

---

## Deel 5 — Datastore en realtime-adapter

### 5.1 Keuze: Neon Postgres (Vercel Marketplace), met cursor-SSE op de log

**Primair: Neon Postgres** als enige system of record, via
`vercel integration add neon` zodat `DATABASE_URL` automatisch wordt
geïnjecteerd. Driver `@neondatabase/serverless` (vereist Node 19+; het project
staat al op `runtime = "nodejs"`).

Waarom relationeel, en niet opnieuw een key-value store:

- Alles wat #71 vraagt is relationeel van vorm: een append-only log met
  **ordening per sessie**, een `UNIQUE`-constraint voor idempotentie, een
  foreign key van sessie naar onveranderlijke scenarioversie, en snapshots met
  een bewaartermijn. In Redis moet elk van die vier in applicatiecode — en dat
  is exact de klasse fouten die §1.3 en §2.3 laten zien.
- Isolatie tussen gelijktijdige events wordt een `WHERE session_id = $1` plus
  rij-niveau locking in plaats van één globale lock. Dat is het hele
  acceptatiecriterium "twee events kunnen elkaars state niet bereiken".
- Een enkele `UNIQUE (session_id, idempotency_key)` vervangt zowel de
  5-seconden KV-lock als de handgeschreven dedupe-filter van
  `lib/session-store.ts:1537`.
- De blob-plafonds verdwijnen: `event_log` groeit per rij, niet per key.
  Het archiefprobleem uit §2.3 kan niet terugkomen.
- Neon heeft branching, wat preview-deployments een eigen database geeft — dat
  maakt de vier-browser-acceptatietest van #70 reproduceerbaar zonder
  productiedata.

**Realtime-adapter: de log zelf, via cursor-SSE.** Geen extra vendor. De
stream uit §4.5 leest `event_log WHERE seq > $cursor` en tailt. De database is
het fan-out-punt, niet een in-process `Set` — en daarmee is het
multi-instance-probleem uit §1.6 bij de wortel weg, niet geplakt.

Dit is bewust géén websocket. Afweging, eerlijk opgeschreven:

| | cursor-SSE op Postgres | Upstash Redis pub/sub ernaast | Supabase Realtime |
|---|---|---|---|
| Extra vendor | geen | ja | ja (vervangt Neon) |
| Latency | ~0,5–1,5 s (tail-interval) | <100 ms | <100 ms |
| Ordening/replay | gratis, `seq` is de cursor | zelf bouwen | kanaal, geen replay |
| Faalpad | één systeem | twee systemen die kunnen divergeren | één systeem |
| Kosten bij 30 clients | 30 geïndexeerde queries/s | pub/sub + DB | inbegrepen |

Voor dit product is ~1 s zichtbaar genoeg: één zaal, 2–30 clients, fasen van
minuten. Sub-100 ms push kopen met een tweede bron van waarheid is de
verkeerde ruil zolang de eerste nog niet betrouwbaar is.

**Tweede keuze, met naam: Supabase** (Marketplace-native). Postgres plus
ingebouwde realtime en row-level security. Als latency later wél telt, of als
de read-only presenter per tafel echt sub-seconde moet zijn, is dat de
migratie — hetzelfde relationele model, dus geen datamodelbreuk, maar wel een
groter oppervlak (auth en storage schuiven mee) en een tweede verhuizing van
NextAuth. Daarom tweede, niet eerste.

Upstash Redis blijft nuttig voor wat het goed doet en wat géén bron van
waarheid is: `lib/rate-limit.ts`, en eventueel een pub/sub-nudge die clients
vertelt "er is een nieuwe revisie, haal hem op". Die nudge is dan een
optimalisatie bovenop de cursor, nooit de data zelf.

### 5.2 Privacy

Persoonsgegevens in dit systeem: `display_name` van deelnemers,
`participantName` op elke submissie, vrije tekst in `reasoning`, en
facilitator-e-mails. De zes dimensies, outcome-vectoren en graph-inhoud zijn
dat niet.

- **Minimalisatie bij sealen.** Bij `report_sealed` wordt `payload`
  standaard gepseudonimiseerd: namen → rol/groeplabel ("CISO",
  "Tafel 2"). Keuzes en vectoren blijven volledig. De facilitator kan per sessie
  expliciet kiezen om namen te bewaren, en die keuze wordt **in de log**
  vastgelegd. `pii_minimised_at` stempelt wanneer het gebeurde.
- **`reasoning`-vrijetekst** is het grootste risico (deelnemers typen daar
  namen van collega's). Die velden gaan standaard mee in de minimalisatie en
  worden in de presenter-projectie nooit getoond.
- **Geen PII in URL's.** Vervalt met het bearer-token uit §4.4. De huidige
  `?participantId=` in `lib/use-session-stream.ts:35` komt in elk access-log
  terecht.
- **Verwerkersgrond.** Neon via Vercel Marketplace: region `eu-central-1`
  vastzetten zodat data in de EU blijft. Dit is een afspraak die de eigenaar met
  de klant moet kunnen aantonen, dus hij hoort in de infrastructuurkeuze, niet
  in een later hoofdstuk.

### 5.3 Retentie

| Data | Bewaartermijn | Verwijderwijze |
|---|---|---|
| `event_log`, `event_projection`, `event_participant` | 90 dagen na `ended_at` | dagelijkse cron, `DELETE` op `retention_until < today` |
| `report_snapshot` (geminimaliseerd) | 24 maanden, per klant instelbaar | `DELETE`, gelogd |
| `report_snapshot` met namen (opt-in) | 12 maanden, harder | geforceerde minimalisatie, dan standaardtermijn |
| `scenario_version` | onbeperkt (geen PII) | alleen `archived` |
| `legacy_session_state` (backfill) | 90 dagen na import | kolom leegmaken; `payload` blijft |

`retention_until` is een kolom, geen afspraak in een document. Een cron op
`/api/cron/retention` met `CRON_SECRET`-verificatie doet het werk.

Let op het contrast met vandaag: de 24-uurs TTL op `ctt:session` is géén
retentiebeleid maar onbedoeld dataverlies (§2.2). Het nieuwe model houdt een
sessie zo lang als afgesproken en gooit hem dan aantoonbaar weg.

### 5.4 Backup

- Neon point-in-time restore, venster ≥ 7 dagen. Dekt "iemand heeft een sessie
  weggegooid".
- Wekelijkse logische dump naar Vercel Blob met `access: 'private'`,
  versleuteld, binnen dezelfde retentietermijn. Dekt "het account is weg".
- **Restore-test vóór de eerste echte klantsessie op v2.** Een backup die nooit
  is teruggezet is geen backup. Dit hoort in de acceptatie van fase 3, niet in
  een runbook.

---

## Deel 6 — Gefaseerde uitrol

Elke fase is apart deploybaar en apart terug te draaien. Geen enkele fase
verandert bestaande KV-data; `ctt:session`, `scenario-graph:*` en
`admin:sessions-archive` blijven tot fase 7 ongemoeid en gezaghebbend.

### Fase 0 — Exporteren, niets veranderen

Read-only CLI-script dat `ctt:session`, alle `scenario-graph:*` en
`admin:sessions-archive` naar versioneerde JSON schrijft (buiten git, naar
private Blob). Draait tegen productie, schrijft **niets** terug.

*Klaar wanneer:* er een export is waarvan de hash is vastgelegd en waaruit het
huidige scenario-bestand aantoonbaar reconstrueerbaar is.
*Rollback:* n.v.t. — het schrijft niet.
*Dit is ook de harde voorwaarde die AGENTS.md stelt: export vóór migratie.*

### Fase 1 — Neon ernaast, alleen scenario's

Neon provisioneren, migrations voor `scenario`, `scenario_version`, `app_user`.
Importer vult ze uit de fase-0-export. Leespad blijft KV; Neon wordt alleen
geschaduwd en vergeleken (`content_hash`).

*Klaar wanneer:* elke KV-graph een `scenario_version`-rij heeft met kloppende
hash, en de builder nog volledig op KV draait.
*Rollback:* Neon-rijen droppen.

### Fase 2 — Publish-gate, nog zonder nieuwe runtime

Scenario's worden gelezen uit `scenario_version` achter een flag. Publiceren
maakt `version + 1` in plaats van overschrijven. `createSession` eist
`publish_status = 'published'`.

*Klaar wanneer:* een scenario wijzigen een nieuwe versie oplevert en de oude
leesbaar blijft.
*Rollback:* flag terug naar KV-lezen; de publish-gate is het enige
gedragsverschil en is per flag uit te zetten.
*Let op:* dit is de fase die de `draft`-sessies uit §2.1 blokkeert. De
`needs_owner_review`-lijst moet hiervóór door de eigenaar heen.

### Fase 3 — Nieuwe sessie-runtime, multi-session, naast de oude

`event_session`, `event_participant`, `event_log`, `event_projection` plus de
state machine van deel 4 als nieuwe module. Nieuwe routes onder `/api/v2/`.
Oude routes en `lib/session-store.ts` blijven **onaangeraakt**. Een
feature flag per facilitator bepaalt welke engine een nieuwe sessie krijgt.

*Klaar wanneer:* de vier-browser-test van #70 groen is op v2, met twee
gelijktijdige sessies die elkaar niet zien, en de restore-test uit §5.4 is
gedaan.
*Rollback:* flag uit; nieuwe sessies gaan weer naar de oude engine.
*Cutover-regel:* lopende sessies blijven op hun eigen engine (§2.2).

### Fase 4 — Cursor-stream voor v2

`/api/v2/sessions/{id}/stream?since=` met `Last-Event-ID`. De 2-seconden poll
wordt een trage veiligheidsnet (bijvoorbeeld 15 s) en **leest alleen**, want
`settleAndGetState` bestaat in v2 niet meer.

*Klaar wanneer:* een client die 60 s offline is geweest, bijwerkt zonder
dubbele keuze of overgeslagen fase, en de 300 s stream-herverbinding geen
zichtbare hik geeft.
*Rollback:* v2-clients terug naar polling; de log blijft de bron.

### Fase 5 — Rapport sealen

`report_snapshot` schrijven in dezelfde transactie als `session_ended`.
`/admin/report/[sessionId]` leest eerst de snapshot. Reset archiveert niet
langer.

*Klaar wanneer:* een afgesloten sessie leesbaar blijft na reset, en een
gesimuleerde formulewijziging de oude cijfers **niet** verandert.
*Rollback:* leespad terug naar live-berekening; snapshots blijven staan.
*Dit repareert de 404 uit §2.3 punt 3.*

### Fase 6 — Backfill oud archief, read-only

Elke `SessionSnapshot` uit `admin:sessions-archive` wordt een
`report_snapshot` met `scoring_version = '1.0.0'`,
`scoring_version_inferred = true` en de rauwe state in
`legacy_session_state`. Idempotent op `session_id`.

*Klaar wanneer:* elke gearchiveerde sessie via de nieuwe rapportpagina opent en
het aantal rijen gelijk is aan het aantal keys in het KV-object.
*Rollback:* backfill-rijen verwijderen; KV-key is onaangeraakt.

### Fase 7 — KV afbouwen

Pas als er geen sessies meer op de oude engine draaien en de backfill is
geaccepteerd: `ctt:session`, `ctt:templates`, `ctt:users`,
`admin:sessions-archive` en `scenario-graph:*` als dode opslag markeren.
Upstash blijft voor rate-limiting. `@vercel/kv` eruit (§1.9), oude
`session-store`-code verwijderen — pas hier, en alleen op aantoonbare
afwezigheid van gebruik.

*Klaar wanneer:* geen codepad meer naar `lib/db.ts`-sessiefuncties, en de
fase-0-export is nog steeds terug te zetten.
*Rollback:* dit is de eerste onomkeerbare stap. Daarom laatst, en pas na
expliciete goedkeuring.

---

## Deel 7 — Acceptatiecriteria, en waar ze geborgd zijn

| Criterium uit #71 | Waar het vandaan komt | Test |
|---|---|---|
| Twee events kunnen elkaars state niet bereiken | `session_id` in sleutel + FK + autorisatie op `facilitator_user_id` (§3.2, §4.4) | twee sessies parallel; elkaars joincode en revisie proberen; beide `404`/`403` |
| Refresh/reconnect dupliceert nooit een keuze | `UNIQUE (session_id, idempotency_key)` (§4.2) | zelfde submit 5× met zelfde key → één logrij, één inject, één `branchLog`-entry |
| Refresh dupliceert nooit een fase-overgang | deterministische `auto:`-keys (§4.2) | 10 gelijktijdige pollers over een deadline → precies één `phase_auto_advanced` |
| Toetsbare audit trail | `event_log` met `actor_kind` (§4.6) | één sessie volledig doorlopen; assert op de volgorde start/join/transition/choice/lock/export |
| Oude sessies blijven leesbaar | `report_snapshot` zelfdragend (§3.3) | snapshot openen ná verwijderen van `event_log`; formule wijzigen, cijfers blijven |

---

## Deel 8 — Waar dit afwijkt van het herbouwplan

`docs/overdracht/2026-10-12-REBUILD-PLAN.md` is het uitgangspunt en ik volg de
architectuurkeuzes ("scheid content van runtime", "één sessie-module met
idempotency-keys", "één realtime-adapter", "oude sessies blijven read-only
snapshots"). Drie afwijkingen, expliciet:

1. **"Meerdere gelijktijdige sessies" staat in het plan bij 3.0 (Platform). Ik
   zet het bij de datastore, dus 0.0/1.0.** Niet uit ambitie: de huidige
   situatie is geen ontbrekende feature maar een isolatiedefect (§1.2). Twee
   facilitators op productie overschrijven vandaag elkaars event zonder
   foutmelding. Bovendien is `session_id` in de sleutel zetten goedkoop nú en
   duur later — het raakt elke route, elke lees- en schrijfactie en de hele
   autorisatielaag. Dat twee keer doen is verspilling.

2. **"Polling is hooguit een read-fallback, niet de bron van waarheid" — eens
   met het doel, maar het gat is groter dan het plan suggereert, en ik verbied
   polling niet.** Vandaag *is* polling de bron van waarheid én een schrijfpad
   (§1.6). Tegelijk dwingt `maxDuration` op Vercel een streambreuk af, dus
   "altijd push" bestaat daar niet. Mijn voorstel is een derde optie: maak de
   lees-/catch-upweg **cursor-gebaseerd** op de log. Dan is herhaald lezen een
   hervatbare log-read in plaats van een state-overschrijving, en is het
   onderscheid push/poll niet langer correctheidsbepalend.

3. **"Oude sessies blijven read-only rapport-snapshots" — eens, maar niet
   streng genoeg geformuleerd.** De volledige `SessionState` bewaren is niet
   genoeg, want de rapportcijfers worden bij elke GET herberekend (§2.3 punt 4).
   Zonder bevriezing van de **uitkomst** plus een `scoring_version`-stempel
   herschrijft een latere formulewijziging stil een rapport dat een klant al
   heeft gezien. Daarom is `report_snapshot.payload` zelfdragend.

Daarnaast, als correctie en niet als afwijking: `docs/overdracht/bekende-bugs.md`
schrijft bij "Beslissing afsluiten jump naar volgende ronde" dat
"de code klopt" en dat er "geen auto-advance" is. Dat is onvolledig.
`submitDecision` voert zelf een `decision → review`-transitie uit
(`lib/session-store.ts:1629-1639`), op een **ongelockte** write, getriggerd
door een deelnemer. Dat is server-side auto-advance en een plausibele oorzaak
van optie (b) in die bugbeschrijving. Het hoort niet thuis in een
submit-handler en wordt in dit contract het `all_submitted`-systeemcommando.

---

## Openstaande keuzes voor de eigenaar

Dit zijn inhoudelijke keuzes, geen implementatiekeuzes. Daarom gestopt.

1. **Draft-scenario's die al gedraaid hebben** (§2.1): importeren als
   `published`, of de eigenaar publiceert ze één keer handmatig?
2. **Namen in rapporten** (§5.2): standaard pseudonimiseren met opt-in per
   sessie, of standaard namen bewaren met opt-out?
3. **Bewaartermijnen** (§5.3): 90 dagen eventdata en 24 maanden rapport is een
   voorstel, geen gegeven. Wat is er met klanten afgesproken?
4. **Cutover van een lopend event** (§2.2): akkoord met "lopende sessie maakt af
   op de oude engine, geen replay"?

Zodra 1 t/m 4 beantwoord zijn en dit document is goedgekeurd, is fase 0 de
eerste stap — en die schrijft nog niets.
