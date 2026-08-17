# Overdracht — status

Bron van waarheid voor wat gedaan is per klus. Bijgewerkt aan het eind van
elke klus. Laatste snapshot: **2026-08-17**.

## Snelle overdracht — 3 dingen om te weten

1. **Alles staat live op main + Vercel productie**. Push naar `main` = deploy. Main is beschermd met een ruleset (0 approvals, PR verplicht). Ankerpunt vóór dit alles: tag `pre-cleanup` op `aaefed9`.
2. **Werkwijze in `CLAUDE.md`**: bouwen is default, geen inventarisatiefases, aannames melden, mergen direct naar prod met squash. Stop alleen bij data-migratie of inhoudelijke keuze. Runtime-consumptie van scoring-overrides gaat live, teksten/rollen overrides zijn storage-only (developer follow-up).
3. **Admin app**: `/admin` = tabbed hub met Klanten · Scenario's · Sessies + Kwaliteit + Instellingen. Rapport zit in `/admin/sessions/[id]`. Alles wat je buiten een lopende sessie doet, zit daar.

## Klussen — chronologisch

| Klus | PR | Wat |
|---|---|---|
| P0 Werkafspraken + glossarium | #2 | CLAUDE.md, CONTEXT.md, `docs/overdracht/`, git-discipline, main-protection ruleset |
| P10 Bug '7 van de 1' | #3 | live-overview counter fix; bug 1+3 gediagnosticeerd |
| P2 Inventarisatie labels/teksten | #4 | `docs/overdracht/P2-inventarisatie.md` (fabel/meldplicht/inject-filter vragen) |
| P7 Testset + rubric | #5 | 5 testklanten + 10-punts rubric + nulmeting workflow |
| P13 Overdracht-docs | #6 | architectuur, bekende bugs, scenario-data, README push=prod warning |
| P4 fase 1 Inventarisatie configureerbaar | #7 | 35-rijen tabel: waar zit welke tekst |
| P12 Rapport-voorbeeld | #8 | fictief klantrapport GGZ De Waterhof met 🟡 data-gaten |
| Werkstijl-shift | #9 | CLAUDE.md: bouwen is default, geen approval-gates |
| P5 Scoring afgebouwd | #10 | bug fix "alles negatief", sectorweging weg, `lib/scoring/vector-overrides.ts` (96 entries), facilitator review scherm |
| P3 Builder werkbaar | #11 | grouping-per-rol, decision onder ronde, expand-all, visibility dedup |
| P4 fase 2 Centrale texts | #12 | `lib/config/texts.ts`, fabel/misleidend migratie, runtime-migratie |
| Herstel classification | #13 | rule 4 terug voor generatie, ground-truth as 3-waardig terug (`InjectReliability`) |
| P6 Wizard prompt-regels | #14 | 6 narratieve regels + 2 framework rules (11=hidden weakness, 12=taalconsistentie), min opties per rol=3, demo-script |
| Event modus af | #15 | modus vast bij aanmaken, mid-session toggle weg, /api/session/set-mode blocked na lobby |
| Admin hub v1 | #16 | tabbed hub met 5 secties, scenarios CRUD, config-tab, roles-tab |
| Admin v2 volwaardig | #17 | Klanten (nieuw), Scenarios upgrade, Sessies (nieuw), Instellingen 4-tab, Kwaliteit rubric-scorer |
| Fix builder auto-load | #18 | `/admin/builder?id=X` laadt scenario direct |
| Rapportage v1 | #19 | Sessie-detail = volledig rapport in 6 secties + spider+bars + PDF-print |
| Rapportage trim | #20 | spider-only, placeholder-labels, data-gaten lijst |
| Feit-vs-aanname retro | #21 | facilitator kan retroactief taggen als deelnemers niets tagden |

## Wat er nu op main staat (functioneel)

**Facilitator flow**:
- Login → `/admin` → hub met tabs bovenin
- **Klanten** (`/admin/clients`): grid, seed van 5 testklanten uit `docs/kwaliteit/testklanten.md`, detail met autosave + gerelateerde scenario's + sessies
- **Scenario's** (`/admin/scenarios`): tabel met zoek/filter/sort/archived, dupliceren met andere klant, hernoemen, verwijderen. Klik op naam → builder met scenario geladen
- **Sessies** (`/admin/sessions`): tabel met datum/klant/scenario/modus/uitkomst. Klik = volledig rapport
- **Kwaliteit** (`/admin/quality`): kies testklant, scoor gegenereerd scenario tegen 10-punts rubric, prompt-versie meegeslagen voor trend-tracking
- **Instellingen** (`/admin/settings`): 4 tabs — Teksten (350+ keys uit `lib/config/texts.ts`), Rollen (briefings per rol), Regimes (read-only), AI-wizard (prompt + versie + framework-rules read-only)

**Sessie-flow (bestaand, ongewijzigd)**:
- `/admin/prepare` → start sessie
- `/admin/dashboard` → live control
- `/admin/present` → grote scherm (event mode)
- Deelnemer via `/join` met code, `/play` na join
- Bij reset → snapshot naar sessies-archief

**Rapport per sessie** (`/admin/sessions/[id]`):
1. Samenvatting (klant, scenario, modus, datum, deelnemers, uitkomst)
2. Zes dimensies — spider chart (340px)
3. Verloop per ronde — situatieschets, stuurvragen, per rol keuze + vector-badges + alternatieven
4. Feit vs aanname — alle setup-injects met ground truth, deelnemer-tags OF facilitator retro-tag, mismatch-indicator
5. Lessons learned — auto van `DecisionOption.lessonLearned`
6. Aanbevelingen (placeholder) — facilitator vult observaties + concrete aanbevelingen
- PDF-export via browser print (Print/PDF knop)

