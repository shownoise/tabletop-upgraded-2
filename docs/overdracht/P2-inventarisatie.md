# P2 — Inventarisatie labels en teksten

**Waarom een rapport in plaats van meteen fixen**: het prompt zegt letterlijk
"Laat me EERST alle plekken zien" (feit/fabel), "Laat me de huidige en je
voorgestelde tekst zien voor je wijzigt" (meldplicht), en "Zoek uit wat het nu
feitelijk doet en vraag me hoe ik het wil. Bedenk het niet zelf" (inject-filter).
Dit rapport levert de plekken; de vragen staan onderaan.

---

## Punt 1 — `feit / aanname / fabel` → `feit / aanname`

**Verspreiding**: 61 hits over 15+ bestanden. Dit is een migratie, geen
label-tweak. `fabel` zit in het datamodel, tests, wizard-regels, en 6 authored
ruis-injects in het bestaande NL-onderwijs scenario.

**Type-definities** (broncode):
- `lib/graph/types.ts:97` — `classification?: 'feit' | 'aanname' | 'fabel'` op InjectNodeData
- `lib/graph/types.ts:283` — herhaling op een ander type (waarschijnlijk InjectLibraryEntry)
- `lib/graph/wizard-plan.ts:66` — hetzelfde in de wizard-plan tussenrepresentatie
- `lib/api-client.ts:61, 121` — client-side type & filter-payload

**UI**:
- `components/participant/inject-feed.tsx:617` — `const CLASSIFICATIONS = ['feit', 'aanname', 'fabel']` — bepaalt welke filter-buttons de deelnemer ziet
- `lib/graph/validate.ts:159` — validatie-boodschap: *"Inject … heeft geen type informatie — kies feit, aanname of fabel."*

**Wizard-logica die op `fabel` steunt**:
- `lib/wizard/pipeline.ts:95, 108` — de Claude-prompt bevat expliciet 3 categorieën en zegt *"Een fabel-inject mag nooit de enige setup zijn"*
- `lib/wizard/pipeline.ts:184` — de JSON-schema-instructie voor Claude bevat `"classification":"feit|aanname|fabel"`
- `lib/wizard/framework.ts:194` — **Rule 4**: een `fabel` mag geen setup zijn voor een decision. Deze regel verdwijnt als `fabel` verdwijnt.

**Tests**:
- `lib/graph/__tests__/schoolvereniging-scenario.test.ts:125, 149, 184` — verwacht letterlijk `['feit', 'aanname', 'fabel']` en test op "no setup inject is fabel"
- `lib/wizard/__tests__/framework.test.ts:220-270` — 3 tests bouwen op Rule 4
- `lib/wizard/__tests__/pipeline.test.ts:179-189` — test die controleert dat een broken fabel-plan wordt geregenerated

**Bestaande scenario-data (dit is wat je bedoelde met "raakt opgeslagen scenario-data")**:
- `lib/graph/examples-schoolvereniging.ts` — minstens 6 `classification: "fabel"` regels: r119, r2052, r2065, mogelijk meer (grep gaf een sample). Zonder migratie breekt dit scenario zijn eigen tests.

**Ook nog**: `lib/graph/types.ts:28` — het commentaarblok bij `EvaluationAspect.reliability` zegt letterlijk *"BOB-select + span-editor (feit / aanname / misleidend)"*. Dat is de derde naam die je noemde ("misleidend").

### Voorgestelde migratie (kies A of B, en beantwoord de subvraag)

**A. Hard cut**: `fabel` verdwijnt uit types, UI, wizard-regels, tests. Alle
bestaande `classification: "fabel"` in `examples-schoolvereniging.ts` wordt óf
`"aanname"` (als het lijkt op een aanname) óf `undefined` (als het puur ruis is
zonder feit-status). **Ik ga per hit langs, doe een voorstel per inject, jij
keurt af/goed.**

**B. Soft alias**: `fabel` blijft in het type-systeem als deprecated alias, UI
toont alleen feit/aanname. Bestaande data blijft werken zonder migratie. Rule 4
(fabel-setup verboden) blijft als guardrail, maar wordt onbereikbaar via de UI.
Nadeel: schoongemaakte optie later alsnog nodig.

**Subvraag bij A**: de wizard-prompt en Rule 4 zeggen expliciet *"een fabel mag
nooit de enige setup zijn voor een decision"*. Dat is inhoudelijk waardevol —
het voorkomt dat een LLM een cruciale decision baseert op een verzonnen fact.
Wil je die regel bewaren als *"een aanname mag nooit de enige setup zijn"*, of
laten vallen?

---

## Punt 2 — Meldplicht-tekst niet meer NIS2-specifiek

**Goed nieuws**: het architectonische deel is al parametrizeerbaar. De labels
lezen uit `regulatory.regime?.authorityLabel`
(`components/admin/assessment-report-view.tsx:295`,
`components/admin/reveal-panel.tsx:245`). Het regime wordt per scenario
gekozen — `nl_avg_nis2` is default (`lib/wizard/config.ts:52`).

**Wat wel NIS2-specifiek is**: de labels in `lib/i18n.ts`. Dat zijn de plekken
waar je "NIS2" letterlijk in de tekst ziet zonder dat het uit een regime-object
komt.

