# Tabletop Simulator — Crisis Oefening Platform

Live: **https://tabletop-upgraded-2.vercel.app**

> ⚠ **Pushen naar `main` = productie.** Elke merge op `main` deployed automatisch
> naar de bovenstaande URL via Vercel. Werk altijd op een branch en merge via
> een PR (main is beschermd met een ruleset sinds 2026-08-13). Zie
> `docs/overdracht/status.md`.

Een Next.js-platform voor het draaien van cybersecurity crisis tabletop-oefeningen. Facilitators configureren een oefening via een setup-form of visuele scenariobuilder; deelnemers ontvangen real-time injects en maken beslissingen vanuit hun rol. De AI-wizard genereert een `ScenarioGraph` op basis van klantprofiel + special conditions.

## Voor overdracht en nieuw personeel

Begin met deze docs, in deze volgorde:

1. `CLAUDE.md` — werkafspraken (git-discipline, harde regels, niet-aanraken).
2. `CONTEXT.md` — domein-glossarium, mét de aliasconflicten die anders
   verwarring geven.
3. `docs/overdracht/architectuur.md` — huidige stand van de codebase.
4. `docs/overdracht/bekende-bugs.md` — wat we onderweg gevonden en laten liggen.
5. `docs/overdracht/scenario-data.md` — anatomie van een scenario-bestand.
6. `docs/overdracht/status.md` — waar we nu staan.

De `docs/architecture/*.md`-set (`01_three_layer_logic.md` t/m
`05_data_model.md`) is **verouderd**; die beschrijft de oude
module-library-architectuur van vóór de graph-refactor. Alleen lezen om
context te krijgen op oude beslissingen.

---

## Snel starten (local dev)

```bash
pnpm install
pnpm run dev
```

Opent op http://localhost:3000. Auth is **uit** in local dev — ga direct naar
`/admin`. Sessies zijn in-memory (reset bij restart). Templates in localStorage.

`ANTHROPIC_API_KEY` in `.env.local` als je de AI-wizard wilt testen.

Volledige env-vars en Vercel setup: `SETUP.md`.

---

## Architectuur (huidig)

Alles draait om `ScenarioGraph` in `lib/graph/`. Kort:

```
WizardConfig (klant + sector + rollen + special condition)
  ↓ lib/wizard/framework.ts — multi-step LLM-orchestratie
ScenarioGraph (lib/graph/types.ts:291) — nodes + edges, JSON-serializable
  ↓ lib/graph/dynamic-fill.ts — {{sector}} etc. token-substitutie
  ↓ lib/graph/engine.ts — state-machine
Sessie (lib/session-store.ts, in-memory + KV persist)
  ↓ SSE stream via /api/session/state, met 4s polling fallback
Facilitator / Deelnemer / Presenter / Observer views
```

Voor het uitgebreide verhaal: `docs/overdracht/architectuur.md`.

---

## Legacy architectuur (nog aanwezig in code, deels ongebruikt)

De oude drie-laags pipeline:

```
ExerciseConfig (setup-form)
  ↓
Attack Chain (scenario-type-specifieke fasering)
  ↓
Module Library (selectie van 2–8 modules per oefening)
  ↓
AI Generator (Haiku = lean / Sonnet = full ScenarioInstance)
  ↓
Bridge (ScenarioInstance → Scenario met rounds, injects, roleActions)
  ↓
Session Store (KV + SSE broadcast naar deelnemers)
```

### Attack Chains (`lib/chains/`)

Elk scenario-type heeft een eigen aanvalstimeline met detecteerbaarheid, MITRE ATT&CK-referenties en artefacten per fase:

| Type | Fases | Kenmerk |
|---|---|---|
| `ransomware_double_extortion` | 9 | data-exfil vóór encryptie, backup-vernietiging |
| `insider_threat` | 9 | covert data-hoarding via legitieme toegang |
| `bec_cfo_fraud` | 8 | geen technische compromise — puur social engineering |
| `supply_chain_compromise` | 10 | gesigned update als vector, sector-breed nieuws |

### Module Library (`lib/modules/`)

10 herbruikbare modules, elk met eigen leerdoel, default kanalen, duur en framework-prompts:

`detection_sensemaking` · `triage_containment` · `business_continuity` · `crisis_communication` · `legal_regulatory` · `ransom_negotiation` · `recovery_lessons` · `insider_investigation` · `supply_chain_response` · `forensic_attribution`

### Decision Frameworks