## Wat wacht op de gebruiker

- **PR #1** (`session/compliance-cleanup-wip`) is nog open. Bevat compliance-cleanup + evaluationAspects werk uit een oude sessie. Niet mergen tot je door de app hebt geklikt.
- **Testklanten inladen**: ga naar `/admin/clients`, klik "Testklanten inladen". Dat seed de 5 uit de rubric-workflow.
- **P2 vragen** (fabel/meldplicht/inject-filter) — antwoorden zijn gedeeltelijk in P4 fase 2 verwerkt; wat er nog handmatig moet is in `docs/overdracht/P2-inventarisatie.md`.
- **P7 nulmeting draaien**: 5 testklanten x wizard = 5 gescoorde scenarios. Zonder deze nulmeting is P6 (verdere prompt-regels) gokken.

## Bekende data-gaten in het rapport

Uit PR #20 en #21 lijst:
- ~~Feit-vs-aanname bij niet-getagde injects~~ (opgelost in #21 via retro-tag)
- **Discussie-transcript**: alleen finale keuzes + reasoning worden opgeslagen. Aparte feature, groot scope.
- **Per-groep uitsplitsing event-mode**: rapport toont team-cumulatief; per-team vergelijking bij een partner-event bestaat nog niet.
- **Follow-up datum**: geen veld voor wanneer een klant opnieuw geoefend moet. Klein.
- **Post-sessie observaties + aanbevelingen**: facilitator-input, wordt niet automatisch afgeleid. Correct model (dat is jouw expertise), niet een echte gap.

## Bekende bugs / open items (uit oude klussen)

- **P10 bug 1** (2-van-4 opties in decision-panel): geen hardcoded UI-limiet gevonden. Verifieer in het testscenario of alle 4 opties dezelfde `allowedRoles` hebben. Als tóch 2 verdwijnen → `lib/graph/wizard-plan.ts:220` of `lib/graph/preview.ts:46`.
- **P10 bug 3** ("Beslissing afsluiten" springt door): code klopt (transitions naar review, niet next round). Ligt in session-state of misidentificatie van adjacent knop.
- **`{{klantnaam}}` token** ontbreekt in dynamic-fill terwijl `clientName` wél in wizard-config zit. Toevoegen: `lib/graph/types.ts` + `lib/graph/dynamic-fill.ts`.
- **"Training modus"** heeft geen expliciete vlag in code (impliciet = niet event-mode). Bij event-mode-refactor (PR #15) niet aangeraakt, mogelijk niet nodig.

## Runtime propagation status (belangrijk)

- **Scoring-overrides** (via `/admin/settings` → wizard-prompt of scoring): gaan LIVE direct via `installAdminOverrides()` in `/api/session/score`.
- **Teksten-overrides** (via `/admin/settings` → Teksten): worden opgeslagen in KV maar app leest ze nog uit code. Developer follow-up bij i18n-migratie.
- **Rollen-overrides**: idem — storage only.
- **Wizard-prompt override**: storage only. Versie-string werkt wel door in rubric-scores.

## Architectuur — snel overzicht

- **Frontend**: Next.js App Router, Tailwind + shadcn/ui, react-flow voor de builder, SSE via `useSessionStream` met 4s polling fallback
- **Backend**: Next.js API routes (`app/api/...`), server-side session store in KV of in-memory fallback
- **Storage**: Vercel KV blobs — sessie, scenarios, admin-overrides (`admin:overrides`, `admin:clients`, `admin:sessions-archive`, `admin:rubric-scores`, `admin:wizard-prompt`)
- **Scoring**: `lib/scoring/` — vector per optie, 6 dimensies (CONT/FOR/BC/JUR/VER/KOS), overrides via `lib/scoring/vector-overrides.ts`
- **Wizard**: `lib/wizard/` — framework met 12 rules, pipeline met system-prompt in `pipeline.ts::buildSystemPrompt`
- **Types**: single source is `lib/types.ts` + `lib/graph/types.ts`. Zie `CONTEXT.md` voor het glossarium met alias-conflicten

## Klussen op de wachtrij (uit oorspronkelijke P1-P14, nog niet gedaan)

- **P1 Dode code opruimen** — niet gedaan; interactieve Q&A vereist
- **P8 Event modus spec + code** — code deels gedaan (#15), spec-schrijven met /grill nog niet
- **P9 Inject timing** — vertraging in absolute seconden vs percentage; niet aangeraakt
- **P11 Spider chart prototype** — spider is nu in het rapport (#20), aparte prototype-klus niet meer nodig
- **P14 Overdracht + tickets** — laatste klus, nog niet gedaan

## Waar dingen liggen

- `CLAUDE.md` — werkafspraken + custom commands
- `CONTEXT.md` — glossarium met alias-conflicten
- `docs/overdracht/architectuur.md` — huidige stand
- `docs/overdracht/bekende-bugs.md` — bugs + diagnoses
- `docs/overdracht/scenario-data.md` — ScenarioGraph anatomie
- `docs/overdracht/configureerbaar.md` — wat is per scenario / centraal / code
- `docs/overdracht/P2-inventarisatie.md` — 4 openstaande beslissingen fabel/meldplicht/filter
- `docs/kwaliteit/testklanten.md` — 5 vaste testklanten
- `docs/kwaliteit/rubric.md` — 10-punts rubric
- `docs/rapport-voorbeeld.md` — fictief klantrapport GGZ De Waterhof
- `SCORING.md` — scoring model, 6 dimensies uitgelegd

Alle 298 tests groen op HEAD.