Voorbeelden (Nederlands):
- `lib/i18n.ts:395` — `exercise_goal_nis2_readiness: "NIS2 Gereedheid"`
- `lib/i18n.ts:423` — `plan_nis2: "NIS2-proces gedocumenteerd"`
- `lib/i18n.ts:367` — `modeHint_training: "NIS2-gerichte training met procesconformiteit bijhouden."`

Plus in scenario-data (`lib/graph/examples-schoolvereniging.ts:331`):
- `"AVG 72u klok: verstrijkt donderdag 08:42. NIS2 24u: dinsdag 08:42."`

Die laatste is voor het NL-onderwijs scenario correct (NIS2 is daar écht van
toepassing). Ander scenario, ander regime → andere teksten. Dat werkt al mits
je de juiste regime kiest.

### Voorgestelde tekstwijziging (concreet)

Op te leveren als wijziging, in de labels waar "NIS2" hardcoded in de key of
value zit terwijl het generiek moet zijn. Concreet voorstel voor twee labels:

- `modeHint_training` (nu: *"NIS2-gerichte training met procesconformiteit
  bijhouden."*) → *"Training met focus op procesconformiteit; meldplicht
  bij de bevoegde autoriteit conform het gekozen regime."*
- `exercise_goal_nis2_readiness` (label: "NIS2 Gereedheid") →  laten staan
  want dit is expliciet de NIS2-variant van het doel. Er is óók een
  algemenere `exercise_goal_regulatory_readiness` mogelijk als je die naast
  wil zetten.

**Vraag**: keur je dit voorstel goed, of wil je een andere formulering?
Ik doe niks aan `examples-schoolvereniging.ts` want daar is NIS2 inhoudelijk
correct.

---

## Punt 3 — Inject-filter "verbergen" en "afgehandeld"

Er zijn **twee losse mechanismen** in `components/participant/inject-feed.tsx`:

- **`hidden`** (regel 550, 576) — deelnemer klikt "verbergen" → inject
  verdwijnt uit de feed. Wordt geteld als "{n} verborgen" (regel 683). Kan
  weer terug via een "toon verborgen" UI (moet ik nog vinden).
- **`handled`** (regel 551, 712-714) — deelnemer klikt "afgehandeld" →
  inject blíjft in de feed, alleen de "ongelezen" dot (regel 734-736)
  verdwijnt. Puur cosmetisch.

Er is óók een classificatie-filter met de buttons feit/aanname/fabel
(regel 617-630). Dat is een klassieke show/hide-filter — filtert op de type
informatie, niet per inject.

Wat het NIET is: één filter met opties "verbergen" en "afgehandeld" waarmee je
de feed opschoont. Dat lijkt te zijn wat jij bedoelde ("filter zodat een
deelnemer bij twintig injects per ronde overzicht houdt").

### Vraag

Hoe wil je het? Opties (ik doe nul werk tot je kiest):

- **X. Laten zoals het is** — twee losse acties per inject (hide + mark-handled),
  plus classificatie-filter. Deelnemer die overzicht wil, klikt handmatig.
- **Y. "Afgehandeld" wordt óók een filter** — extra filterknop bovenaan de
  feed: "Verberg afgehandeld". Aan = handled injects verdwijnen uit de feed.
  Deelnemer kan met één klik alle afgeronde injects wegwerken.
- **Z. "Afgehandeld" wordt een auto-hide** — inject die je als afgehandeld
  markeert, verdwijnt direct uit de feed. Effectief hetzelfde als "verbergen".
  Nadeel: verlies je het onderscheid tussen "actief genegeerd" en "afgerond".

Mijn gok van wat je bedoelde: **Y**. Maar je moet kiezen.

---

## Punt 4 — Engels in Nederlandse schermen (alleen inventarisatie, geen wijziging)

Wat ik zeker vond:

- **Escalatie-labels** — `components/participant/session-hud.tsx:12`:
  `const ESCALATION_LABELS = ["normal", "elevated", "high", "critical"]` —
  Engelse strings hardcoded, gerenderd in een Nederlands scherm. Dit is de
  "normal" die je zag. Er bestaat een aparte `Urgency` type in
  `lib/types.ts:360` met `low | medium | high | critical`, óók Engels. Beide
  worden in de UI als label getoond.

- **Urgency-strip** — `components/participant/inject-feed.tsx:730-731`:
  `<span>{p.inject.urgency}</span>` — rendert de Engelse waarde letterlijk.
  Onderdeel van dezelfde familie.

Overige verdachten die ik NIET verder heb uitgezocht (te breed, geen tijd voor
zonder je akkoord):
- Fase-labels: `PHASE_ORDER` in `components/admin/control-dashboard.tsx:39` —
  `["inject", "discussion", "decision", "review"]` — Engels. Mogelijk elders
  wél NL vertaald (er is een `ROUND_PHASE_LABELS_NL`).
- Diverse debug-strings, aria-labels, en placeholder-teksten. Deze zijn niet
  gebruikersgezicht in de gangbare flow.

### Vraag

De P2-instructie is **alleen inventariseren, geen wijzigingen** — "dit raakt
straks de i18n-laag". Bevestig dat je akkoord bent dat dit hier stopt en op
de developers-lijst gaat, of zeg welke onder de streep één-woord-fixes zijn
die je nu wél wil.

---

## Wat ik nu ga committen

Alleen dit rapport + een status.md update. Geen code, geen UI, geen data. Merge
deze PR als je de vragen wil beantwoorden op GitHub, of laat 'm open en
antwoord hier in de chat — beide werkt.