Per oefening kiesbaar: **BOB** (Beeldvorming–Oordeelvorming–Besluitvorming), **OODA**, **DAIR**, **NIST-IR**, of vrij. Default: BOB.

---

## AI Generatie (`lib/scenario/`)

```
generateScenarioInstance()          ← full Sonnet pad (ScenarioInstance)
  selectAttackChain()               stap 1: chain ophalen
  planModules()                     stap 2: module-selectie o.b.v. config
  buildSkeleton()                   stap 3: skeleton JSON
  buildPrompt()                     stap 4: user message + type-guidance
  callAI()                          stap 5: Anthropic API
  runAllValidators()                stap 6: validatie + optioneel retry

generateLeanScenario()              ← lean Haiku pad (Scenario direct)
scenarioInstanceToScenario()        ← bridge: ScenarioInstance → Scenario
```

**Intensiteit (`aiIntensity`):**
- `off` — statisch scenario via `lib/scenario-generator.ts`
- `lean` — Haiku, simpel rounds[] formaat, 3 rondes
- `full` — Sonnet, volledige ScenarioInstance met modules/decisions/learning_objectives

Fouten bij `lean`/`full` geven een HTTP 500 terug aan de setup-form. Stille fallback naar statisch is alleen toegestaan bij `aiIntensity=off`.

---

## Leerdoelen (`LearningObjective`)

Elk scenario-round bevat 1–2 leerdoelen. Ze worden in het sessierapport getoond met status behaald/niet behaald.

```ts
interface LearningObjective {
  id: string
  description: string          // max 15 woorden, actiegericht
  module: ModuleId
  measuredBy: 'decision' | 'special' | 'manual'
  triggerActionIds?: string[]  // welke roleAction-ids bereiken dit doel
  triggerSpecialType?: SpecialType
  achieved?: boolean
  achievedAt?: string
}
```

De AI genereert leerdoelen per module. De statische generator (`lib/scenario-generator.ts`) heeft per ronde handmatige leerdoelen met de juiste `triggerActionIds`.

---

## Specials

Drie special events die de facilitator kan triggeren:

| Type | Beschrijving |
|---|---|
| `ransomware_negotiation` | Chat met DarkBridge Collective — scripted of AI-evaluated |
| `ap_notification` | AVG Art. 33 formulier invullen (72u klok) |
| `journalist_qa` | NOS-interview — scripted vragen + kwaliteitsscoring |

Keuze-knoppen tonen **geen** kwaliteitsindicatie vóór selectie. Kleurcodering en score-badge verschijnen pas ná de keuze via `ChoiceHint`.

---

## Inject Rendering (`components/participant/inject-feed.tsx`)

Elk inject-kanaal heeft een eigen visuele kaart:

| Kanaal | Renderer | Ook mapped van |
|---|---|---|
| `whatsapp` | WhatsApp-bubble | — |
| `slack` / `teams` | Slack-stijl | `teams` |
| `email` | Email-client kaart | — |
| `siem_alert` / `siem` | Terminal SIEM alert | `siem` |
| `system_alert` / `edr` | System alert | `edr` |
| `news_ticker` / `news` | Breaking news banner | `news` |
| `phone` | Incoming call UI | — |
| `sms` | SMS-bubble | — |
| `raw` / `memo` / `ransom_note` | Simpele kaart | `memo`, `ransom_note` |

Inject `content` is altijd **plain text** — geen HTML-tags. Sender en timestamp worden door de kaart zelf getoond.

---

## Codebase overzicht

```
app/
  page.tsx                    Landing page (rol-selector)
  admin/
    page.tsx                  Facilitator setup
    dashboard/page.tsx        Live control dashboard
  join/page.tsx               Deelnemer join
  api/session/
    create/route.ts           Sessie aanmaken + AI generatie (MAIN)
    join/route.ts             Deelnemer join
    state/route.ts            SSE live state stream
    action/route.ts           Sessie-acties (start, next round, push inject)
  api/special/route.ts        Special events

lib/
  types.ts                    ALLE types + ROLE_META + ExerciseConfig
  types/scenario-instance.ts  ScenarioInstance shape (AI output)
  chains/                     Attack chain definities per scenario-type
  modules/                    Module library (definities + defaults)
  validators/                 ScenarioInstance validators
  scenario/
    generator.ts              AI pipeline (selectChain → planModules → AI → validate)
    bridge.ts                 ScenarioInstance → Scenario + learningObjectives mapping
    prompts.ts                System prompt + type-guidance per scenario-type
  scenario-generator.ts       Statisch scenario (fallback bij aiIntensity=off)
  session-store.ts            In-memory + KV session state
  document-generator.ts       Per-rol hypothetische documenten
  api-client.ts               Client-side API helpers

components/
  admin/
    setup-form.tsx            Facilitator config form
    control-dashboard.tsx     Live facilitator dashboard
    report-view.tsx           Sessierapport incl. Leerdoelen sectie
  participant/
    inject-feed.tsx           Live inject rendering per kanaal
    play-view.tsx             Deelnemer sessie view
    special-modal.tsx         Special event modal (chat/form)
  shared/
    timeline-panel.tsx        Event timeline

docs/                         ← Zie hieronder
```

---

## Documentatie

```
docs/
├── CLAUDE_CODE_BRIEF.md              Implementatie-brief voor Claude Code
├── architecture/
│   ├── 01_three_layer_logic.md       Attack chain → module-projectie → injects
│   ├── 02_module_library.md          10 modules met leerdoel, prompts, kanalen
│   ├── 03_decision_frameworks.md     BOB / OODA / DAIR / NIST-IR / vrij
│   ├── 04_ir_retainer_scope.md       Wat wij doen vs wat de klant beslist
│   └── 05_data_model.md              TypeScript types
└── library/
    ├── chains/
    │   ├── ransomware_double_extortion.md   9-fasige aanvalstimeline
    │   ├── insider_threat.md               9-fasige aanvalstimeline
    │   ├── bec_cfo_fraud.md                8-fasige aanvalstimeline
    │   └── supply_chain_compromise.md      10-fasige aanvalstimeline
    └── prompts/
        ├── scenario_generator.md           System prompt voor de AI-laag
        └── inject_renderer.md              Per kanaal: structuur + voorbeelden
                                            incl. forwarded threads, regulator-mails,
                                            persvragen en escalerende emailketens
```

---

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # Vul ANTHROPIC_API_KEY en KV-variabelen in
npm run dev
```

Vereiste env-variabelen:
- `ANTHROPIC_API_KEY` — voor lean (Haiku) en full (Sonnet) AI-generatie
- `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` — Vercel KV voor session storage

---

## Deployen

```bash
vercel --prod
```

Of via de `/deploy` Claude Code command (type-check + Vercel preview in één stap).

---

## Rollen

| Rol | Team | Bevoegdheden |
|---|---|---|
| CEO | crisis_management | Losgeld-beslissing, publieke communicatie, board |
| CISO | crisis_management | IR-coördinatie, beveiligingsadvies |
| CFO | crisis_management | Financiële noodbesluiten, verzekeraar |
| Legal | crisis_management | AP-melding (72u), NIS2, aansprakelijkheid |
| Head of Communications | crisis_management | Perscommunicatie, interne comms |
| HR Lead | crisis_management | Medewerkerscommunicatie, insider-onderzoek |
| Operations Manager | crisis_management | Business continuity, noodprocedures |
| IT Manager | technical_it | Systemen isoleren, backups |
| System Administrator | technical_it | Logs veiligstellen, technische validatie |

---

## Live updates

Deelnemers en facilitators krijgen state-updates via twee mechanismen tegelijk:

1. **SSE (`/api/events`)** — instant push binnen dezelfde serverless instance.
2. **Polling van `/api/session/state` elke 2s** — noodzakelijk omdat Vercel requests naar verschillende instances kan routeren; SSE-listeners op instance A missen dan mutaties die instance B verwerkt. De poll garandeert eventual consistency binnen ≤2s.

De poll herkent 401 responses en stuurt participants terug naar `/join` (Fix 20). Voor exercises >~30 gelijktijdige participants kan het zinvol zijn om over te stappen op KV pub/sub in plaats van per-process listeners.

---

## IR-retainer scope

De AI genereert **geen** decisions over forensisch onderzoek, EDR-isolatie, malware-analyse, of log-preservering — dat is retainer-scope. Decisions gaan altijd over:

- **Governance** — CMT, mandaat, escalatie, verzekeraar
- **Business continuity** — prioritering, workarounds, medewerkerscommunicatie
- **Communicatie** — stakeholder-prio, woordvoering, pers
- **Juridisch** — meldplichten (AP, NCSC, sectoraal), aangifte
- **Strategie** — betalen, onderhandelen, klanten informeren, lessons learned
